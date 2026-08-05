/**
 * POST /api/emergency/dispatch — a dispatcher assigns a unit to an incident.
 *
 * Session-authenticated (a logged-in dispatcher), not API-key authenticated —
 * this is a console action, not part of the public citizen API.
 *
 * Does four things atomically enough to be safe with several dispatchers on
 * shift at once:
 *   1. confirms the incident belongs to the dispatcher's command center
 *   2. confirms the unit is a responder in that same fleet
 *   3. snapshots the unit callsign onto the incident
 *   4. claims the incident only if nobody else already has
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getServiceClient } from '@/lib/supabase-service';

/**
 * Statuses a unit may be added to.
 *
 * Deliberately broad. Adding a second engine to an incident already `en_route`
 * is normal — you commit the first unit fast, then add as the picture develops.
 * Adding to a `resolved` incident reopens it, because fires reignite.
 */
const ASSIGNABLE = [
  'submitted', 'dispatched', 'en_route', 'on_scene',
  'resolved', 'cancelled', 'rejected',
];

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

/**
 * Driving time in minutes from the unit to the incident.
 *
 * Best-effort by design: returns null on any failure. A dispatcher must never
 * be blocked from sending an ambulance because a routing API is slow, rate
 * limited, or the token has URL restrictions that reject server-side calls.
 */
async function estimateEtaMinutes(
  fromLat: number, fromLng: number, toLat: number, toLng: number
): Promise<number | null> {
  const token =
    process.env.MAPBOX_ACCESS_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token) return null;

  try {
    const url =
      `https://api.mapbox.com/directions/v5/mapbox/driving/` +
      `${fromLng},${fromLat};${toLng},${toLat}` +
      `?overview=false&access_token=${token}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn('emergency/dispatch: mapbox returned', res.status);
      return null;
    }

    const json = await res.json();
    const seconds = json?.routes?.[0]?.duration;
    return typeof seconds === 'number' ? Math.max(1, Math.round(seconds / 60)) : null;
  } catch (err) {
    console.warn('emergency/dispatch: eta lookup failed', err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUser();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { incidentId?: string; responderId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { incidentId, responderId } = body;
  if (!incidentId || !responderId) {
    return NextResponse.json(
      { error: 'incidentId and responderId are both required.' },
      { status: 400 }
    );
  }

  const supabase = getServiceClient();

  // ── Who is this dispatcher, and which command center do they staff? ────────
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('business_id, status')
    .eq('id', userId)
    .single();

  if (!profile?.business_id || profile.status !== 'active') {
    return NextResponse.json(
      { error: 'Your account is not active for dispatch.' },
      { status: 403 }
    );
  }

  // ── The incident must belong to that command center ────────────────────────
  const { data: incident } = await supabase
    .from('emergency_incidents')
    .select('id, status, command_center_id, incident_lat, incident_lng')
    .eq('id', incidentId)
    .maybeSingle();

  if (!incident || incident.command_center_id !== profile.business_id) {
    return NextResponse.json({ error: 'Incident not found.' }, { status: 404 });
  }

  if (!ASSIGNABLE.includes(incident.status)) {
    return NextResponse.json(
      { error: `This incident cannot take another unit (${incident.status}).`, code: 'NOT_DISPATCHABLE' },
      { status: 409 }
    );
  }

  // ── The unit must be a responder in that same fleet ────────────────────────
  const { data: responder } = await supabase
    .from('driver_profiles')
    .select('id, driver_type, managed_by_business_id, current_latitude, current_longitude')
    .eq('id', responderId)
    .maybeSingle();

  if (
    !responder ||
    responder.driver_type !== 'responder' ||
    responder.managed_by_business_id !== profile.business_id
  ) {
    return NextResponse.json(
      { error: 'That unit is not an available responder for your command center.' },
      { status: 400 }
    );
  }

  // Callsign and agency live on the vehicle. Snapshot both onto the assignment
  // so history stays accurate even if the vehicle is later renamed or reassigned.
  const { data: vehicle } = await supabase
    .from('business_fleet')
    .select('unit_callsign, agency_code')
    .eq('assigned_driver_id', responderId)
    .maybeSingle();

  // ── ETA (best effort — never blocks the dispatch) ──────────────────────────
  let etaMinutes: number | null = null;
  if (responder.current_latitude != null && responder.current_longitude != null) {
    etaMinutes = await estimateEtaMinutes(
      Number(responder.current_latitude),
      Number(responder.current_longitude),
      Number(incident.incident_lat),
      Number(incident.incident_lng)
    );
  }

  // ── Create the assignment ─────────────────────────────────────────────────
  // The incident's own status is derived from its units by a database trigger,
  // so nothing here sets it. A partial unique index guarantees one live
  // assignment per unit per incident: if two dispatchers pick the same unit at
  // once, the second gets a clean 409 instead of a duplicate.
  const { data: assignment, error: assignError } = await supabase
    .from('incident_assignments')
    .insert({
      incident_id:   incidentId,
      responder_id:  responderId,
      unit_callsign: vehicle?.unit_callsign ?? null,
      agency_code:   vehicle?.agency_code ?? null,
      status:        'dispatched',
      eta_minutes:   etaMinutes,
      dispatched_by: userId,
    })
    .select('id, unit_callsign, agency_code, eta_minutes, status')
    .single();

  if (assignError) {
    // A responder may hold only one live assignment, enforced by a unique
    // partial index. Rather than report the constraint, find the call they are
    // already on — "AMB-01 is on RCE-20260804-0007" is something a dispatcher
    // can act on, where "duplicate key" is not.
    if (assignError.code === '23505') {
      const { data: busy } = await supabase
        .from('incident_assignments')
        .select('unit_callsign, emergency_incidents!inner(reference_number)')
        .eq('responder_id', responderId)
        .in('status', ['dispatched', 'en_route', 'on_scene'])
        .maybeSingle();

      type WithIncident = { reference_number: string } | { reference_number: string }[];
      const parent = busy?.emergency_incidents as WithIncident | undefined;
      const reference = Array.isArray(parent) ? parent[0]?.reference_number : parent?.reference_number;

      return NextResponse.json(
        {
          error: reference
            ? `${busy?.unit_callsign ?? 'That unit'} is already committed to ${reference}. Stand it down first if you need it here.`
            : 'That unit is already committed to another call.',
          code: 'ALREADY_ASSIGNED',
        },
        { status: 409 }
      );
    }
    console.error('emergency/dispatch: assignment failed', assignError);
    return NextResponse.json({ error: 'Could not dispatch the unit.' }, { status: 500 });
  }

  // Read back the incident status the trigger derived.
  const { data: after } = await supabase
    .from('emergency_incidents')
    .select('reference_number, status')
    .eq('id', incidentId)
    .single();

  return NextResponse.json(
    {
      data: {
        assignment,
        incident: after,
        reopened: incident.status === 'resolved' || incident.status === 'cancelled' || incident.status === 'rejected',
      },
    },
    { status: 200 }
  );
}
