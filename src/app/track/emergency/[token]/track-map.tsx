'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '';

/** The same style the rest of SwiftDash uses, so the maps look like one product. */
const DEFAULT_STYLE = 'mapbox://styles/swiftdash/cmgtdgxbe000e01st0atdhrex';

/**
 * The same named styles the delivery tracking page offers, so a command center
 * that picked "satellite" in settings gets satellite here too. Satellite is a
 * defensible choice for emergencies — roofs and yards are recognisable to
 * someone standing outside in a way a street diagram is not.
 */
const MAP_STYLES: Record<string, string> = {
  streets:   'mapbox://styles/mapbox/streets-v12',
  light:     'mapbox://styles/mapbox/light-v11',
  dark:      'mapbox://styles/mapbox/dark-v11',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  outdoors:  'mapbox://styles/mapbox/outdoors-v12',
};

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
  mapStyle,
}: {
  incident: { lat: number; lng: number };
  units: UnitPosition[];
  hue: string;
  /** A named style from the command center's settings, e.g. "satellite". */
  mapStyle?: string | null;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const incidentMarker = useRef<mapboxgl.Marker | null>(null);
  const unitMarkers = useRef<mapboxgl.Marker[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!container.current || map.current || !mapboxgl.accessToken) return;

    // Read once, at mount. The map is only rendered after the report has
    // loaded, so the command center's choice is already known here, and
    // branding does not change while somebody is watching.
    const m = new mapboxgl.Map({
      container: container.current,
      style: (mapStyle && MAP_STYLES[mapStyle]) || DEFAULT_STYLE,
      center: [incident.lng, incident.lat],
      zoom: 15,
      attributionControl: false,
      /**
       * Deliberately not interactive.
       *
       * This map runs full width, so on a phone every attempt to scroll past it
       * would instead drag the map — and someone who accidentally pans away from
       * the scene has lost the one thing they came here for. There is nothing to
       * explore either: the view already frames the incident and whoever is
       * coming to it, and refits itself as they move.
       */
      interactive: false,
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
