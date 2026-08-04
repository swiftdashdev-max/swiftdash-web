/**
 * POST /api/command-center/register — an emergency command center signs itself up.
 *
 * Creates three things together:
 *   1. business_accounts  (account_type='emergency', pending SwiftDash approval)
 *   2. an auth user       (their first administrator)
 *   3. user_profiles      (business_role='owner', linked to the account)
 *
 * Mirrors /business/signup, which also creates accounts as pending_approval.
 * If any step fails, everything created before it is rolled back by hand —
 * Supabase gives us no transaction across auth + tables.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-service';

interface RegisterBody {
  // The organization
  centerName?: string;
  centerEmail?: string;
  centerPhone?: string;
  centerAddress?: string;
  // The first administrator
  adminFirstName?: string;
  adminLastName?: string;
  adminEmail?: string;
  adminPhone?: string;
  password?: string;
}

export async function POST(req: NextRequest) {
  let body: RegisterBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const centerName  = body.centerName?.trim();
  const centerEmail = body.centerEmail?.trim().toLowerCase();
  const adminEmail  = body.adminEmail?.trim().toLowerCase();
  const {
    centerPhone, centerAddress,
    adminFirstName, adminLastName, adminPhone, password,
  } = body;

  if (!centerName || !centerEmail || !adminEmail || !password || !adminFirstName || !adminLastName) {
    return NextResponse.json(
      { error: 'Command center name, official email, administrator name, email and password are all required.' },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  }

  const supabase = getServiceClient();

  // ── 1. Create the command center account ───────────────────────────────────
  const { data: account, error: accountError } = await supabase
    .from('business_accounts')
    .insert([{
      business_name:         centerName,
      business_email:        centerEmail,
      business_phone:        centerPhone || null,
      business_address:      centerAddress || null,
      account_type:          'emergency',
      account_status:        'pending_approval',
      subscription_tier:     'starter',
      primary_contact_name:  `${adminFirstName} ${adminLastName}`,
      primary_contact_email: adminEmail,
      primary_contact_phone: adminPhone || null,
      created_at:            new Date().toISOString(),
      updated_at:            new Date().toISOString(),
    }])
    .select('id')
    .single();

  if (accountError || !account) {
    console.error('command-center/register: account creation failed', accountError);

    // 23505 = unique_violation. Name the field so the form can actually be corrected;
    // "please try again" on a duplicate email just makes people retry forever.
    if (accountError?.code === '23505') {
      const detail = `${accountError.message ?? ''}${accountError.details ?? ''}`;
      const message = detail.includes('business_email')
        ? 'That official email is already registered to another account. Use a different address, or sign in if this command center already exists.'
        : 'Some of these details are already registered to another account.';

      return NextResponse.json({ error: message, field: 'centerEmail' }, { status: 409 });
    }

    return NextResponse.json(
      { error: 'Could not create the command center. Please try again.' },
      { status: 500 }
    );
  }

  const businessId = account.id;

  // ── 2. Create the administrator login ──────────────────────────────────────
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password,
    phone: adminPhone || undefined,
    email_confirm: true,
    user_metadata: {
      first_name: adminFirstName,
      last_name:  adminLastName,
      user_type:  'business',
      business_name: centerName,
    },
  });

  if (authError || !authData?.user) {
    await supabase.from('business_accounts').delete().eq('id', businessId);

    const alreadyExists = authError?.message?.toLowerCase().includes('already');
    return NextResponse.json(
      {
        error: alreadyExists
          ? 'An account with this administrator email already exists. Sign in instead.'
          : 'Could not create the administrator account. Please try again.',
      },
      { status: alreadyExists ? 409 : 500 }
    );
  }

  const userId = authData.user.id;

  // ── 3. Link the administrator to the command center ────────────────────────
  // A trigger may already have created the profile row, so upsert.
  const { error: profileError } = await supabase
    .from('user_profiles')
    .upsert(
      {
        id:            userId,
        first_name:    adminFirstName,
        last_name:     adminLastName,
        phone_number:  adminPhone || null,
        user_type:     'business',
        status:        'active',
        business_name: centerName,
        business_id:   businessId,
        business_role: 'owner',
        updated_at:    new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

  if (profileError) {
    console.error('command-center/register: profile link failed', profileError);
    await supabase.auth.admin.deleteUser(userId);
    await supabase.from('business_accounts').delete().eq('id', businessId);
    return NextResponse.json(
      { error: 'Could not complete registration. Please try again.' },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { data: { businessId, userId, accountStatus: 'pending_approval' } },
    { status: 201 }
  );
}
