'use client';

import { Flag, Copy } from 'lucide-react';
import {
  Incident,
  TYPE_COLOR,
  TYPE_LABEL,
  LIVE_ASSIGNMENT,
  ASSIGNMENT_LABEL,
  elapsed,
} from './types';

/**
 * A single incident, drawn as a strip.
 *
 * The form is borrowed from the paper strips that ran dispatch desks before
 * screens did: square, full-bleed, stacked edge to edge, colour-coded down the
 * left. Nothing is rounded and nothing floats, so a queue of twenty reads as
 * one rack rather than twenty separate objects competing for attention.
 */
export function IncidentStrip({
  incident,
  now,
  selected,
  onSelect,
}: {
  incident: Incident;
  now: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const hue = TYPE_COLOR[incident.incident_type];
  const waiting = incident.status === 'submitted';
  const closed = ['resolved', 'cancelled', 'rejected'].includes(incident.status);

  // The clock that matters is time-since-report while nothing is moving, and
  // time-since-dispatch once a unit is committed.
  const clockFrom = waiting || closed
    ? incident.created_at
    : incident.dispatched_at ?? incident.created_at;

  const waitedMinutes = (now - new Date(incident.created_at).getTime()) / 60_000;
  const overdue = waiting && waitedMinutes >= 3;

  const live = (incident.incident_assignments ?? []).filter((a) =>
    LIVE_ASSIGNMENT.includes(a.status)
  );

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? 'true' : undefined}
      className={`
        group relative block w-full border-b border-border px-3 py-2.5 text-left
        transition-colors focus:outline-none focus-visible:ring-2
        focus-visible:ring-inset focus-visible:ring-[#1CB8F7]
        ${selected ? 'bg-accent' : 'hover:bg-accent/50'}
        ${closed ? 'opacity-55' : ''}
      `}
    >
      {/* The strip's coloured edge. Widens on selection instead of the row
          growing a border, so nothing shifts as you arrow through the queue. */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 transition-[width]"
        style={{ width: selected ? 6 : 3, backgroundColor: hue }}
      />

      <div className="flex items-baseline gap-2.5 pl-2">
        <span
          className={`font-mono text-[15px] font-semibold tabular-nums leading-none tracking-tight ${
            overdue ? 'text-[#E5484D]' : 'text-foreground'
          }`}
        >
          {elapsed(clockFrom, now)}
        </span>

        <span
          className="text-[10px] font-bold uppercase leading-none tracking-[0.14em]"
          style={{ color: hue }}
        >
          {TYPE_LABEL[incident.incident_type]}
        </span>

        {incident.severity === 'critical' && (
          <span className="rounded-sm bg-[#E5484D] px-1 py-px text-[9px] font-bold uppercase leading-none tracking-[0.1em] text-white">
            Critical
          </span>
        )}

        {incident.flagged_for_review && (
          <Flag className="h-3 w-3 shrink-0 text-[#F26430]" aria-label="Flagged for review" />
        )}

        <span className="ml-auto shrink-0 font-mono text-[10px] leading-none text-muted-foreground">
          {incident.reference_number}
        </span>
      </div>

      <p className="mt-1.5 truncate pl-2 text-[13px] leading-snug text-foreground">
        {incident.address || incident.landmark || 'Location not described'}
      </p>

      <p className="mt-1 truncate pl-2 font-mono text-[11px] leading-none text-muted-foreground">
        {live.length > 0
          ? live
              .map(
                (a) =>
                  `${a.unit_callsign ?? 'UNIT'} ${ASSIGNMENT_LABEL[a.status].toLowerCase()}` +
                  (a.status !== 'on_scene' && a.eta_minutes != null ? ` ${a.eta_minutes}m` : '')
              )
              .join('  ·  ')
          : closed
            ? incident.closure_reason || 'Closed'
            : 'No unit assigned'}
      </p>
    </button>
  );
}

/**
 * Sticky section header for the queue. Carries a count because "how many are
 * waiting" is the one number a dispatcher checks without reading anything.
 */
export function QueueHeading({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone?: 'urgent';
}) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 px-5 py-1.5 backdrop-blur">
      <span
        className={`text-[10px] font-bold uppercase tracking-[0.16em] ${
          tone === 'urgent' && count > 0 ? 'text-[#E5484D]' : 'text-muted-foreground'
        }`}
      >
        {label}
      </span>
      <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{count}</span>
    </div>
  );
}

/** Copy-to-clipboard control for reference numbers and tracking links. */
export function CopyButton({ value, label }: { value: string; label: string }) {
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(value)}
      title={`Copy ${label}`}
      className="inline-flex items-center text-muted-foreground transition-colors hover:text-foreground"
    >
      <Copy className="h-3 w-3" />
      <span className="sr-only">Copy {label}</span>
    </button>
  );
}
