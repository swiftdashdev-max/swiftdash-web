/**
 * GET /api/v1/emergency/status/{trackingToken} — poll an incident's progress.
 *
 * Called by the citizen app every 15–30s while an incident is active. Polling
 * rather than push, so the citizen app needs no backend, no signature
 * verification and no delivery guarantees — a dropped response simply retries
 * on the next tick.
 *
 * Returns only what the reporter needs to see. Reporter PII is deliberately
 * absent: the app already holds it (it sent it), and the tracking token is a
 * bearer secret that may be shared onward.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api-auth';
import { getServiceClient } from '@/lib/supabase-service';

/** Statuses after which the app should stop polling. */
const TERMINAL = ['resolved', 'cancelled', 'rejected'];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const start = Date.now();

  const auth = await authenticateApiKey(req.headers.get('x-api-key'));
  if (!auth?.accountId) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'INVALID_API_KEY' },
      { status: 401 }
    );
  }

  const { token } = await params;
  if (!token || token.length < 32) {
    return NextResponse.json(
      { error: 'Report not found', code: 'NOT_FOUND' },
      { status: 404 }
    );
  }

  const supabase = getServiceClient();

  const { data: incident, error } = await supabase
    .from('emergency_incidents')
    .select(`
      id, reference_number, status, agency_code,
      command_center_id, dispatched_at, accepted_at, on_scene_at, resolved_at,
      closure_reason, updated_at,
      incident_assignments ( unit_callsign, agency_code, status, eta_minutes )
    `)
    .eq('tracking_token', token)
    .maybeSingle();

  if (error) {
    console.error('emergency/status: lookup failed', error);
    return NextResponse.json(
      { error: 'Could not read the report status.', code: 'LOOKUP_FAILED' },
      { status: 500 }
    );
  }

  // Same 404 whether the token is wrong or belongs to another command center —
  // distinguishing them would let a caller probe for valid tokens.
  if (!incident || incident.command_center_id !== auth.accountId) {
    return NextResponse.json(
      { error: 'Report not found', code: 'NOT_FOUND' },
      { status: 404 }
    );
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://swiftdashdms.com';

  // An incident can have several units. Show only those still coming or on
  // scene — a unit that declined is internal churn the reporter shouldn't see.
  type Assignment = {
    unit_callsign: string | null;
    agency_code: string | null;
    status: string;
    eta_minutes: number | null;
  };

  const assignments = (incident.incident_assignments ?? []) as unknown as Assignment[];
  const active = assignments.filter(a =>
    ['dispatched', 'en_route', 'on_scene'].includes(a.status)
  );

  const etas = active.map(a => a.eta_minutes).filter((n): n is number => typeof n === 'number');
  const soonestEta = etas.length > 0 ? Math.min(...etas) : null;

  return NextResponse.json(
    {
      referenceNumber: incident.reference_number,
      status:          incident.status,
      isActive:        !TERMINAL.includes(incident.status),
      agency:          incident.agency_code,
      units: active.map(a => ({
        callsign:   a.unit_callsign,
        agency:     a.agency_code,
        status:     a.status,
        etaMinutes: a.eta_minutes,
      })),
      // The soonest arrival is what the person waiting actually cares about.
      etaMinutes:      soonestEta,
      closureReason:   incident.closure_reason,
      timestamps: {
        dispatched: incident.dispatched_at,
        accepted:   incident.accepted_at,
        onScene:    incident.on_scene_at,
        resolved:   incident.resolved_at,
      },
      trackingUrl: `${origin}/track/emergency/${token}`,
      updatedAt:   incident.updated_at,
    },
    {
      status: 200,
      headers: {
        'x-response-time': `${Date.now() - start}ms`,
        // Status must never be served stale — a cached "submitted" while a
        // responder is already on scene is worse than an extra round trip.
        'Cache-Control': 'no-store',
      },
    }
  );
}
