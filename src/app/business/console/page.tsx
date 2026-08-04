'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Siren, WifiOff, AlertTriangle } from 'lucide-react';
import { useUserContext } from '@/lib/supabase/user-context';
import { IncidentStrip, QueueHeading } from './incident-strip';
import { IncidentDetail } from './incident-detail';
import { ConsoleMap } from './console-map';
import { useIncidents, useUnits, useNow, useConsoleActions } from './use-console-data';
import { Incident, WAITING, ACTIVE, CLOSED } from './types';

/** How many units the map offers as candidates for the selected call. */
const CANDIDATE_COUNT = 3;

/**
 * The dispatch console.
 *
 * Three columns. The rack on the left says what is waiting; the map in the
 * middle says who can take it; the call on the right is everything else. A
 * dispatcher's whole job is those first two questions, so they get the space.
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
    // call arrived. Most recently touched first once things are closed.
    closed.reverse();
    return { waiting, active, closed };
  }, [incidents]);

  const ordered = useMemo(
    () => [...groups.waiting, ...groups.active, ...groups.closed],
    [groups]
  );

  const selected = ordered.find((i) => i.id === selectedId) ?? null;

  // A selection that no longer exists falls back rather than leaving the right
  // pane pointing at nothing.
  useEffect(() => {
    if (selectedId && !ordered.some((i) => i.id === selectedId)) {
      setSelectedId(null);
    }
  }, [ordered, selectedId]);

  // Arrow keys walk the rack, so a dispatcher can triage without the mouse.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSelectedId(null);
        return;
      }
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
  // new value every render, which would re-sort the unit list and re-draw the
  // map on every clock tick.
  const target = useMemo(
    () =>
      selected
        ? { lat: Number(selected.incident_lat), lng: Number(selected.incident_lng) }
        : null,
    [selected?.incident_lat, selected?.incident_lng] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const { units, reload: reloadUnits } = useUnits(businessId, incidents, target);

  const onChanged = useCallback(() => {
    // Realtime will bring this round anyway; refetching immediately means the
    // button the dispatcher just pressed shows its result now.
    refetch();
    reloadUnits();
  }, [refetch, reloadUnits]);

  const actions = useConsoleActions(onChanged);

  /**
   * The units the map offers for the selected call: free, online, locatable,
   * nearest first. Units already on this call are excluded because sending
   * them again is not a thing you can do.
   */
  const candidateIds = useMemo(() => {
    if (!selected) return [];
    const onThisCall = new Set(
      (selected.incident_assignments ?? []).map((a) => a.responder_id)
    );
    return units
      .filter(
        (u) =>
          u.responderId &&
          !u.committedTo &&
          u.isOnline &&
          u.lat != null &&
          u.distanceKm != null &&
          !onThisCall.has(u.responderId)
      )
      .slice(0, CANDIDATE_COUNT)
      .map((u) => u.responderId!);
  }, [units, selected]);

  /** Units that can be sent but cannot be drawn — see the tray below. */
  const stranded = useMemo(
    () => units.filter((u) => u.responderId && !u.committedTo && u.lat == null),
    [units]
  );

  const renderStrip = (incident: Incident) => (
    <IncidentStrip
      key={incident.id}
      incident={incident}
      now={now}
      selected={incident.id === selectedId}
      onSelect={() => setSelectedId(incident.id === selectedId ? null : incident.id)}
    />
  );

  return (
    <div className="relative flex h-[calc(100vh-4rem)] flex-col overflow-hidden lg:flex-row">
      {/* ── The rack ───────────────────────────────────────────────────────── */}
      <aside className="flex w-full shrink-0 flex-col border-b border-border lg:h-full lg:w-[320px] lg:border-b-0 lg:border-r xl:w-[352px]">
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2.5">
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
            <p className="px-4 py-4 text-[13px] text-[#E5484D]">Could not load the board: {error}</p>
          )}
          {loading && !error && (
            <p className="px-4 py-4 text-[13px] text-muted-foreground">Loading the board…</p>
          )}
          {!loading && !error && ordered.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
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

      {/* ── The map ────────────────────────────────────────────────────────── */}
      <main className="relative hidden min-w-0 flex-1 lg:block">
        <ConsoleMap
          incidents={incidents}
          units={units}
          selectedId={selectedId}
          candidateIds={candidateIds}
          now={now}
          onSelect={(id) => setSelectedId(id === selectedId ? null : id)}
          onDispatch={(responderId) => {
            const unit = units.find((u) => u.responderId === responderId);
            if (selectedId && unit) actions.dispatch(selectedId, responderId, unit.callsign);
          }}
        />

        {!selectedId && ordered.length > 0 && (
          <div className="pointer-events-none absolute left-3 top-3 border border-border bg-background/95 px-2.5 py-1.5 text-[11.5px] text-muted-foreground shadow-sm backdrop-blur">
            Select a call to see <span className="font-semibold text-foreground">who can take it</span>
          </div>
        )}

        {/*
          A map-first console silently hides any unit it cannot plot. Rather than
          letting those units vanish, they get a permanent dock — they are still
          perfectly dispatchable, they just have no recent fix.
        */}
        {stranded.length > 0 && (
          <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-2.5 border border-border bg-background/95 px-3 py-2 shadow-sm backdrop-blur">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[#F26430]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              No position
            </span>
            <div className="flex flex-wrap gap-1.5">
              {stranded.map((u) => (
                <span
                  key={u.id}
                  className="inline-flex items-center gap-2 border border-dashed border-border px-2 py-1 font-mono text-[11px]"
                >
                  {u.callsign}
                  {selectedId && (
                    <button
                      type="button"
                      disabled={actions.busy}
                      onClick={() => actions.dispatch(selectedId, u.responderId!, u.callsign)}
                      className="font-sans text-[10px] font-semibold text-[#1CB8F7] hover:underline disabled:opacity-40"
                    >
                      Send
                    </button>
                  )}
                </span>
              ))}
            </div>
            <span className="ml-auto text-[10.5px] text-muted-foreground">
              Dispatchable, but cannot be drawn — no recent GPS fix
            </span>
          </div>
        )}
      </main>

      {/* ── The selected call ──────────────────────────────────────────────── */}
      {selected && (
        <aside className="min-h-0 w-full shrink-0 overflow-hidden border-t border-border lg:h-full lg:w-[336px] lg:border-l lg:border-t-0 xl:w-[360px]">
          <IncidentDetail key={selected.id} incident={selected} units={units} now={now} actions={actions} />
        </aside>
      )}
    </div>
  );
}
