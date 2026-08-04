'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  Phone,
  Radio,
  Send,
  X,
  Link2,
  ChevronDown,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { IncidentMap } from './incident-map';
import { CopyButton } from './incident-strip';
import {
  Incident,
  Unit,
  TYPE_COLOR,
  TYPE_LABEL,
  AGENCY_LABEL,
  STATUS_LABEL,
  ASSIGNMENT_LABEL,
  LIVE_ASSIGNMENT,
  haversineKm,
  elapsed,
} from './types';

/**
 * How far the reported pin may sit from the reporter's own device before it is
 * worth mentioning. Matches the tolerance the intake API flags on.
 */
const PIN_DRIFT_M = 200;

export function IncidentDetail({
  incident,
  units,
  now,
  onChanged,
}: {
  incident: Incident;
  units: Unit[];
  now: number;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [closing, setClosing] = useState(false);

  const hue = TYPE_COLOR[incident.incident_type];
  const assignments = incident.incident_assignments ?? [];
  const liveAssignments = assignments.filter((a) => LIVE_ASSIGNMENT.includes(a.status));
  const pastAssignments = assignments.filter((a) => !LIVE_ASSIGNMENT.includes(a.status));
  const isClosed = ['resolved', 'cancelled', 'rejected'].includes(incident.status);

  const drift =
    incident.device_lat != null && incident.device_lng != null
      ? haversineKm(
          Number(incident.device_lat), Number(incident.device_lng),
          Number(incident.incident_lat), Number(incident.incident_lng)
        ) * 1000
      : null;

  async function post(url: string, payload: unknown, successTitle: string) {
    setBusy(url + JSON.stringify(payload));
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        toast({
          title: 'That did not go through',
          description: json.error ?? 'Please try again.',
          variant: 'destructive',
        });
        return false;
      }
      toast({ title: successTitle });
      onChanged();
      return true;
    } catch {
      toast({
        title: 'No connection',
        description: 'The console could not reach the server. Check the network and retry.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setBusy(null);
    }
  }

  // Units already committed to this incident are not offered again; the rest
  // are ranked by proximity, with the nearest few shown and the tail folded away.
  const alreadyHere = new Set(liveAssignments.map((a) => a.responder_id));
  const available = units.filter((u) => u.responderId && !alreadyHere.has(u.responderId));
  const shown = showAll ? available : available.slice(0, 5);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="shrink-0 border-b border-border">
        <div className="flex items-center gap-3 px-5 py-3">
          <span
            aria-hidden
            className="h-9 w-1.5 shrink-0"
            style={{ backgroundColor: hue }}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1
                className="text-sm font-bold uppercase tracking-[0.12em]"
                style={{ color: hue }}
              >
                {TYPE_LABEL[incident.incident_type]}
              </h1>
              {incident.severity && (
                <span
                  className={`rounded-sm px-1.5 py-px text-[10px] font-bold uppercase tracking-wider ${
                    incident.severity === 'critical'
                      ? 'bg-[#E5484D] text-white'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {incident.severity}
                </span>
              )}
              <span className="rounded-sm border border-border px-1.5 py-px text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {STATUS_LABEL[incident.status]}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
              {incident.reference_number}
              <CopyButton value={incident.reference_number} label="reference number" />
            </div>
          </div>

          <div className="ml-auto shrink-0 text-right">
            <div className="font-mono text-2xl font-semibold tabular-nums leading-none">
              {elapsed(incident.created_at, now)}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              since report
            </div>
          </div>
        </div>

        {(incident.flagged_for_review || (drift != null && drift > PIN_DRIFT_M)) && (
          <div className="flex items-start gap-2 border-t border-border bg-[#F26430]/10 px-5 py-2 text-[12px] text-foreground">
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-[#F26430]" />
            <span>
              {drift != null && drift > PIN_DRIFT_M && (
                <>
                  Pin sits {Math.round(drift)}m from the reporter&apos;s device.{' '}
                </>
              )}
              {(incident.reports_from_device_24h ?? 0) > 1 && (
                <>
                  {incident.reports_from_device_24h} reports from this device in 24 hours.{' '}
                </>
              )}
              {incident.flagged_for_review && <>Flagged for review — verify before committing units.</>}
            </span>
          </div>
        )}
      </header>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="h-64 border-b border-border">
          <IncidentMap incident={incident} units={units} />
        </div>

        <Section title="Location">
          <p className="text-[13px] leading-relaxed text-foreground">
            {incident.address || 'No address given'}
          </p>
          {incident.landmark && (
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              Landmark: {incident.landmark}
            </p>
          )}
        </Section>

        {incident.description && (
          <Section title="What was reported">
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">
              {incident.description}
            </p>
          </Section>
        )}

        <Section title="Reporter">
          {incident.is_anonymous ? (
            <p className="text-[13px] text-muted-foreground">Reported anonymously.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
              <span className="text-foreground">{incident.reporter_name || 'Name not given'}</span>
              {incident.reporter_phone && (
                <a
                  href={`tel:${incident.reporter_phone}`}
                  className="inline-flex items-center gap-1.5 font-mono text-[#1CB8F7] hover:underline"
                >
                  <Phone className="h-3 w-3" />
                  {incident.reporter_phone}
                </a>
              )}
            </div>
          )}
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Link2 className="h-3 w-3" />
            <span className="font-mono">Tracking link</span>
            <CopyButton
              value={`${typeof window !== 'undefined' ? window.location.origin : ''}/track/emergency/${incident.tracking_token}`}
              label="tracking link"
            />
          </div>
        </Section>

        {/* ── Units on this call ───────────────────────────────────────────── */}
        <Section title={`Units on this call (${liveAssignments.length})`}>
          {liveAssignments.length === 0 && (
            <p className="text-[13px] text-muted-foreground">
              Nobody is assigned. {isClosed ? '' : 'Send a unit below.'}
            </p>
          )}

          <div className="divide-y divide-border">
            {liveAssignments.map((a) => (
              <div key={a.id} className="flex items-center gap-3 py-2">
                <Radio className="h-3.5 w-3.5 shrink-0 text-[#1CB8F7]" />
                <div className="min-w-0">
                  <div className="font-mono text-[13px] font-semibold">
                    {a.unit_callsign ?? 'Unit'}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {ASSIGNMENT_LABEL[a.status]}
                    {a.agency_code ? ` · ${AGENCY_LABEL[a.agency_code]}` : ''}
                    {a.status !== 'on_scene' && a.eta_minutes != null
                      ? ` · ETA ${a.eta_minutes} min`
                      : ''}
                  </div>
                </div>
                <span className="ml-auto font-mono text-[11px] tabular-nums text-muted-foreground">
                  {elapsed(a.dispatched_at, now)}
                </span>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() =>
                    post('/api/emergency/stand-down', { assignmentId: a.id }, `${a.unit_callsign ?? 'Unit'} stood down`)
                  }
                  className="shrink-0 rounded-sm border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-[#E5484D] hover:text-[#E5484D] disabled:opacity-40"
                >
                  Stand down
                </button>
              </div>
            ))}
          </div>

          {pastAssignments.length > 0 && (
            <div className="mt-3 space-y-1 border-t border-border pt-2">
              {pastAssignments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-baseline gap-2 font-mono text-[11px] text-muted-foreground"
                >
                  <span className="font-semibold">{a.unit_callsign ?? 'Unit'}</span>
                  <span>{ASSIGNMENT_LABEL[a.status].toLowerCase()}</span>
                  {a.close_reason && <span className="truncate">— {a.close_reason}</span>}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ── Send a unit ──────────────────────────────────────────────────── */}
        <Section
          title={isClosed ? 'Reopen by sending a unit' : 'Send a unit'}
          hint={
            isClosed
              ? 'This call is closed. Assigning a unit reopens it and is recorded.'
              : 'Nearest first. Distance is straight-line from the last position reported.'
          }
        >
          {available.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              No units configured. Add vehicles with callsigns under Units.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {shown.map((u) => (
                <div key={u.id} className="flex items-center gap-3 py-2">
                  <span
                    aria-hidden
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      u.isOnline ? 'bg-[#3FB950]' : 'bg-muted-foreground/40'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="font-mono text-[13px] font-semibold">{u.callsign}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {u.agency ? AGENCY_LABEL[u.agency] : 'Unassigned agency'}
                      {u.committedTo ? ` · on ${u.committedTo.reference}` : ''}
                      {!u.isOnline ? ' · offline' : ''}
                    </div>
                  </div>
                  <span className="ml-auto shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                    {u.distanceKm != null ? `${u.distanceKm.toFixed(1)} km` : '—'}
                  </span>
                  <button
                    type="button"
                    disabled={busy !== null || !u.responderId}
                    onClick={() =>
                      post(
                        '/api/emergency/dispatch',
                        { incidentId: incident.id, responderId: u.responderId },
                        `${u.callsign} dispatched`
                      )
                    }
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-sm bg-gradient-to-r from-[#1CB8F7] to-[#3B4CCA] px-2.5 py-1.5 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    <Send className="h-3 w-3" />
                    Send
                  </button>
                </div>
              ))}
            </div>
          )}

          {available.length > shown.length && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className="h-3 w-3" />
              Show {available.length - shown.length} more
            </button>
          )}
        </Section>

        {/* ── Close out ────────────────────────────────────────────────────── */}
        {!isClosed && (
          <Section title="Close out">
            {closing ? (
              <CloseForm
                busy={busy !== null}
                onCancel={() => setClosing(false)}
                onSubmit={async (outcome, notes) => {
                  const ok = await post(
                    '/api/emergency/close',
                    { incidentId: incident.id, outcome, notes },
                    `${incident.reference_number} closed as ${outcome}`
                  );
                  if (ok) setClosing(false);
                }}
              />
            ) : (
              <button
                type="button"
                onClick={() => setClosing(true)}
                className="inline-flex items-center gap-1.5 rounded-sm border border-border px-3 py-1.5 text-[12px] font-medium transition-colors hover:bg-accent"
              >
                <X className="h-3.5 w-3.5" />
                Close this incident
              </button>
            )}
          </Section>
        )}

        {isClosed && incident.closure_reason && (
          <Section title="Closure">
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              {incident.closure_reason}
            </p>
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-border px-5 py-3.5">
      <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </h2>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground/80">{hint}</p>}
      <div className="mt-2">{children}</div>
    </section>
  );
}

/**
 * Closing asks for an outcome and a note before it will commit. The note is the
 * only account of why a call ended, so rejections cannot be filed without one.
 */
function CloseForm({
  busy,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  onCancel: () => void;
  onSubmit: (outcome: 'resolved' | 'cancelled' | 'rejected', notes: string) => void;
}) {
  const [outcome, setOutcome] = useState<'resolved' | 'cancelled' | 'rejected'>('resolved');
  const [notes, setNotes] = useState('');

  const options = [
    { value: 'resolved', label: 'Resolved', hint: 'Real, and dealt with' },
    { value: 'cancelled', label: 'Cancelled', hint: 'Real, response no longer needed' },
    { value: 'rejected', label: 'Rejected', hint: 'Not a genuine emergency' },
  ] as const;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-sm border border-border bg-border">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setOutcome(o.value)}
            className={`px-2 py-2 text-left transition-colors ${
              outcome === o.value ? 'bg-accent' : 'bg-background hover:bg-accent/50'
            }`}
          >
            <span className="block text-[12px] font-semibold">{o.label}</span>
            <span className="mt-0.5 block text-[10px] leading-tight text-muted-foreground">
              {o.hint}
            </span>
          </button>
        ))}
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder={
          outcome === 'rejected'
            ? 'Required — why was this not a genuine emergency?'
            : 'What happened? (optional)'
        }
        className="w-full rounded-sm border border-border bg-background px-2.5 py-2 text-[13px] placeholder:text-muted-foreground/70 focus:border-[#1CB8F7] focus:outline-none"
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy || (outcome === 'rejected' && !notes.trim())}
          onClick={() => onSubmit(outcome, notes)}
          className="rounded-sm bg-gradient-to-r from-[#1CB8F7] to-[#3B4CCA] px-3 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Close as {outcome}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-2 py-1.5 text-[12px] text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
