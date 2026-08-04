/**
 * POST /api/v1/emergency/report — a citizen app files an emergency report.
 *
 * Called by the MY Roxas citizen app. The API key identifies which command
 * center receives the report; the citizen themselves is not authenticated.
 *
 * Guiding rule throughout: **a real emergency must never be rejected by a
 * machine.** Anything suspicious is flagged for a dispatcher to judge, not
 * blocked. The only hard rejections are "outside the service area entirely"
 * and "the request is malformed".
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api-auth';
import { getServiceClient } from '@/lib/supabase-service';
import {
  validateBody,
  EMERGENCY_REPORT_RULES,
  validationErrorResponse,
} from '@/lib/api-validation';

/** Distance in metres between two points. */
function distanceMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

/** How far the pinned location may sit from the reporter's own GPS fix. */
const MAX_PIN_DISTANCE_M = 200;

/** Reports from one device within 24h before it is flagged (never blocked). */
const REVIEW_THRESHOLD_24H = 3;

const AGENCY_FOR_TYPE: Record<string, string> = {
  medical: 'CDRRMO_AMBULANCE',
  fire:    'BFP',
  crime:   'PNP',
};

export async function POST(req: NextRequest) {
  const start = Date.now();

  // ── 1. Authenticate the calling app ────────────────────────────────────────
  const auth = await authenticateApiKey(req.headers.get('x-api-key'));
  if (!auth) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'INVALID_API_KEY' },
      { status: 401 }
    );
  }

  const commandCenterId = auth.accountId;
  if (!commandCenterId) {
    return NextResponse.json(
      { error: 'This API key is not linked to an account.', code: 'INVALID_API_KEY' },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', code: 'INVALID_BODY' },
      { status: 400 }
    );
  }

  const validation = validateBody(body, EMERGENCY_REPORT_RULES);
  if (!validation.valid) {
    return NextResponse.json(validationErrorResponse(validation.errors), { status: 400 });
  }

  const supabase = getServiceClient();

  // ── 2. Only emergency accounts may file incidents ──────────────────────────
  // Without this, any existing delivery business could point their key here and
  // inject incidents into a command center's queue.
  const { data: isCommandCentre } = await supabase
    .rpc('is_emergency_command_center', { p_business_id: commandCenterId });

  if (!isCommandCentre) {
    return NextResponse.json(
      { error: 'This API key is not authorized for emergency reporting.', code: 'NOT_AUTHORIZED' },
      { status: 403 }
    );
  }

  const incidentType = body.incidentType as string;
  const incidentLat  = body.incidentLat as number;
  const incidentLng  = body.incidentLng as number;
  const deviceId     = body.deviceId as string;
  const deviceLat    = typeof body.deviceLat === 'number' ? body.deviceLat : null;
  const deviceLng    = typeof body.deviceLng === 'number' ? body.deviceLng : null;
  const isAnonymous  = body.isAnonymous === true;

  // ── 3. Geofence ────────────────────────────────────────────────────────────
  // The one legitimate hard rejection: the incident is not in this city's region
  // at all, so this command center genuinely cannot respond to it.
  const { data: withinArea, error: geofenceError } = await supabase
    .rpc('is_within_service_area', {
      p_business_id: commandCenterId,
      p_lat: incidentLat,
      p_lng: incidentLng,
    });

  if (geofenceError) {
    // Fail open — never lose a report to an infrastructure hiccup.
    console.error('emergency/report: geofence check failed, allowing through', geofenceError);
  } else if (withinArea === false) {
    return NextResponse.json(
      {
        error: 'This location is outside the area this command center covers. Please call your local emergency hotline directly.',
        code: 'OUTSIDE_SERVICE_AREA',
      },
      { status: 422 }
    );
  }

  // ── 4. Pin-distance and abuse signals — flag, never block ──────────────────
  const reviewReasons: string[] = [];

  if (deviceLat !== null && deviceLng !== null) {
    const drift = distanceMetres(deviceLat, deviceLng, incidentLat, incidentLng);
    if (drift > MAX_PIN_DISTANCE_M) {
      reviewReasons.push(`Pin is ${Math.round(drift)}m from the reporter's GPS fix`);
    }
  } else {
    reviewReasons.push('No device GPS fix supplied — location unverified');
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: recentCount } = await supabase
    .from('emergency_incidents')
    .select('id', { count: 'exact', head: true })
    .eq('device_id', deviceId)
    .gte('created_at', since);

  const reportsIn24h = recentCount ?? 0;
  if (reportsIn24h >= REVIEW_THRESHOLD_24H) {
    reviewReasons.push(`${reportsIn24h} reports from this device in 24h`);
  }

  // ── 5. Create the incident, retrying on reference-number collision ─────────
  const record = {
    incident_type:           incidentType,
    description:             (body.description as string) ?? null,
    incident_lat:            incidentLat,
    incident_lng:            incidentLng,
    device_lat:              deviceLat,
    device_lng:              deviceLng,
    address:                 (body.address as string) ?? null,
    landmark:                (body.landmark as string) ?? null,
    reporter_name:           isAnonymous ? null : ((body.reporterName as string) ?? null),
    reporter_phone:          isAnonymous ? null : ((body.reporterPhone as string) ?? null),
    device_id:               deviceId,
    is_anonymous:            isAnonymous,
    command_center_id:       commandCenterId,
    agency_code:             AGENCY_FOR_TYPE[incidentType] ?? null,
    status:                  'submitted',
    reports_from_device_24h: reportsIn24h,
    flagged_for_review:      reviewReasons.length > 0,
    api_key_id:              auth.keyId,
  };

  let incident: { id: string; reference_number: string; tracking_token: string } | null = null;
  let lastError: unknown = null;

  // reference_number is 6 hex chars from a DB default; a collision is rare but
  // possible, and a citizen should never see an error because of one.
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase
      .from('emergency_incidents')
      .insert(record)
      .select('id, reference_number, tracking_token')
      .single();

    if (!error && data) {
      incident = data;
      break;
    }

    lastError = error;
    if (error?.code !== '23505') break;   // not a collision — don't retry
  }

  if (!incident) {
    console.error('emergency/report: insert failed', lastError);
    return NextResponse.json(
      { error: 'Could not file the report. Please call your emergency hotline directly.', code: 'REPORT_FAILED' },
      { status: 500 }
    );
  }

  // Record why it was flagged, so the dispatcher sees the reason rather than a
  // bare flag with no explanation.
  //
  // Awaited deliberately: fire-and-forget work can be killed when a serverless
  // function returns its response, and "flagged, reason unknown" is close to
  // useless to someone deciding whether to send an ambulance. Costs a few ms.
  if (reviewReasons.length > 0) {
    const { error: noteError } = await supabase
      .from('emergency_incident_events')
      .insert({
        incident_id: incident.id,
        event_type:  'note',
        actor_role:  'system',
        note:        `Flagged for review — ${reviewReasons.join('; ')}`,
      });

    // Never fail the report over its own annotation — the incident is what matters.
    if (noteError) console.error('emergency/report: flag note failed', noteError);
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://swiftdashdms.com';

  // No Ably publish here by design: the console subscribes to this table over
  // Supabase Realtime, so there is no step between saving the report and a
  // dispatcher seeing it that can fail silently.
  return NextResponse.json(
    {
      reportId:        incident.id,
      referenceNumber: incident.reference_number,
      status:          'submitted',
      agency:          record.agency_code,
      trackingUrl:     `${origin}/track/emergency/${incident.tracking_token}`,
    },
    { status: 201, headers: { 'x-response-time': `${Date.now() - start}ms` } }
  );
}
