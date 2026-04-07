/**
 * GET    /api/v1/keys   — list API keys for the authenticated business (dashboard only)
 * POST   /api/v1/keys   — generate a new API key
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { generateApiKey } from '@/lib/api-auth';
import { validateBody, API_KEY_CREATE_RULES, validationErrorResponse } from '@/lib/api-validation';

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

// ── GET /api/v1/keys ──────────────────────────────────────────────────────────
export async function GET() {
  const businessId = await getSessionUser();
  if (!businessId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = serviceClient();
  const { data, error } = await supabase
    .from('business_api_keys')
    .select('id, name, key_prefix, is_active, last_used_at, created_at, revoked_at')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// ── POST /api/v1/keys ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const businessId = await getSessionUser();
  if (!businessId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { name?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const validation = validateBody(body as Record<string, unknown>, API_KEY_CREATE_RULES);
  if (!validation.valid) {
    return NextResponse.json(validationErrorResponse(validation.errors), { status: 400 });
  }

  const name = body.name!.trim();
  const result = await generateApiKey(businessId, name);

  return NextResponse.json({
    data: {
      id:       result.keyId,
      name,
      key:      result.rawKey,    // shown ONCE — user must copy it now
      prefix:   result.prefix,
      is_active: true,
      created_at: new Date().toISOString(),
    },
  }, { status: 201 });
}
