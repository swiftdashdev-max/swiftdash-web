/**
 * PATCH  /api/v1/webhooks/[id]  — update url / events / is_active / description
 * DELETE /api/v1/webhooks/[id]  — remove webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateApiKey } from '@/lib/api-auth';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { validateBody, WEBHOOK_UPDATE_RULES, validationErrorResponse } from '@/lib/api-validation';

const ALLOWED_EVENTS = [
  'delivery.created',
  'delivery.driver_assigned',
  'delivery.pickup_arrived',
  'delivery.package_collected',
  'delivery.in_transit',
  'delivery.delivered',
  'delivery.cancelled',
  'delivery.failed',
] as const;

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function resolveBusinessId(req: NextRequest): Promise<string | null> {
  const keyAuth = await authenticateApiKey(req.headers.get('x-api-key'));
  if (keyAuth) return keyAuth.businessId;

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

// ── PATCH /api/v1/webhooks/[id] ───────────────────────────────────────────────
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const businessId = await resolveBusinessId(req);
  if (!businessId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;

  let body: { url?: string; events?: string[]; is_active?: boolean; description?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Per-field validation
  const validation = validateBody(body as Record<string, unknown>, WEBHOOK_UPDATE_RULES);
  if (!validation.valid) {
    return NextResponse.json(validationErrorResponse(validation.errors), { status: 400 });
  }

  if (body.events) {
    const invalid = body.events.filter((e) => !(ALLOWED_EVENTS as readonly string[]).includes(e));
    if (invalid.length) {
      return NextResponse.json(
        validationErrorResponse([{ field: 'events', message: `Invalid events: ${invalid.join(', ')}`, code: 'INVALID_VALUE' }]),
        { status: 400 }
      );
    }
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.url         !== undefined) patch.url         = body.url;
  if (body.events      !== undefined) patch.events      = body.events;
  if (body.is_active   !== undefined) patch.is_active   = body.is_active;
  if (body.description !== undefined) patch.description = body.description;

  const supabase = serviceClient();
  const { data, error } = await supabase
    .from('business_webhooks')
    .update(patch)
    .eq('id', id)
    .eq('business_id', businessId)
    .select('id, url, events, is_active, description, updated_at')
    .single();

  if (error || !data) return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
  return NextResponse.json({ data });
}

// ── DELETE /api/v1/webhooks/[id] ──────────────────────────────────────────────
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const businessId = await resolveBusinessId(req);
  if (!businessId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const supabase = serviceClient();

  const { error } = await supabase
    .from('business_webhooks')
    .delete()
    .eq('id', id)
    .eq('business_id', businessId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
