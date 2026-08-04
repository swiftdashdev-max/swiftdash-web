'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Siren, WifiOff } from 'lucide-react';
import { useUserContext } from '@/lib/supabase/user-context';
import { IncidentStrip, QueueHeading } from './incident-strip';
import { IncidentDetail } from './incident-detail';
import { useIncidents, useUnits, useNow } from './use-console-data';
import { Incident, WAITING, ACTIVE, CLOSED } from './types';

/**
 * The dispatch console.
 *
 * Two panes. On the left, every incident as a strip in a single rack, grouped
 * by whether it is waiting, running, or done. On the right, whichever strip is
 * selected, with everything needed to act on it. A dispatcher's whole job is
 * "what is waiting, and who can I send" — so those two things are the layout.
 */
export default function ConsolePage() {
  const { businessId, accountType, loading: userLoading } = useUserContext();
  const router = useRouter();
  const now = useNow();

  const { incidents, loading, error, live, refetch } = useIncidents(businessId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // A delivery account has no business here, and the nav would not have shown
  // the link — but the URL is guessable, so the page checks for itself.
  useEffect(() => {
    if (!userLoading && accountType && accountType !== 'emergency') {
      router.replace('/business/dashboard');
    }
  }, [accountType, userLoading, router]);

  const groups = useMemo(() => {
    const waiting: Incident[] = [];
    const active: Incident[] = [];
    const closed: Incident[] = [];
    for (const i of incidents) {
      if (WAITING.includes(i.status)) waiting.push(i);
      else if (ACTIVE.includes(i.status)) active.push(i);
      else if (CLOSED.includes(i.status)) closed.push(i);
    }
    // Oldest first while waiting — nobody should wait longer because a newer
    // call arrived. Most recently touched first once things are moving.
    closed.reverse();
    return { waiting, active, closed };
  }, [incidents]);

  const ordered = useMemo(
    () => [...groups.waiting, ...groups.active, ...groups.closed],
    [groups]
  );

  const selected = ordered.find((i) => i.id === selectedId) ?? null;

  // Nothing selected: fall to the incident that most needs a decision. This is
  // what makes the console usable on a wall display nobody is clicking.
  useEffect(() => {
    if (!selectedId && ordered.length > 0) setSelectedId(ordered[0].id);
    if (selectedId && !ordered.some((i) => i.id === selectedId)) {
      setSelectedId(ordered[0]?.id ?? null);
    }
  }, [ordered, selectedId]);

  // Arrow keys walk the rack, so a dispatcher can triage without the mouse.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
      e.preventDefault();
      const index = ordered.findIndex((i) => i.id === selectedId);
      const next = e.key === 'ArrowDown' ? index + 1 : index - 1;
      if (next >= 0 && next < ordered.length) setSelectedId(ordered[next].id);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ordered, selectedId]);

  // Memoised on the coordinates themselves. An inline object here would be a
  // new value every render, which would re-sort and re-render the unit list
  // (and re-draw the map) on every clock tick.
  const target = useMemo(
    () =>
      selected
        ? { lat: Number(selected.incident_lat), lng: Number(selected.incident_lng) }
        : null,
    [selected?.incident_lat, selected?.incident_lng] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const { units, reload: reloadUnits } = useUnits(businessId, incidents, target);

  const renderStrip = (incident: Incident) => (
    <IncidentStrip
      key={incident.id}
      incident={incident}
      now={now}
      selected={incident.id === selectedId}
      onSelect={() => setSelectedId(incident.id)}
    />
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden md:flex-row">
      {/* ── The rack ───────────────────────────────────────────────────────── */}
      <aside className="flex w-full shrink-0 flex-col border-b border-border md:h-full md:w-[380px] md:border-b-0 md:border-r lg:w-[420px]">
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-5 py-2.5">
          <h1 className="text-[11px] font-bold uppercase tracking-[0.16em]">Board</h1>
          <span
            className={`ml-auto inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] ${
              live ? 'text-muted-foreground' : 'text-[#F26430]'
            }`}
            title={live ? 'Receiving live updates' : 'Reconnecting — falling back to polling'}
          >
            {live ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-[#3FB950]" />
                Live
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3" />
                Reconnecting
              </>
            )}
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {error && (
            <p className="px-5 py-4 text-[13px] text-[#E5484D]">
              Could not load the board: {error}
            </p>
          )}

          {loading && !error && (
            <p className="px-5 py-4 text-[13px] text-muted-foreground">Loading the board…</p>
          )}

          {!loading && !error && ordered.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-5 py-16 text-center">
              <Siren className="h-5 w-5 text-muted-foreground/50" />
              <p className="text-[13px] text-muted-foreground">
                Nothing on the board. Reports arrive here the moment they are made.
              </p>
            </div>
          )}

          {groups.waiting.length > 0 && (
            <>
              <QueueHeading label="Waiting" count={groups.waiting.length} tone="urgent" />
              {groups.waiting.map(renderStrip)}
            </>
          )}
          {groups.active.length > 0 && (
            <>
              <QueueHeading label="Running" count={groups.active.length} />
              {groups.active.map(renderStrip)}
            </>
          )}
          {groups.closed.length > 0 && (
            <>
              <QueueHeading label="Closed today" count={groups.closed.length} />
              {groups.closed.map(renderStrip)}
            </>
          )}
        </div>
      </aside>

      {/* ── The selected call ──────────────────────────────────────────────── */}
      <main className="min-h-0 flex-1 overflow-hidden">
        {selected ? (
          <IncidentDetail
            key={selected.id}
            incident={selected}
            units={units}
            now={now}
            // Realtime will bring this round anyway; refetching immediately
            // means the button the dispatcher just pressed shows its result now.
            onChanged={() => {
              refetch();
              reloadUnits();
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <p className="max-w-xs text-[13px] text-muted-foreground">
              Select an incident from the board to see the scene and send units.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
