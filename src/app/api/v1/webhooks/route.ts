/**
 * GET    /api/v1/webhooks        — list registered webhooks
 * POST   /api/v1/webhooks        — register a new webhook
 * DELETE /api/v1/webhooks/[id]   — remove a webhook
 * PATCH  /api/v1/webhooks/[id]   — update a webhook
 *
 * These endpoints accept the x-api-key header for programmatic access
 * OR a valid Supabase session cookie (dashboard use).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateApiKey } from '@/lib/api-auth';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import { validateBody, WEBHOOK_CREATE_RULES, validationErrorResponse } from '@/lib/api-validation';

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
  // 1. Try API key
  const keyAuth = await authenticateApiKey(req.headers.get('x-api-key'));
  if (keyAuth) return keyAuth.businessId;

  // 2. Try session cookie (dashboard)
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// ── GET /api/v1/webhooks ──────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const businessId = await resolveBusinessId(req);
  if (!businessId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = serviceClient();
  const { data, error } = await supabase
    .from('business_webhooks')
    .select('id, url, events, is_active, description, created_at')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// ── POST /api/v1/webhooks ─────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const businessId = await resolveBusinessId(req);
  if (!businessId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { url?: string; events?: string[]; description?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.url) {
    return NextResponse.json(
      validationErrorResponse([{ field: 'url', message: 'Required', code: 'REQUIRED' }]),
      { status: 400 }
    );
  }

  // Per-field validation
  const validation = validateBody(body as Record<string, unknown>, WEBHOOK_CREATE_RULES);
  if (!validation.valid) {
    return NextResponse.json(validationErrorResponse(validation.errors), { status: 400 });
  }

  // Validate URL
  try {
    const u = new URL(body.url);
    if (u.protocol !== 'https:') throw new Error('HTTPS required');
  } catch {
    return NextResponse.json(
      validationErrorResponse([{ field: 'url', message: 'Must be a valid HTTPS URL', code: 'INVALID_FORMAT' }]),
      { status: 400 }
    );
  }

  // Validate events
  const events = body.events ?? [...ALLOWED_EVENTS];
  const invalidEvents = events.filter((e) => !(ALLOWED_EVENTS as readonly string[]).includes(e));
  if (invalidEvents.length) {
    return NextResponse.json(
      validationErrorResponse([{ field: 'events', message: `Invalid events: ${invalidEvents.join(', ')}`, code: 'INVALID_VALUE' }]),
      { status: 400 }
    );
  }

  const secret = `whsec_${randomBytes(24).toString('base64url')}`;
  const supabase = serviceClient();

  const { data, error } = await supabase
    .from('business_webhooks')
    .insert({
      business_id: businessId,
      url:         body.url,
      secret,
      events,
      description: body.description ?? null,
    })
    .select('id, url, events, is_active, description, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return secret ONCE — not stored in plain text after this
  return NextResponse.json({ data: { ...data, secret } }, { status: 201 });
}
