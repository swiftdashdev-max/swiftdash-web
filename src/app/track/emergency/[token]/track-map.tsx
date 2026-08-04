'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '';

/** The same style the rest of SwiftDash uses, so the maps look like one product. */
const STYLE = 'mapbox://styles/swiftdash/cmgtdgxbe000e01st0atdhrex';

export interface UnitPosition {
  callsign: string | null;
  lat: number;
  lng: number;
}

/**
 * The scene, for someone waiting.
 *
 * Two things only: where help is coming to, and where help currently is. No
 * controls worth fiddling with, no layers, nothing to get lost in. Someone
 * reading this is frightened and probably holding the phone in one hand.
 */
export function TrackMap({
  incident,
  units,
  hue,
}: {
  incident: { lat: number; lng: number };
  units: UnitPosition[];
  hue: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const incidentMarker = useRef<mapboxgl.Marker | null>(null);
  const unitMarkers = useRef<mapboxgl.Marker[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!container.current || map.current || !mapboxgl.accessToken) return;

    const m = new mapboxgl.Map({
      container: container.current,
      style: STYLE,
      center: [incident.lng, incident.lat],
      zoom: 15,
      attributionControl: false,
      // A map that can be panned into the sea by a shaking hand is not helping.
      dragRotate: false,
      touchPitch: false,
    });
    m.on('load', () => setReady(true));
    map.current = m;

    return () => {
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;

    if (!incidentMarker.current) {
      const el = document.createElement('div');
      el.innerHTML = `
        <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
          <circle cx="20" cy="20" r="17" fill="${hue}" opacity="0.16"/>
          <circle cx="20" cy="20" r="9"  fill="${hue}" opacity="0.28"/>
          <circle cx="20" cy="20" r="5"  fill="${hue}"/>
        </svg>`;
      incidentMarker.current = new mapboxgl.Marker({ element: el })
        .setLngLat([incident.lng, incident.lat])
        .addTo(m);
    } else {
      incidentMarker.current.setLngLat([incident.lng, incident.lat]);
    }
  }, [incident, hue, ready]);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;

    unitMarkers.current.forEach((mk) => mk.remove());
    unitMarkers.current = [];

    const bounds = new mapboxgl.LngLatBounds();
    bounds.extend([incident.lng, incident.lat]);

    for (const unit of units) {
      const el = document.createElement('div');
      el.style.cssText = `
        display:flex; align-items:center; gap:5px;
        background:#0F172A; color:#fff; border:1px solid rgba(255,255,255,.4);
        border-radius:3px; padding:4px 7px; white-space:nowrap;
        font:600 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
        box-shadow:0 2px 6px rgba(0,0,0,.35);`;
      el.innerHTML = `<span style="width:6px;height:6px;border-radius:50%;background:#3FB950"></span>${
        unit.callsign ?? 'Responder'
      }`;
      unitMarkers.current.push(
        new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([unit.lng, unit.lat])
          .addTo(m)
      );
      bounds.extend([unit.lng, unit.lat]);
    }

    // Keep both the scene and whoever is coming to it on screen at once. That
    // relationship — how far away help still is — is the whole point of the map.
    if (units.length > 0) {
      m.fitBounds(bounds, { padding: 70, maxZoom: 16, duration: 600 });
    }
  }, [units, incident, ready]);

  if (!mapboxgl.accessToken) return null;

  return <div ref={container} className="h-full w-full" />;
}
