'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Incident,
  Unit,
  AgencyCode,
  LIVE_ASSIGNMENT,
  haversineKm,
} from './types';

const INCIDENT_COLUMNS = `
  id, reference_number, tracking_token, incident_type, severity, status,
  description, address, landmark, incident_lat, incident_lng,
  device_lat, device_lng, reporter_name, reporter_phone, is_anonymous,
  agency_code, flagged_for_review, reports_from_device_24h, decline_count,
  created_at, dispatched_at, accepted_at, on_scene_at, resolved_at, closure_reason,
  incident_assignments (
    id, responder_id, unit_callsign, agency_code, status, eta_minutes,
    dispatched_at, accepted_at, on_scene_at, closed_at, close_reason
  )
`;

/**
 * Closed incidents stay on the board for this long so a dispatcher can still
 * reopen one or read back what happened, then drop off. Anything older belongs
 * on the Incidents page, not the live board.
 */
const CLOSED_WINDOW_HOURS = 12;

/**
 * Live incident board for one command center.
 *
 * Reads through RLS as the signed-in dispatcher, then keeps itself current with
 * Supabase Realtime. Every change triggers a debounced refetch rather than a
 * patch of local state: incident status is derived by a database trigger from
 * its assignments, so a row-level payload can arrive before the derived status
 * has settled. Refetching is the only way to be sure the board matches the
 * database, and at a city's incident volume it costs nothing.
 */
export function useIncidents(businessId: string | null) {
  const supabase = useMemo(() => createClient(), []);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refetch = useCallback(async () => {
    if (!businessId) return;

    const since = new Date(Date.now() - CLOSED_WINDOW_HOURS * 3600_000).toISOString();

    // Two plain queries rather than one compound filter. Every open incident
    // must appear no matter how old it is, and recently closed ones alongside
    // them; expressing that as a single `or` means trusting a filter string to
    // parse correctly, and an incident silently missing from this board is the
    // worst failure this page has.
    const [open, recentlyClosed] = await Promise.all([
      supabase
        .from('emergency_incidents')
        .select(INCIDENT_COLUMNS)
        .eq('command_center_id', businessId)
        .in('status', ['submitted', 'dispatched', 'en_route', 'on_scene'])
        .order('created_at', { ascending: true }),
      supabase
        .from('emergency_incidents')
        .select(INCIDENT_COLUMNS)
        .eq('command_center_id', businessId)
        .in('status', ['resolved', 'cancelled', 'rejected'])
        .gte('updated_at', since)
        .order('created_at', { ascending: true }),
    ]);

    const err = open.error ?? recentlyClosed.error;
    if (err) {
      setError(err.message);
    } else {
      setError(null);
      setIncidents([
        ...((open.data ?? []) as unknown as Incident[]),
        ...((recentlyClosed.data ?? []) as unknown as Incident[]),
      ]);
    }
    setLoading(false);
  }, [businessId, supabase]);

  const scheduleRefetch = useCallback(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(refetch, 250);
  }, [refetch]);

  useEffect(() => {
    if (!businessId) return;

    refetch();

    const channel = supabase
      .channel(`console:${businessId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'emergency_incidents',
          filter: `command_center_id=eq.${businessId}`,
        },
        scheduleRefetch
      )
      .on(
        // Assignments carry no command_center_id to filter on, so this listens
        // broadly and lets RLS decide what actually reaches the browser.
        'postgres_changes',
        { event: '*', schema: 'public', table: 'incident_assignments' },
        scheduleRefetch
      )
      .subscribe((status) => {
        setLive(status === 'SUBSCRIBED');
      });

    // A tab left open overnight can miss events while the socket is asleep.
    // A slow poll costs one query a minute and removes that whole class of bug.
    const poll = setInterval(refetch, 60_000);

    return () => {
      if (debounce.current) clearTimeout(debounce.current);
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [businessId, refetch, scheduleRefetch, supabase]);

  return { incidents, loading, error, live, refetch };
}

/**
 * The command center's units, ranked by distance to a given incident.
 *
 * Callsign and agency live on the vehicle; online state and position live on
 * the responder, so this stitches the two together. A vehicle with no callsign
 * is not a dispatchable unit and is left out.
 */
export function useUnits(
  businessId: string | null,
  incidents: Incident[],
  target: { lat: number; lng: number } | null
) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Omit<Unit, 'distanceKm' | 'committedTo'>[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!businessId) return;

    const { data: fleet } = await supabase
      .from('business_fleet')
      .select('id, unit_callsign, agency_code, plate_number, assigned_driver_id')
      .eq('business_id', businessId)
      .not('unit_callsign', 'is', null);

    const driverIds = (fleet ?? [])
      .map((v) => v.assigned_driver_id)
      .filter((id): id is string => Boolean(id));

    const { data: drivers } = driverIds.length
      ? await supabase
          .from('driver_profiles')
          .select('id, is_online, current_latitude, current_longitude, location_updated_at')
          .in('id', driverIds)
      : { data: [] };

    const byDriver = new Map((drivers ?? []).map((d) => [d.id, d]));

    setRows(
      (fleet ?? []).map((v) => {
        const d = v.assigned_driver_id ? byDriver.get(v.assigned_driver_id) : undefined;
        return {
          id: v.id,
          callsign: v.unit_callsign as string,
          agency: (v.agency_code ?? null) as AgencyCode | null,
          plate: v.plate_number ?? null,
          responderId: v.assigned_driver_id ?? null,
          isOnline: Boolean(d?.is_online),
          lat: d?.current_latitude != null ? Number(d.current_latitude) : null,
          lng: d?.current_longitude != null ? Number(d.current_longitude) : null,
          locationUpdatedAt: d?.location_updated_at ?? null,
        };
      })
    );
    setLoading(false);
  }, [businessId, supabase]);

  useEffect(() => {
    load();
    // Positions move; the roster barely does. Refreshing every 20s keeps the
    // distance column honest without hammering the database.
    const timer = setInterval(load, 20_000);
    return () => clearInterval(timer);
  }, [load]);

  /**
   * Which units are already committed. Derived from the incidents already on
   * the board rather than queried again — the board is the same source of
   * truth the dispatcher is looking at, so the two can never disagree.
   */
  const commitments = useMemo(() => {
    const map = new Map<string, { reference: string; incidentId: string }>();
    for (const incident of incidents) {
      for (const a of incident.incident_assignments ?? []) {
        if (LIVE_ASSIGNMENT.includes(a.status)) {
          map.set(a.responder_id, {
            reference: incident.reference_number,
            incidentId: incident.id,
          });
        }
      }
    }
    return map;
  }, [incidents]);

  const units: Unit[] = useMemo(() => {
    const withDistance = rows.map((u) => ({
      ...u,
      distanceKm:
        target && u.lat != null && u.lng != null
          ? haversineKm(u.lat, u.lng, target.lat, target.lng)
          : null,
      committedTo: u.responderId ? commitments.get(u.responderId) ?? null : null,
    }));

    // Closest first, but only among units that can actually be sent: offline
    // units and units without a fix sink to the bottom regardless of distance.
    return withDistance.sort((a, b) => {
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      if ((a.distanceKm == null) !== (b.distanceKm == null)) {
        return a.distanceKm == null ? 1 : -1;
      }
      if (a.distanceKm != null && b.distanceKm != null) {
        return a.distanceKm - b.distanceKm;
      }
      return a.callsign.localeCompare(b.callsign);
    });
  }, [rows, target, commitments]);

  return { units, loading, reload: load };
}

/** A clock that ticks once a second, for elapsed-time displays. */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
