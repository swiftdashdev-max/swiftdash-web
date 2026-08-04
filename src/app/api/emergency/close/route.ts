/**
 * POST /api/emergency/close — a dispatcher closes out an incident.
 *
 * Three outcomes, and the difference between them is the record, not the
 * mechanics:
 *   resolved  — it was real and it was dealt with
 *   cancelled — it was real but no longer needs a response
 *   rejected  — it was not a genuine emergency
 *
 * Closing settles the units first, then the incident. That order matters: the
 * incident's status is derived from its units by a database trigger, so leaving
 * a unit live would have the trigger pull the incident straight back open.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateDispatcher } from '@/lib/emergency-auth';
import { getServiceClient } from '@/lib/supabase-service';

const LIVE = ['dispatched', 'en_route', 'on_scene'];
const OUTCOMES = ['resolved', 'cancelled', 'rejected'] as const;
type Outcome = (typeof OUTCOMES)[number];

export async function POST(req: NextRequest) {
  const auth = await authenticateDispatcher();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: { incidentId?: string; outcome?: string; notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { incidentId, notes } = body;
  const outcome = body.outcome as Outcome | undefined;

  if (!incidentId || !outcome || !OUTCOMES.includes(outcome)) {
    return NextResponse.json(
      { error: 'incidentId and a valid outcome are required.' },
      { status: 400 }
    );
  }

  if (outcome === 'rejected' && !notes?.trim()) {
    return NextResponse.json(
      { error: 'Say why this report was rejected — it is the only record of the decision.' },
      { status: 400 }
    );
  }

  const supabase = getServiceClient();

  const { data: incident } = await supabase
    .from('emergency_incidents')
    .select('id, status, command_center_id, reference_number')
    .eq('id', incidentId)
    .maybeSingle();

  if (!incident || incident.command_center_id !== auth.dispatcher.commandCenterId) {
    return NextResponse.json({ error: 'Incident not found.' }, { status: 404 });
  }

  if (['resolved', 'cancelled', 'rejected'].includes(incident.status)) {
    return NextResponse.json(
      { error: `This incident is already ${incident.status}.`, code: 'ALREADY_CLOSED' },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();

  // A unit that reached the scene did the work, so it is recorded as having
  // resolved. A unit still travelling when the call was cancelled did not, so
  // it is stood down. The distinction is what makes response statistics honest.
  const { data: liveUnits } = await supabase
    .from('incident_assignments')
    .select('id, status, unit_callsign')
    .eq('incident_id', incidentId)
    .in('status', LIVE);

  for (const unit of liveUnits ?? []) {
    const settled =
      outcome === 'resolved' || unit.status === 'on_scene' ? 'resolved' : 'stood_down';

    const { error } = await supabase
      .from('incident_assignments')
      .update({
        status: settled,
        closed_at: now,
        close_reason:
          settled === 'resolved'
            ? notes?.slice(0, 500) || 'Closed by dispatcher'
            : `Incident ${outcome} by dispatcher`,
        updated_at: now,
      })
      .eq('id', unit.id)
      .in('status', LIVE);

    if (error) {
      console.error('emergency/close: could not settle unit', unit.id, error);
      return NextResponse.json(
        { error: 'Could not close the incident — some units are still assigned.' },
        { status: 500 }
      );
    }
  }

  // The trigger has already moved the incident by now: to 'resolved' if units
  // resolved, or back to 'submitted' if they were all stood down. This write
  // states the dispatcher's actual decision, and recalc_incident_status leaves
  // 'cancelled' and 'rejected' alone from here on.
  const { data: closed, error: closeError } = await supabase
    .from('emergency_incidents')
    .update({
      status: outcome,
      closure_reason: notes?.slice(0, 500) || null,
      resolution_notes: outcome === 'resolved' ? notes?.slice(0, 2000) || null : null,
      // Only a resolved incident has a resolved_at. A cancelled or rejected one
      // was never resolved, and stamping it would corrupt response statistics.
      ...(outcome === 'resolved' ? { resolved_at: now } : {}),
      updated_at: now,
    })
    .eq('id', incidentId)
    .select('id, reference_number, status, closure_reason')
    .single();

  if (closeError) {
    console.error('emergency/close: incident update failed', closeError);
    return NextResponse.json({ error: 'Could not close the incident.' }, { status: 500 });
  }

  await supabase.from('emergency_incident_events').insert({
    incident_id: incidentId,
    event_type: 'closed',
    from_status: incident.status,
    to_status: outcome,
    actor_id: auth.dispatcher.userId,
    actor_role: 'dispatcher',
    note: notes?.slice(0, 500) || `Closed as ${outcome}`,
  });

  return NextResponse.json({ data: closed });
}
