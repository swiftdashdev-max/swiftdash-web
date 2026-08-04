/**
 * POST /api/emergency/stand-down — a dispatcher recalls a unit they sent.
 *
 * Distinct from a responder declining. A decline says "I can't take this"; a
 * stand-down says "you're no longer needed, the situation changed". Both free
 * the unit, and both are recorded, but they mean different things when the
 * incident is reviewed afterwards.
 *
 * Standing down the last live unit returns the incident to the waiting queue —
 * an incident is never silently closed by removing units from it.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateDispatcher } from '@/lib/emergency-auth';
import { getServiceClient } from '@/lib/supabase-service';

const LIVE = ['dispatched', 'en_route', 'on_scene'];

export async function POST(req: NextRequest) {
  const auth = await authenticateDispatcher();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: { assignmentId?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { assignmentId, reason } = body;
  if (!assignmentId) {
    return NextResponse.json({ error: 'assignmentId is required.' }, { status: 400 });
  }

  const supabase = getServiceClient();

  const { data: assignment } = await supabase
    .from('incident_assignments')
    .select('id, status, incident_id, unit_callsign, emergency_incidents!inner(command_center_id)')
    .eq('id', assignmentId)
    .maybeSingle();

  type WithIncident = { command_center_id: string } | { command_center_id: string }[];
  const parent = assignment?.emergency_incidents as WithIncident | undefined;
  const ownerId = Array.isArray(parent) ? parent[0]?.command_center_id : parent?.command_center_id;

  if (!assignment || ownerId !== auth.dispatcher.commandCenterId) {
    return NextResponse.json({ error: 'Assignment not found.' }, { status: 404 });
  }

  if (!LIVE.includes(assignment.status)) {
    return NextResponse.json(
      { error: `That unit is already ${assignment.status}.`, code: 'NOT_LIVE' },
      { status: 409 }
    );
  }

  // Guarded on status so two dispatchers clicking at once produce one change,
  // not two conflicting ones. The database trigger recalculates the incident.
  const { data: updated, error } = await supabase
    .from('incident_assignments')
    .update({
      status: 'stood_down',
      closed_at: new Date().toISOString(),
      close_reason: reason?.slice(0, 500) || 'Stood down by dispatcher',
      updated_at: new Date().toISOString(),
    })
    .eq('id', assignmentId)
    .in('status', LIVE)
    .select('id, status, unit_callsign')
    .maybeSingle();

  if (error) {
    console.error('emergency/stand-down: update failed', error);
    return NextResponse.json({ error: 'Could not stand the unit down.' }, { status: 500 });
  }

  if (!updated) {
    return NextResponse.json(
      { error: 'That unit changed status while you were working. Refresh and try again.', code: 'CONFLICT' },
      { status: 409 }
    );
  }

  await supabase.from('emergency_incident_events').insert({
    incident_id: assignment.incident_id,
    event_type: 'stood_down',
    actor_id: auth.dispatcher.userId,
    actor_role: 'dispatcher',
    note: `${updated.unit_callsign ?? 'Unit'} stood down${reason ? `: ${reason.slice(0, 300)}` : ''}`,
  });

  const { data: incident } = await supabase
    .from('emergency_incidents')
    .select('reference_number, status')
    .eq('id', assignment.incident_id)
    .single();

  return NextResponse.json({ data: { assignment: updated, incident } });
}
