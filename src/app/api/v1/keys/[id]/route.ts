/**
 * DELETE /api/v1/keys/[id]  — revoke an API key
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getSessionUser(): Promise<string | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const businessId = await getSessionUser();
  if (!businessId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const supabase = serviceClient();

  const { data, error } = await supabase
    .from('business_api_keys')
    .update({ is_active: false, revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('business_id', businessId)
    .select('id, name, key_prefix, is_active, revoked_at')
    .single();

  if (error || !data) return NextResponse.json({ error: 'API key not found' }, { status: 404 });
  return NextResponse.json({ data });
}
