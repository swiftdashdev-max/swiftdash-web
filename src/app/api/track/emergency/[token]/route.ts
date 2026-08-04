/**
 * GET /api/track/emergency/{token} — public status for one incident.
 *
 * Deliberately unauthenticated. The citizen watching this has no account and no
 * API key, and must never be given one; the tracking token IS the credential.
 * It is 64 random hex characters, so it cannot be guessed.
 *
 * Distinct from /api/v1/emergency/status/{token}, which is the MY Roxas app's
 * server-to-server view and requires a key. This one is for a browser.
 *
 * What it leaves out matters as much as what it returns. A tracking link is a
 * bearer secret that people forward — to family, to neighbours, into group
 * chats. So this never carries reporter name or phone (whoever reported it
 * already knows), never the free-text description (on a crime report that is
 * narrative detail a forwarded link has no business holding), and nothing about
 * any other incident.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-service';

export const preferredRegion = ['sin1'];

/** Statuses after which the page should stop polling. */
const TERMINAL = ['resolved', 'cancelled', 'rejected'];

/** Assignment states that mean a unit is actually coming or already there. */
const LIVE = ['dispatched', 'en_route', 'on_scene'];

/** A position older than this is not worth drawing on a map. */
const STALE_FIX_MS = 5 * 60_000;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Tracking tokens are long. A short one is not a near miss, so it is refused
  // without touching the database.
  if (!token || token.length < 32) {
    return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  const supabase = getServiceClient();

  const { data: incident, error } = await supabase
    .from('emergency_incidents')
    .select(`
      id, reference_number, status, incident_type, agency_code,
      address, landmark, incident_lat, incident_lng,
      created_at, dispatched_at, accepted_at, on_scene_at, resolved_at, updated_at,
      command_center_id,
      incident_assignments ( responder_id, unit_callsign, agency_code, status, eta_minutes )
    `)
    .eq('tracking_token', token)
    .maybeSingle();

  if (error) {
    console.error('track/emergency: lookup failed', error);
    return NextResponse.json(
      { error: 'Could not read this report right now.', code: 'LOOKUP_FAILED' },
      { status: 500 }
    );
  }

  if (!incident) {
    return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  type Assignment = {
    responder_id: string;
    unit_callsign: string | null;
    agency_code: string | null;
    status: string;
    eta_minutes: number | null;
  };

  const assignments = (incident.incident_assignments ?? []) as unknown as Assignment[];
  const live = assignments.filter((a) => LIVE.includes(a.status));

  // Who to call if this page is not enough. Coming from the command center's
  // own record rather than hard-coded, so it stays right per city.
  const { data: centre } = await supabase
    .from('business_accounts')
    .select('business_name, business_phone')
    .eq('id', incident.command_center_id)
    .maybeSingle();

  // Live positions for units that are actually en route. A unit standing at the
  // station is not interesting, and a stale fix is worse than none — it would
  // draw an ambulance somewhere it has long since left.
  let positions: Array<{ callsign: string | null; lat: number; lng: number }> = [];

  if (live.length > 0) {
    const { data: drivers } = await supabase
      .from('driver_profiles')
      .select('id, current_latitude, current_longitude, location_updated_at')
      .in('id', live.map((a) => a.responder_id));

    const now = Date.now();
    positions = (drivers ?? [])
      .filter(
        (d) =>
          d.current_latitude != null &&
          d.current_longitude != null &&
          d.location_updated_at != null &&
          now - new Date(d.location_updated_at).getTime() < STALE_FIX_MS
      )
      .map((d) => ({
        callsign: live.find((a) => a.responder_id === d.id)?.unit_callsign ?? null,
        lat: Number(d.current_latitude),
        lng: Number(d.current_longitude),
      }));
  }

  const etas = live
    .map((a) => a.eta_minutes)
    .filter((n): n is number => typeof n === 'number');

  return NextResponse.json(
    {
      referenceNumber: incident.reference_number,
      /**
       * The live channel for this incident, named by the server rather than
       * assembled in the browser. The page should never have to know the naming
       * convention, and the Ably token endpoint grants exactly this channel.
       */
      channel:         `tracking:${incident.id}`,
      status:          incident.status,
      isActive:        !TERMINAL.includes(incident.status),
      incidentType:    incident.incident_type,
      agency:          incident.agency_code,
      address:         incident.address,
      landmark:        incident.landmark,
      location:        { lat: Number(incident.incident_lat), lng: Number(incident.incident_lng) },
      units: live.map((a) => ({
        callsign:   a.unit_callsign,
        agency:     a.agency_code,
        status:     a.status,
        etaMinutes: a.eta_minutes,
      })),
      /** The soonest arrival is what the person waiting actually cares about. */
      etaMinutes: etas.length > 0 ? Math.min(...etas) : null,
      positions,
      commandCenter: {
        name:  centre?.business_name ?? 'Emergency Command Center',
        phone: centre?.business_phone ?? null,
      },
      timestamps: {
        reported:   incident.created_at,
        dispatched: incident.dispatched_at,
        accepted:   incident.accepted_at,
        onScene:    incident.on_scene_at,
        resolved:   incident.resolved_at,
      },
      updatedAt: incident.updated_at,
    },
    {
      status: 200,
      headers: {
        // Never serve this stale. A cached "waiting" while a unit is already on
        // scene is worse than an extra round trip.
        'Cache-Control': 'no-store',
      },
    }
  );
}
