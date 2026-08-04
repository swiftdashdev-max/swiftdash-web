/**
 * POST /api/dispatcher/register — register for access to an emergency dispatch console.
 *
 * Two paths:
 *   • Open registration  → account is created PENDING and cannot sign in until approved.
 *   • With an invite code → the code is the authorization, so the account is ACTIVE at once.
 *
 * Open registration is the default because a dispatcher can read every incident in
 * the city, including reporter names, phone numbers and medical details. Anyone may
 * ask for access; nobody gets it without a human saying yes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-service';

interface RegisterBody {
  commandCenterId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  password?: string;
  code?: string;          // optional fast path
}

export async function POST(req: NextRequest) {
  let body: RegisterBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const code = body.code?.trim();
  const { password, firstName, lastName, phone, commandCenterId } = body;

  if (!email || !password || !firstName || !lastName) {
    return NextResponse.json(
      { error: 'Name, email and password are all required.' },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: 'Password must be at least 8 characters.' },
      { status: 400 }
    );
  }

  const supabase = getServiceClient();

  let businessId: string;
  let businessRole = 'dispatcher';
  let status: 'active' | 'pending';
  let claimedCode: string | null = null;

  if (code) {
    // ── Invite path: the code authorizes immediate access ────────────────────
    const { data: claimRows, error: claimError } = await supabase
      .rpc('claim_staff_invitation', { p_code: code });

    const claim = Array.isArray(claimRows) ? claimRows[0] : claimRows;

    if (claimError || !claim) {
      return NextResponse.json(
        { error: 'This invitation link is invalid, expired, or has already been used.' },
        { status: 400 }
      );
    }

    businessId = claim.business_id;
    businessRole = claim.business_role;
    status = 'active';
    claimedCode = code;
  } else {
    // ── Open path: request access, pending approval ──────────────────────────
    if (!commandCenterId) {
      return NextResponse.json(
        { error: 'Please choose the command center you are joining.' },
        { status: 400 }
      );
    }

    // Never let someone register themselves into a delivery business by id.
    const { data: isCommandCenter, error: checkError } = await supabase
      .rpc('is_emergency_command_center', { p_business_id: commandCenterId });

    if (checkError || !isCommandCenter) {
      return NextResponse.json(
        { error: 'That command center could not be found.' },
        { status: 400 }
      );
    }

    businessId = commandCenterId;
    status = 'pending';
  }

  // Hand the invite back if we fail after claiming it.
  const releaseClaim = async () => {
    if (!claimedCode) return;
    await supabase
      .from('staff_invitation_codes')
      .update({ current_uses: 0, is_active: true })
      .eq('code', claimedCode)
      .eq('current_uses', 1)
      .eq('max_uses', 1);
  };

  // ── Create the auth user ───────────────────────────────────────────────────
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    phone: phone || undefined,
    email_confirm: true,
    user_metadata: {
      first_name: firstName,
      last_name: lastName,
      user_type: 'business',
    },
  });

  if (authError || !authData?.user) {
    await releaseClaim();
    const alreadyExists = authError?.message?.toLowerCase().includes('already');
    return NextResponse.json(
      {
        error: alreadyExists
          ? 'An account with this email already exists. Sign in instead.'
          : 'Could not create the account. Please try again.',
      },
      { status: alreadyExists ? 409 : 500 }
    );
  }

  const userId = authData.user.id;

  // ── Link the profile to the command center ─────────────────────────────────
  // A trigger may already have created the row, so upsert rather than insert.
  const { error: profileError } = await supabase
    .from('user_profiles')
    .upsert(
      {
        id: userId,
        first_name: firstName,
        last_name: lastName,
        phone_number: phone || null,
        user_type: 'business',
        status,
        business_id: businessId,
        business_role: businessRole,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

  if (profileError) {
    console.error('dispatcher/register: profile link failed', profileError);
    await supabase.auth.admin.deleteUser(userId);
    await releaseClaim();
    return NextResponse.json(
      { error: 'Could not complete registration. Please try again.' },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { data: { userId, status, businessRole } },
    { status: 201 }
  );
}
