/**
 * GET  /api/v1/deliveries  — list deliveries for the authenticated business
 * POST /api/v1/deliveries  — create a new delivery
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateApiKey } from '@/lib/api-auth';
import { dispatchWebhook } from '@/lib/webhook-dispatcher';
import { validateBody, DELIVERY_CREATE_RULES, validationErrorResponse } from '@/lib/api-validation';

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// ── GET /api/v1/deliveries ────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req.headers.get('x-api-key'));
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized', code: 'INVALID_API_KEY' }, { status: 401 });
  }

  const supabase = serviceClient();
  const { searchParams } = new URL(req.url);

  const status    = searchParams.get('status');
  const limit     = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100);
  const offset    = parseInt(searchParams.get('offset') ?? '0');
  const from_date = searchParams.get('from');
  const to_date   = searchParams.get('to');

  let query = supabase
    .from('deliveries')
    .select(`
      id, status, pickup_address, delivery_address,
      pickup_contact_name, pickup_contact_phone,
      delivery_contact_name, delivery_contact_phone,
      package_description, distance_km, total_price,
      payment_method, payment_status,
      created_at, updated_at, completed_at,
      driver_id,
      vehicle_types (id, name)
    `, { count: 'exact' })
    .eq('business_id', auth.accountId ?? auth.businessId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status)    query = query.eq('status', status);
  if (from_date) query = query.gte('created_at', from_date);
  if (to_date)   query = query.lte('created_at', to_date);

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data, count, limit, offset });
}

// ── POST /api/v1/deliveries ───────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req.headers.get('x-api-key'));
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized', code: 'INVALID_API_KEY' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_BODY' }, { status: 400 });
  }

  // ── Validate required fields ─────────────────────────────────────────────
  const validation = validateBody(body, DELIVERY_CREATE_RULES);
  if (!validation.valid) {
    return NextResponse.json(validationErrorResponse(validation.errors), { status: 400 });
  }

  const supabase = serviceClient();

  // ── Validate vehicle type ────────────────────────────────────────────────
  const { data: vt, error: vtErr } = await supabase
    .from('vehicle_types')
    .select('id, name, base_price, price_per_km, is_active')
    .eq('id', body.vehicleTypeId as string)
    .single();

  if (vtErr || !vt) {
    return NextResponse.json({ error: 'Invalid vehicle type', code: 'INVALID_VEHICLE_TYPE' }, { status: 400 });
  }
  if (!vt.is_active) {
    return NextResponse.json({ error: 'Vehicle type is not available', code: 'INVALID_VEHICLE_TYPE' }, { status: 400 });
  }

  // ── Calculate price (no Mapbox call for API — use provided distance or estimate) ─
  const distanceKm = typeof body.distanceKm === 'number'
    ? body.distanceKm
    : await estimateDistanceKm(
        body.pickupLat as number,  body.pickupLng as number,
        body.dropoffLat as number, body.dropoffLng as number
      );

  const basePrice     = Number(vt.base_price);
  const distanceCost  = distanceKm * Number(vt.price_per_km);
  const subtotal      = basePrice + distanceCost;
  const vat           = subtotal * 0.12;
  const totalPrice    = Math.round((subtotal + vat) * 100) / 100;

  // ── Insert delivery ──────────────────────────────────────────────────────
  const { data: delivery, error: insertErr } = await supabase
    .from('deliveries')
    .insert({
      customer_id:           auth.businessId,
      business_id:           auth.accountId,
      vehicle_type_id:       body.vehicleTypeId,
      pickup_address:        body.pickupAddress,
      pickup_latitude:       body.pickupLat,
      pickup_longitude:      body.pickupLng,
      pickup_contact_name:   body.pickupContactName,
      pickup_contact_phone:  body.pickupContactPhone,
      pickup_instructions:   body.pickupInstructions ?? null,
      delivery_address:      body.dropoffAddress,
      delivery_latitude:     body.dropoffLat,
      delivery_longitude:    body.dropoffLng,
      delivery_contact_name: body.dropoffContactName,
      delivery_contact_phone:body.dropoffContactPhone,
      delivery_instructions: body.dropoffInstructions ?? null,
      package_description:   body.packageDescription ?? null,
      package_weight:        body.packageWeightKg ?? null,
      package_value:         body.packageValue ?? null,
      distance_km:           distanceKm,
      total_price:           totalPrice,
      status:                'pending',
      payment_method:        body.paymentMethod ?? 'cash',
      payment_status:        body.paymentStatus ?? 'pending',
      payment_by:            body.paymentBy ?? 'sender',
      is_multi_stop:         false,
    })
    .select()
    .single();

  if (insertErr || !delivery) {
    return NextResponse.json({ error: insertErr?.message ?? 'Failed to create delivery' }, { status: 500 });
  }

  // ── Fire webhook (non-blocking) ──────────────────────────────────────────
  dispatchWebhook(auth.businessId, 'delivery.created', delivery.id, delivery).catch(() => {});

  return NextResponse.json({
    data: delivery,
    pricing: { base: basePrice, distance: distanceCost, subtotal, vat, total: totalPrice },
  }, { status: 201 });
}

// ── Haversine fallback distance (no external API) ────────────────────────────
function estimateDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R  = 6371;
  const dL = ((lat2 - lat1) * Math.PI) / 180;
  const dG = ((lng2 - lng1) * Math.PI) / 180;
  const a  =
    Math.sin(dL / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dG / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
