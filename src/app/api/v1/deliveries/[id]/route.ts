/**
 * GET    /api/v1/deliveries/[id]  — get single delivery
 * DELETE /api/v1/deliveries/[id]  — cancel a delivery
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateApiKey } from '@/lib/api-auth';
import { dispatchWebhook } from '@/lib/webhook-dispatcher';

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

type RouteContext = { params: Promise<{ id: string }> };

// ── GET /api/v1/deliveries/[id] ───────────────────────────────────────────────
export async function GET(req: NextRequest, ctx: RouteContext) {
  const auth = await authenticateApiKey(req.headers.get('x-api-key'));
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized', code: 'INVALID_API_KEY' }, { status: 401 });
  }

  const { id } = await ctx.params;
  const supabase = serviceClient();

  const { data, error } = await supabase
    .from('deliveries')
    .select(`
      id, status,
      pickup_address, pickup_latitude, pickup_longitude,
      pickup_contact_name, pickup_contact_phone, pickup_instructions,
      delivery_address, delivery_latitude, delivery_longitude,
      delivery_contact_name, delivery_contact_phone, delivery_instructions,
      package_description, package_weight, package_value,
      distance_km, total_price,
      payment_method, payment_status, payment_by,
      driver_id, created_at, updated_at, completed_at,
      vehicle_types (id, name)
    `)
    .eq('id', id)
    .or(`customer_id.eq.${auth.businessId},business_id.eq.${auth.accountId ?? auth.businessId}`)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Delivery not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  return NextResponse.json({ data });
}

// ── DELETE /api/v1/deliveries/[id]  (cancel) ─────────────────────────────────
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const auth = await authenticateApiKey(req.headers.get('x-api-key'));
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized', code: 'INVALID_API_KEY' }, { status: 401 });
  }

  const { id } = await ctx.params;
  const supabase = serviceClient();

  // Fetch current status first
  const { data: current, error: fetchErr } = await supabase
    .from('deliveries')
    .select('id, status, customer_id, business_id')
    .eq('id', id)
    .or(`customer_id.eq.${auth.businessId},business_id.eq.${auth.accountId ?? auth.businessId}`)
    .single();

  if (fetchErr || !current) {
    return NextResponse.json({ error: 'Delivery not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  // Can only cancel pending / driver_assigned deliveries
  const cancellable = ['pending', 'driver_assigned'];
  if (!cancellable.includes(current.status)) {
    return NextResponse.json(
      {
        error: `Cannot cancel a delivery with status "${current.status}"`,
        code: 'INVALID_STATUS_TRANSITION',
      },
      { status: 409 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const reason: string = (body as { reason?: string }).reason ?? 'Cancelled via API';

  const { data: updated, error: updateErr } = await supabase
    .from('deliveries')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (updateErr || !updated) {
    return NextResponse.json({ error: 'Failed to cancel delivery' }, { status: 500 });
  }

  // Fire webhook
  dispatchWebhook(auth.businessId, 'delivery.cancelled', id, { ...updated, cancellation_reason: reason }).catch(() => {});

  return NextResponse.json({ data: updated });
}
