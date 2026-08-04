'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useTheme } from '@/components/theme-provider';
import { Incident, Unit, TYPE_COLOR, LIVE_ASSIGNMENT } from './types';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '';

/** The base map is context, not the subject — it stays quiet under the markers. */
const STYLES = {
  light: 'mapbox://styles/mapbox/light-v11',
  dark: 'mapbox://styles/mapbox/dark-v11',
};

function resolveTheme(theme: string): 'light' | 'dark' {
  if (theme === 'system') {
    return typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return theme === 'dark' ? 'dark' : 'light';
}

/** Incident marker: a crosshair, because the point is a coordinate. */
function incidentMarkerEl(hue: string): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText = 'width:34px;height:34px;position:relative;';
  el.innerHTML = `
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
      <circle cx="17" cy="17" r="15" stroke="${hue}" stroke-width="1.5" opacity="0.45"/>
      <circle cx="17" cy="17" r="5.5" fill="${hue}"/>
      <path d="M17 0v7M17 27v7M0 17h7M27 17h7" stroke="${hue}" stroke-width="1.5"/>
    </svg>`;
  return el;
}

/** Unit marker: a small plate carrying the callsign, so the map reads like the rack. */
function unitMarkerEl(callsign: string, committed: boolean): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText = `
    font: 600 10px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
    letter-spacing: 0.04em;
    padding: 4px 6px;
    border-radius: 2px;
    white-space: nowrap;
    color: #fff;
    background: ${committed ? '#3B4CCA' : '#111827'};
    border: 1px solid rgba(255,255,255,0.35);
    box-shadow: 0 1px 3px rgba(0,0,0,0.4);
  `;
  el.textContent = callsign;
  return el;
}

export function IncidentMap({
  incident,
  units,
}: {
  incident: Incident;
  units: Unit[];
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  /** The incident the camera was last framed on, so it is framed only once. */
  const fitted = useRef<string | null>(null);
  const { theme } = useTheme();
  const [ready, setReady] = useState(false);

  const mode = resolveTheme(theme);

  useEffect(() => {
    if (!container.current || map.current) return;
    if (!mapboxgl.accessToken) return;

    map.current = new mapboxgl.Map({
      container: container.current,
      style: STYLES[mode],
      center: [incident.incident_lng, incident.incident_lat],
      zoom: 14,
      attributionControl: false,
    });
    map.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.current.on('load', () => setReady(true));

    return () => {
      map.current?.remove();
      map.current = null;
    };
    // Built once. Subsequent incidents move the camera rather than rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (map.current && ready) map.current.setStyle(STYLES[mode]);
  }, [mode, ready]);

  // Re-place everything whenever the incident or the units move.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;

    markers.current.forEach((mk) => mk.remove());
    markers.current = [];

    const hue = TYPE_COLOR[incident.incident_type];
    const bounds = new mapboxgl.LngLatBounds();

    const incidentPoint: [number, number] = [
      Number(incident.incident_lng),
      Number(incident.incident_lat),
    ];
    markers.current.push(
      new mapboxgl.Marker({ element: incidentMarkerEl(hue) })
        .setLngLat(incidentPoint)
        .addTo(m)
    );
    bounds.extend(incidentPoint);

    // Only units committed to this incident are drawn. Showing the whole fleet
    // would bury the one thing the dispatcher is looking at.
    const committed = new Set(
      (incident.incident_assignments ?? [])
        .filter((a) => LIVE_ASSIGNMENT.includes(a.status))
        .map((a) => a.responder_id)
    );

    for (const unit of units) {
      if (!unit.responderId || !committed.has(unit.responderId)) continue;
      if (unit.lat == null || unit.lng == null) continue;
      const point: [number, number] = [unit.lng, unit.lat];
      markers.current.push(
        new mapboxgl.Marker({ element: unitMarkerEl(unit.callsign, true), anchor: 'bottom' })
          .setLngLat(point)
          .addTo(m)
      );
      bounds.extend(point);
    }

    // Only recentre when the dispatcher moves to a different call. Refitting on
    // every position update would have the map crawling around under a
    // dispatcher who is trying to read it.
    if (!bounds.isEmpty() && fitted.current !== incident.id) {
      m.fitBounds(bounds, { padding: 70, maxZoom: 15.5, duration: 400 });
      fitted.current = incident.id;
    }
  }, [incident, units, ready]);

  if (!mapboxgl.accessToken) {
    return (
      <div className="flex h-full items-center justify-center bg-muted text-xs text-muted-foreground">
        Map unavailable — no Mapbox token configured.
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={container} className="h-full w-full" />
      {/* Coordinates stay readable off the map: a dispatcher may need to read
          them aloud over the radio. */}
      <div className="pointer-events-none absolute bottom-2 left-2 rounded-sm bg-background/85 px-2 py-1 font-mono text-[10px] tabular-nums text-muted-foreground backdrop-blur">
        {Number(incident.incident_lat).toFixed(5)}, {Number(incident.incident_lng).toFixed(5)}
      </div>
    </div>
  );
}
