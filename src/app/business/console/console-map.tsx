'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  Incident,
  Unit,
  TYPE_COLOR,
  TYPE_LABEL,
  AGENCY_LABEL,
  LIVE_ASSIGNMENT,
  haversineKm,
} from './types';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '';

/**
 * The same custom style the delivery maps use, so the two halves of SwiftDash
 * look like one product.
 *
 * It is a Mapbox Standard style — it imports mapbox://styles/mapbox/standard
 * under the import id "basemap" and defines no layers of its own. Two things
 * follow from that, and both shape the code below:
 *
 *   1. Custom layers must declare a `slot`, or they land above the labels.
 *   2. There is no addressable `building` source-layer to filter. Buildings are
 *      reached through Standard's `buildings` featureset instead, which the
 *      style already has interaction enabled for.
 */
const STYLE = 'mapbox://styles/swiftdash/cmgtdgxbe000e01st0atdhrex';

/** The import id of the Standard basemap inside that style. */
const BASEMAP = 'basemap';

/** Roxas City. Where the map sits when nothing is selected. */
const HOME: { center: [number, number]; zoom: number } = {
  center: [122.7511, 11.5853],
  zoom: 12.6,
};

/** The elapsed ring reaches full sweep at ten minutes. */
const RING_FULL_MS = 10 * 60_000;

/**
 * How closely the reported pin must agree with the reporter's own device
 * before we are willing to point at a specific building. Beyond this the pin
 * is a neighbourhood, not an address, and highlighting a structure would be
 * asserting something we do not know.
 */
const BUILDING_CONFIDENCE_M = 50;

/** Buildings are only in the tiles once you are this close. */
const BUILDING_MIN_ZOOM = 14;

const RING_R = 15;
const RING_C = 2 * Math.PI * RING_R;

function incidentEl(incident: Incident): HTMLElement {
  const el = document.createElement('div');
  el.className = 'cmap-inc';
  el.style.setProperty('--cmap-hue', TYPE_COLOR[incident.incident_type]);
  el.innerHTML = `
    <svg width="72" height="80" viewBox="0 0 72 80" aria-hidden="true" style="overflow:visible">
      <g transform="translate(36,26)">
        <circle class="halo" cx="0" cy="0" r="28"/>
        <circle class="track" cx="0" cy="0" r="${RING_R}"/>
        <circle class="ring" cx="0" cy="0" r="${RING_R}"
                stroke-dasharray="${RING_C}" stroke-dashoffset="${RING_C}"
                transform="rotate(-90)"/>
        <line class="cross" x1="0" y1="${-RING_R - 7}" x2="0" y2="${-RING_R + 1}"/>
        <line class="cross" x1="0" y1="${RING_R - 1}"  x2="0" y2="${RING_R + 7}"/>
        <line class="cross" x1="${-RING_R - 7}" y1="0" x2="${-RING_R + 1}" y2="0"/>
        <line class="cross" x1="${RING_R - 1}"  y1="0" x2="${RING_R + 7}"  y2="0"/>
        <circle class="core" cx="0" cy="0" r="5"/>
        <text class="ref" x="0" y="${RING_R + 17}" text-anchor="middle">
          ${incident.reference_number.slice(-4)}
        </text>
      </g>
    </svg>`;
  return el;
}

function unitEl(unit: Unit, state: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'cmap-unit';
  el.dataset.state = state;
  el.innerHTML = `<span class="plate">${unit.callsign}</span>`;
  return el;
}

export function ConsoleMap({
  incidents,
  units,
  selectedId,
  candidateIds,
  now,
  onSelect,
  onDispatch,
}: {
  incidents: Incident[];
  units: Unit[];
  selectedId: string | null;
  /** Responder ids the console is offering for the selected call. */
  candidateIds: string[];
  now: number;
  onSelect: (incidentId: string) => void;
  onDispatch: (responderId: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [ready, setReady] = useState(false);
  /**
   * Bumped every time layers are (re)installed. Any style reload discards the
   * line source along with everything else, so the effect that fills it has to
   * know to run again — otherwise the tethers quietly disappear and the map
   * still looks fine, which is the worst kind of broken.
   */
  const [styleEpoch, setStyleEpoch] = useState(0);

  const incMarkers = useRef(new Map<string, mapboxgl.Marker>());
  const unitMarkers = useRef(new Map<string, mapboxgl.Marker>());
  const popup = useRef<mapboxgl.Popup | null>(null);
  const framed = useRef<string | null>(null);
  /** The building currently carrying the select state, so it can be released. */
  const litBuilding = useRef<mapboxgl.TargetFeature | null>(null);

  // Handlers reach the map through refs so markers can be created once and
  // still call the current React callbacks.
  const onSelectRef = useRef(onSelect);
  const onDispatchRef = useRef(onDispatch);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);
  useEffect(() => { onDispatchRef.current = onDispatch; }, [onDispatch]);

  // ── Build once ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!container.current || map.current || !mapboxgl.accessToken) return;

    const m = new mapboxgl.Map({
      container: container.current,
      style: STYLE,
      center: HOME.center,
      zoom: HOME.zoom,
      attributionControl: false,
    });
    m.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');
    m.on('load', () => setReady(true));
    map.current = m;

    return () => {
      m.remove();
      map.current = null;
      incMarkers.current.clear();
      unitMarkers.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Layers that must be re-added after any style change, since setStyle
   * discards sources and layers but leaves markers alone.
   */
  const installLayers = useCallback(() => {
    const m = map.current;
    if (!m || !m.isStyleLoaded()) return;

    if (!m.getSource('cmap-links')) {
      m.addSource('cmap-links', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      // 'middle' puts these above the basemap's roads and buildings but below
      // its labels. Without a slot, a Standard style stacks them over the top
      // of everything, including place names.
      //
      // A unit joined to its call: solid, so commitment reads as connection.
      m.addLayer({
        id: 'cmap-tethers',
        type: 'line',
        slot: 'middle',
        source: 'cmap-links',
        filter: ['==', ['get', 'kind'], 'tether'],
        paint: { 'line-color': '#1CB8F7', 'line-width': 1.6, 'line-opacity': 0.9 },
      });
      // A unit that could take the call: dashed, and only while it is offered.
      m.addLayer({
        id: 'cmap-spokes',
        type: 'line',
        slot: 'middle',
        source: 'cmap-links',
        filter: ['==', ['get', 'kind'], 'spoke'],
        paint: {
          'line-color': '#C3CCD9',
          'line-width': 1,
          'line-opacity': 0.85,
          'line-dasharray': [3, 3],
        },
      });
      m.addLayer({
        id: 'cmap-spoke-labels',
        type: 'symbol',
        slot: 'top',
        source: 'cmap-links',
        filter: ['==', ['get', 'kind'], 'spoke'],
        layout: {
          'symbol-placement': 'line-center',
          'text-field': ['get', 'label'],
          'text-size': 10,
          // No text-font: the default is the one face every Mapbox style is
          // guaranteed to serve glyphs for. Naming a font the style lacks means
          // silently unlabelled spokes.
        },
        paint: {
          // Fixed rather than theme-derived: the basemap keeps its own light
          // preset regardless of the app's theme, so the halo has to contrast
          // with the map, not with the surrounding UI.
          'text-color': '#FFFFFF',
          'text-halo-color': 'rgba(0,0,0,0.75)',
          'text-halo-width': 1.5,
        },
      });
    }

    setStyleEpoch((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!ready) return;
    installLayers();
    // A Standard style finishes resolving its import after the first load, and
    // that re-runs style assembly. Re-installing on style.load keeps the lines
    // present if that happens.
    const m = map.current;
    if (!m) return;
    const onStyle = () => installLayers();
    m.on('style.load', onStyle);
    return () => {
      m.off('style.load', onStyle);
    };
  }, [ready, installLayers]);

  // ── Incident markers ──────────────────────────────────────────────────────
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;

    const seen = new Set<string>();

    for (const incident of incidents) {
      seen.add(incident.id);
      let marker = incMarkers.current.get(incident.id);

      if (!marker) {
        const el = incidentEl(incident);
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelectRef.current(incident.id);
        });
        marker = new mapboxgl.Marker({ element: el })
          .setLngLat([Number(incident.incident_lng), Number(incident.incident_lat)])
          .addTo(m);
        incMarkers.current.set(incident.id, marker);
      } else {
        marker.setLngLat([Number(incident.incident_lng), Number(incident.incident_lat)]);
      }

      const el = marker.getElement();
      el.dataset.selected = String(incident.id === selectedId);
      el.style.setProperty('--cmap-hue', TYPE_COLOR[incident.incident_type]);
      // Closed calls stay on the map but stop competing for attention.
      el.style.opacity = ['resolved', 'cancelled', 'rejected'].includes(incident.status)
        ? '0.4'
        : '1';
    }

    for (const [id, marker] of incMarkers.current) {
      if (!seen.has(id)) {
        marker.remove();
        incMarkers.current.delete(id);
      }
    }
  }, [incidents, selectedId, ready]);

  // ── Unit markers ──────────────────────────────────────────────────────────
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;

    const candidates = new Set(candidateIds);
    const seen = new Set<string>();

    for (const unit of units) {
      if (unit.lat == null || unit.lng == null || !unit.responderId) continue;
      seen.add(unit.id);

      const state = unit.committedTo
        ? 'committed'
        : candidates.has(unit.responderId)
          ? 'candidate'
          : unit.isOnline
            ? 'idle'
            : 'offline';

      let marker = unitMarkers.current.get(unit.id);
      if (!marker) {
        const el = unitEl(unit, state);
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          if (el.dataset.state !== 'candidate') return;
          openConfirm(unit);
        });
        marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([unit.lng, unit.lat])
          .addTo(m);
        unitMarkers.current.set(unit.id, marker);
      } else {
        marker.setLngLat([unit.lng, unit.lat]);
        const plate = marker.getElement().querySelector('.plate');
        if (plate && plate.textContent !== unit.callsign) plate.textContent = unit.callsign;
      }
      marker.getElement().dataset.state = state;
    }

    for (const [id, marker] of unitMarkers.current) {
      if (!seen.has(id)) {
        marker.remove();
        unitMarkers.current.delete(id);
      }
    }
    // openConfirm is stable enough for this effect's purpose and depends only
    // on refs; including it would churn every marker on each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units, candidateIds, ready]);

  // ── Tethers and spokes ────────────────────────────────────────────────────
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const source = m.getSource('cmap-links') as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;

    const byResponder = new Map(units.filter((u) => u.responderId).map((u) => [u.responderId!, u]));
    const features: GeoJSON.Feature[] = [];

    for (const incident of incidents) {
      const at: [number, number] = [Number(incident.incident_lng), Number(incident.incident_lat)];
      for (const a of incident.incident_assignments ?? []) {
        if (!LIVE_ASSIGNMENT.includes(a.status)) continue;
        const unit = byResponder.get(a.responder_id);
        if (!unit || unit.lat == null || unit.lng == null) continue;
        features.push({
          type: 'Feature',
          properties: { kind: 'tether' },
          geometry: { type: 'LineString', coordinates: [[unit.lng, unit.lat], at] },
        });
      }
    }

    const selected = incidents.find((i) => i.id === selectedId);
    if (selected) {
      const at: [number, number] = [Number(selected.incident_lng), Number(selected.incident_lat)];
      for (const responderId of candidateIds) {
        const unit = byResponder.get(responderId);
        if (!unit || unit.lat == null || unit.lng == null) continue;
        features.push({
          type: 'Feature',
          properties: {
            kind: 'spoke',
            label: `${haversineKm(unit.lat, unit.lng, at[1], at[0]).toFixed(1)} km`,
          },
          geometry: { type: 'LineString', coordinates: [[unit.lng, unit.lat], at] },
        });
      }
    }

    source.setData({ type: 'FeatureCollection', features });
  }, [incidents, units, selectedId, candidateIds, ready, styleEpoch]);

  // ── The elapsed ring ──────────────────────────────────────────────────────
  // Written straight to the DOM each second. Rebuilding markers on a clock tick
  // would drop hover state and fight the browser on every frame.
  useEffect(() => {
    for (const incident of incidents) {
      const marker = incMarkers.current.get(incident.id);
      const ring = marker?.getElement().querySelector('.ring');
      if (!ring) continue;
      const done = ['resolved', 'cancelled', 'rejected'].includes(incident.status);
      const frac = done
        ? 1
        : Math.min(1, (now - new Date(incident.created_at).getTime()) / RING_FULL_MS);
      ring.setAttribute('stroke-dashoffset', String(RING_C * (1 - frac)));
    }
  }, [now, incidents]);

  // ── Camera ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;

    if (!selectedId) {
      // Nothing selected is the wall state: show the whole city.
      if (framed.current !== null) {
        framed.current = null;
        m.easeTo({ center: HOME.center, zoom: HOME.zoom, duration: 600 });
      }
      return;
    }

    // Only recentre when the dispatcher moves to a different call. Refitting on
    // every position update would have the map crawling under someone reading it.
    if (framed.current === selectedId) return;
    const incident = incidents.find((i) => i.id === selectedId);
    if (!incident) return;

    framed.current = selectedId;
    m.easeTo({
      center: [Number(incident.incident_lng), Number(incident.incident_lat)],
      zoom: 16,
      duration: 700,
    });
  }, [selectedId, incidents, ready]);

  // ── The structure under the pin ───────────────────────────────────────────
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;

    // Standard styles the selected building itself, so releasing the state is
    // the whole of "unhighlight" — there is no layer of ours to reset.
    const clear = () => {
      if (litBuilding.current) {
        m.removeFeatureState(litBuilding.current, 'select');
        litBuilding.current = null;
      }
    };

    const incident = incidents.find((i) => i.id === selectedId);
    if (!incident) {
      clear();
      return;
    }

    // Highlighting a building asserts "this structure". We only make that claim
    // when the reported pin and the reporter's own device agree; otherwise the
    // pin describes a neighbourhood and the crosshair alone is the honest mark.
    const confident =
      incident.device_lat != null &&
      incident.device_lng != null &&
      haversineKm(
        Number(incident.device_lat), Number(incident.device_lng),
        Number(incident.incident_lat), Number(incident.incident_lng)
      ) * 1000 <= BUILDING_CONFIDENCE_M;

    if (!confident) {
      clear();
      return;
    }

    const resolve = () => {
      // Buildings only exist in the tiles once you are close, so this can only
      // run after the camera has actually arrived.
      if (m.getZoom() < BUILDING_MIN_ZOOM) return;

      const point = m.project([Number(incident.incident_lng), Number(incident.incident_lat)]);

      let hit: mapboxgl.TargetFeature | undefined;
      try {
        hit = m.queryRenderedFeatures(point, {
          target: { featuresetId: 'buildings', importId: BASEMAP },
        })[0];
      } catch {
        // A style without the buildings featureset simply cannot do this. The
        // crosshair alone is a perfectly good mark, so this stays quiet.
        return;
      }
      if (!hit) return;

      // The building takes the incident's own colour, so the structure and the
      // strip that sent you there are unmistakably the same call.
      m.setConfigProperty(BASEMAP, 'colorBuildingSelect', TYPE_COLOR[incident.incident_type]);
      m.setFeatureState(hit, { select: true });
      litBuilding.current = hit;
    };

    clear();
    m.once('idle', resolve);
    return () => {
      m.off('idle', resolve);
    };
  }, [selectedId, incidents, ready, styleEpoch]);

  // ── Dispatch confirm ──────────────────────────────────────────────────────
  function openConfirm(unit: Unit) {
    const m = map.current;
    if (!m || unit.lat == null || unit.lng == null || !unit.responderId) return;

    popup.current?.remove();

    const node = document.createElement('div');
    node.innerHTML = `
      <div style="font:600 13px ui-monospace,SFMono-Regular,Menlo,monospace">${unit.callsign}</div>
      <div style="margin-top:2px;font-size:11px;opacity:.7">
        ${unit.agency ? AGENCY_LABEL[unit.agency] : 'Unassigned agency'}${
          unit.distanceKm != null ? ` · ${unit.distanceKm.toFixed(1)} km away` : ''
        }
      </div>
      <div style="display:flex;gap:6px;margin-top:9px">
        <button data-send style="padding:5px 10px;border-radius:2px;font-size:11.5px;font-weight:600;color:#fff;background:linear-gradient(90deg,#1CB8F7,#3B4CCA);cursor:pointer">Send</button>
        <button data-cancel style="padding:5px 8px;font-size:11.5px;opacity:.7;cursor:pointer">Cancel</button>
      </div>`;

    node.querySelector('[data-send]')?.addEventListener('click', () => {
      onDispatchRef.current(unit.responderId!);
      popup.current?.remove();
    });
    node.querySelector('[data-cancel]')?.addEventListener('click', () => popup.current?.remove());

    popup.current = new mapboxgl.Popup({
      className: 'cmap-popup',
      closeButton: false,
      offset: 26,
      anchor: 'bottom',
    })
      .setLngLat([unit.lng, unit.lat])
      .setDOMContent(node)
      .addTo(m);
  }

  useEffect(() => {
    // A dispatcher who has moved on to another call should not be looking at a
    // confirm box for the old one.
    popup.current?.remove();
  }, [selectedId]);

  if (!mapboxgl.accessToken) {
    return (
      <div className="flex h-full items-center justify-center bg-muted px-6 text-center text-[13px] text-muted-foreground">
        The map needs a Mapbox token. Set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN and reload.
      </div>
    );
  }

  return <div ref={container} className="h-full w-full" />;
}
