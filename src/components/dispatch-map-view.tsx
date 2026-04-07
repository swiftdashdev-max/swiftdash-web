'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { createRoot } from 'react-dom/client';
import { useInterpolatedMultipleDriverLocations } from '@/lib/ably-client';
import { createClient } from '@/lib/supabase/client';
import { DriverMarker } from '@/components/driver-marker';
import { Button } from '@/components/ui/button';
import {
  Navigation,
  Truck,
  UserCheck,
  Layers,
  ZoomIn,
  ZoomOut,
  LocateFixed,
  AlertTriangle,
  Clock,
  BoxSelect,
} from 'lucide-react';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '';

// ─── Types ────────────────────────────────────────────────────────
interface Delivery {
  id: string;
  tracking_number?: string;
  status: string;
  pickup_address: string;
  delivery_address: string;
  pickup_latitude?: number;
  pickup_longitude?: number;
  delivery_latitude?: number;
  delivery_longitude?: number;
  is_multi_stop?: boolean;
  total_stops?: number;
  driver_id?: string;
  delivery_contact_name?: string;
  delivery_contact_phone?: string;
  pickup_contact_name?: string;
  pickup_contact_phone?: string;
  total_price?: number;
  distance_km?: number;
  estimated_duration?: number;
  created_at: string;
}

interface Driver {
  id: string;
  full_name?: string;
  phone?: string;
  is_online: boolean;
  vehicle_model?: string;
  plate_number?: string;
  rating?: number;
}

interface DeliveryStop {
  id: string;
  delivery_id: string;
  stop_number: number;
  address: string;
  latitude: number;
  longitude: number;
  recipient_name?: string;
  recipient_phone?: string;
  status: string;
  delivery_notes?: string;
}

interface DispatchMapViewProps {
  deliveries: Delivery[];
  drivers: Driver[];
  selectedDeliveries: string[];
  onSelectDelivery: (id: string) => void;
  onViewDetails: (delivery: Delivery) => void;
  onAssign: () => void;
}

// ─── Status config ────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { color: string; label: string; emoji: string; pulse?: boolean }> = {
  pending:           { color: '#f59e0b', label: 'Pending',      emoji: '⏳', pulse: true },
  driver_offered:    { color: '#8b5cf6', label: 'Offered',      emoji: '📤' },
  driver_assigned:   { color: '#3b82f6', label: 'Assigned',     emoji: '👤' },
  going_to_pickup:   { color: '#0ea5e9', label: 'To Pickup',    emoji: '🚗' },
  pickup_arrived:    { color: '#0ea5e9', label: 'At Pickup',    emoji: '📍' },
  package_collected: { color: '#06b6d4', label: 'Collected',    emoji: '📦' },
  in_transit:        { color: '#0ea5e9', label: 'In Transit',   emoji: '🚚' },
  at_destination:    { color: '#14b8a6', label: 'Arriving',     emoji: '🏁' },
  delivered:         { color: '#10b981', label: 'Delivered',     emoji: '✅' },
  cancelled:         { color: '#ef4444', label: 'Cancelled',    emoji: '❌' },
};

// ─── Component ────────────────────────────────────────────────────
export function DispatchMapView({
  deliveries,
  drivers,
  selectedDeliveries,
  onSelectDelivery,
  onViewDetails,
  onAssign,
}: DispatchMapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const driverMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const routeLayerAdded = useRef(false);
  const isochroneAdded = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [showPickup, setShowPickup] = useState(true);
  const [showDropoff, setShowDropoff] = useState(true);
  const [showDrivers, setShowDrivers] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showIsochrone, setShowIsochrone] = useState(false);
  const [isochroneMinutes, setIsochroneMinutes] = useState(15);
  const [multiStopData, setMultiStopData] = useState<Map<string, DeliveryStop[]>>(new Map());
  const stopMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const [routeEta, setRouteEta] = useState<{ distance: number; duration: number } | null>(null);
  const [boxSelectMode, setBoxSelectMode] = useState(false);
  const boxSelectStart = useRef<{ x: number; y: number } | null>(null);
  const boxSelectOverlay = useRef<HTMLDivElement | null>(null);

  // Filter out cancelled/delivered by default — dispatcher only cares about active work
  const visibleDeliveries = useMemo(() => {
    return deliveries.filter(d => {
      if (d.status === 'cancelled') return false;
      if (d.status === 'delivered' && !showCompleted) return false;
      return true;
    });
  }, [deliveries, showCompleted]);

  // Fetch stops for multi-stop deliveries
  useEffect(() => {
    const multiStopIds = visibleDeliveries
      .filter(d => d.is_multi_stop)
      .map(d => d.id);

    if (multiStopIds.length === 0) {
      setMultiStopData(new Map());
      return;
    }

    // Only fetch for IDs we don't already have
    const missingIds = multiStopIds.filter(id => !multiStopData.has(id));
    if (missingIds.length === 0) return;

    const supabase = createClient();
    supabase
      .from('delivery_stops')
      .select('id, delivery_id, stop_number, address, latitude, longitude, recipient_name, recipient_phone, status, delivery_notes')
      .in('delivery_id', missingIds)
      .gt('stop_number', 0)
      .order('stop_number')
      .then(({ data }) => {
        if (!data) return;
        setMultiStopData(prev => {
          const next = new Map(prev);
          // Group by delivery_id
          missingIds.forEach(id => next.set(id, []));
          data.forEach(stop => {
            const existing = next.get(stop.delivery_id) || [];
            existing.push(stop as DeliveryStop);
            next.set(stop.delivery_id, existing);
          });
          return next;
        });
      });
  }, [visibleDeliveries]);

  // Get delivery IDs that have active drivers for Ably tracking
  const activeDeliveryIds = useMemo(() =>
    visibleDeliveries
      .filter(d => d.driver_id && !['delivered', 'cancelled', 'pending'].includes(d.status))
      .map(d => d.id),
    [visibleDeliveries]
  );

  const { locations: driverLocations } = useInterpolatedMultipleDriverLocations(activeDeliveryIds);

  // ── Initialize map ──────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/swiftdash/cmgtdgxbe000e01st0atdhrex',
      center: [121.0340, 14.5995],
      zoom: 11,
      pitch: 45,
      bearing: 0,
      antialias: true,
      preserveDrawingBuffer: true,
      trackResize: true,
      transformRequest: (url, resourceType) => {
        if (resourceType === 'Tile' || resourceType === 'Source') {
          return { url, headers: {}, credentials: 'same-origin' as const };
        }
        return { url };
      },
      attributionControl: false,
    });

    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left');

    map.on('load', () => {
      // Add empty route source + layer for route preview
      map.addSource('selected-route', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'selected-route-line',
        type: 'line',
        source: 'selected-route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#3b82f6',
          'line-width': 4,
          'line-opacity': 0.7,
          'line-dasharray': [2, 1],
          'line-emissive-strength': 1,
        },
      });
      routeLayerAdded.current = true;

      // Add isochrone source + layers
      map.addSource('isochrone', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'isochrone-fill',
        type: 'fill',
        source: 'isochrone',
        paint: {
          'fill-color': [
            'match', ['get', 'contour'],
            10, '#3b82f6',
            15, '#8b5cf6',
            20, '#f59e0b',
            30, '#ef4444',
            '#6b7280',
          ],
          'fill-opacity': 0.12,
        },
      });
      map.addLayer({
        id: 'isochrone-outline',
        type: 'line',
        source: 'isochrone',
        paint: {
          'line-color': [
            'match', ['get', 'contour'],
            10, '#3b82f6',
            15, '#8b5cf6',
            20, '#f59e0b',
            30, '#ef4444',
            '#6b7280',
          ],
          'line-width': 2,
          'line-opacity': 0.6,
        },
      });
      isochroneAdded.current = true;

      setMapReady(true);
    });

    // Fallback: if 'load' never fires, set ready on 'idle'
    map.on('idle', () => {
      // Add sources/layers if load didn't fire
      if (!routeLayerAdded.current && map.isStyleLoaded()) {
        try {
          map.addSource('selected-route', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });
          map.addLayer({
            id: 'selected-route-line',
            type: 'line',
            source: 'selected-route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': '#3b82f6',
              'line-width': 4,
              'line-opacity': 0.7,
              'line-dasharray': [2, 1],
              'line-emissive-strength': 1,
            },
          });
          routeLayerAdded.current = true;
        } catch (e) {
          console.warn('Failed to add route layer in idle fallback:', e);
        }
      }
      if (!isochroneAdded.current && map.isStyleLoaded()) {
        try {
          map.addSource('isochrone', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });
          map.addLayer({
            id: 'isochrone-fill',
            type: 'fill',
            source: 'isochrone',
            paint: {
              'fill-color': [
                'match', ['get', 'contour'],
                10, '#3b82f6',
                15, '#8b5cf6',
                20, '#f59e0b',
                30, '#ef4444',
                '#6b7280',
              ],
              'fill-opacity': 0.12,
            },
          });
          map.addLayer({
            id: 'isochrone-outline',
            type: 'line',
            source: 'isochrone',
            paint: {
              'line-color': [
                'match', ['get', 'contour'],
                10, '#3b82f6',
                15, '#8b5cf6',
                20, '#f59e0b',
                30, '#ef4444',
                '#6b7280',
              ],
              'line-width': 2,
              'line-opacity': 0.6,
            },
          });
          isochroneAdded.current = true;
        } catch (e) {
          console.warn('Failed to add isochrone layer in idle fallback:', e);
        }
      }
      setMapReady(true);
    });

    map.on('error', (e) => {
      console.warn('Map error:', e.error || e);
    });

    mapRef.current = map;

    // Force a resize after a short delay to ensure container has dimensions
    setTimeout(() => {
      mapRef.current?.resize();
    }, 100);

    return () => {
      markersRef.current.forEach(m => m.remove());
      driverMarkersRef.current.forEach(m => m.remove());
      stopMarkersRef.current.forEach(m => m.remove());
      markersRef.current.clear();
      driverMarkersRef.current.clear();
      stopMarkersRef.current.clear();
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
      routeLayerAdded.current = false;
      isochroneAdded.current = false;
    };
  }, []);

  // ── Show popup for a delivery ───────────────────────────────────
  const showDeliveryPopup = useCallback((delivery: Delivery, lngLat: [number, number], type: 'pickup' | 'dropoff') => {
    if (!mapRef.current) return;
    popupRef.current?.remove();

    const sc = STATUS_CONFIG[delivery.status] || STATUS_CONFIG.pending;
    const isSelected = selectedDeliveries.includes(delivery.id);
    const address = type === 'pickup' ? delivery.pickup_address : delivery.delivery_address;
    const contactName = type === 'pickup' ? delivery.pickup_contact_name : delivery.delivery_contact_name;
    const contactPhone = type === 'pickup' ? delivery.pickup_contact_phone : delivery.delivery_contact_phone;

    const html = `
      <div style="font-family:system-ui,-apple-system,sans-serif;min-width:220px;max-width:280px;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
          <span style="
            display:inline-flex;align-items:center;gap:4px;
            padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;
            background:${sc.color}18;color:${sc.color};border:1px solid ${sc.color}40;
          ">${sc.emoji} ${sc.label}</span>
          <span style="font-size:11px;color:#6b7280;font-family:monospace;">${delivery.tracking_number || ''}</span>
        </div>
        <div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:6px;">
          <span style="flex-shrink:0;margin-top:2px;">${type === 'pickup' ? '🟢' : '🔴'}</span>
          <div>
            <div style="font-size:11px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.5px;">${type === 'pickup' ? 'Pickup' : 'Dropoff'}</div>
            <div style="font-size:12px;color:#1f2937;margin-top:1px;line-height:1.3;">${address?.substring(0, 80) || 'No address'}${(address?.length || 0) > 80 ? '…' : ''}</div>
          </div>
        </div>
        ${contactName ? `
        <div style="display:flex;align-items:center;gap:6px;font-size:12px;color:#4b5563;margin-bottom:4px;">
          <span>👤</span>
          <span>${contactName}</span>
          ${contactPhone ? `<span style="color:#9ca3af;">· ${contactPhone}</span>` : ''}
        </div>
        ` : ''}
        <div style="display:flex;align-items:center;gap:8px;font-size:11px;color:#6b7280;margin-bottom:8px;">
          ${delivery.distance_km ? `<span>📏 ${delivery.distance_km.toFixed(1)} km</span>` : ''}
          ${delivery.total_price ? `<span>💰 ₱${delivery.total_price}</span>` : ''}
          ${delivery.is_multi_stop ? `<span>📦 ${delivery.total_stops || '?'} stops</span>` : ''}
        </div>
        <div style="display:flex;gap:6px;border-top:1px solid #e5e7eb;padding-top:8px;">
          <button
            onclick="document.dispatchEvent(new CustomEvent('dispatch-map-select', {detail:'${delivery.id}'}))"
            style="
              flex:1;padding:5px 0;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;
              border:1px solid ${isSelected ? '#3b82f6' : '#d1d5db'};
              background:${isSelected ? '#3b82f6' : '#fff'};
              color:${isSelected ? '#fff' : '#374151'};
            "
          >${isSelected ? '✓ Selected' : 'Select'}</button>
          <button
            onclick="document.dispatchEvent(new CustomEvent('dispatch-map-view', {detail:'${delivery.id}'}))"
            style="
              flex:1;padding:5px 0;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;
              border:1px solid #d1d5db;background:#fff;color:#374151;
            "
          >View Details</button>
        </div>
      </div>
    `;

    const popup = new mapboxgl.Popup({
      closeButton: true,
      closeOnClick: true,
      maxWidth: '300px',
      offset: [0, -10],
    })
      .setLngLat(lngLat)
      .setHTML(html)
      .addTo(mapRef.current);

    popupRef.current = popup;
  }, [selectedDeliveries]);

  // Listen for custom events from popup buttons
  useEffect(() => {
    const handleSelect = (e: Event) => {
      const id = (e as CustomEvent).detail;
      onSelectDelivery(id);
    };
    const handleView = (e: Event) => {
      const id = (e as CustomEvent).detail;
      const d = deliveries.find(del => del.id === id);
      if (d) onViewDetails(d);
    };

    const handleAssignDriver = () => {
      // Trigger the assign modal — the driver was clicked while orders are selected
      onAssign();
    };

    document.addEventListener('dispatch-map-select', handleSelect);
    document.addEventListener('dispatch-map-view', handleView);
    document.addEventListener('dispatch-map-assign-driver', handleAssignDriver);
    return () => {
      document.removeEventListener('dispatch-map-select', handleSelect);
      document.removeEventListener('dispatch-map-view', handleView);
      document.removeEventListener('dispatch-map-assign-driver', handleAssignDriver);
    };
  }, [deliveries, onSelectDelivery, onViewDetails, onAssign]);

  // Keep a ref to showDeliveryPopup so click handlers always call the latest version
  const showDeliveryPopupRef = useRef(showDeliveryPopup);
  useEffect(() => { showDeliveryPopupRef.current = showDeliveryPopup; }, [showDeliveryPopup]);

  // ── Render delivery markers ─────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const activeKeys = new Set<string>();

    visibleDeliveries.forEach((delivery) => {
      const sc = STATUS_CONFIG[delivery.status] || STATUS_CONFIG.pending;

      // Pickup marker
      if (showPickup && delivery.pickup_latitude && delivery.pickup_longitude) {
        const pickupKey = `pickup-${delivery.id}`;
        activeKeys.add(pickupKey);

        if (!markersRef.current.has(pickupKey)) {
          const el = createMarkerElement('pickup', sc, delivery);
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            showDeliveryPopupRef.current(delivery, [delivery.pickup_longitude!, delivery.pickup_latitude!], 'pickup');
          });

          const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([delivery.pickup_longitude, delivery.pickup_latitude])
            .addTo(map);

          markersRef.current.set(pickupKey, marker);
        }
      }

      // Dropoff marker
      if (showDropoff && delivery.delivery_latitude && delivery.delivery_longitude && !delivery.is_multi_stop) {
        const dropoffKey = `dropoff-${delivery.id}`;
        activeKeys.add(dropoffKey);

        if (!markersRef.current.has(dropoffKey)) {
          const el = createMarkerElement('dropoff', sc, delivery);
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            showDeliveryPopupRef.current(delivery, [delivery.delivery_longitude!, delivery.delivery_latitude!], 'dropoff');
          });

          const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([delivery.delivery_longitude, delivery.delivery_latitude])
            .addTo(map);

          markersRef.current.set(dropoffKey, marker);
        }
      }
    });

    // Remove stale markers
    markersRef.current.forEach((marker, key) => {
      if (!activeKeys.has(key)) {
        marker.remove();
        markersRef.current.delete(key);
      }
    });
  }, [mapReady, visibleDeliveries, showPickup, showDropoff]);

  // ── Render multi-stop markers ───────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !showDropoff) {
      stopMarkersRef.current.forEach(m => m.remove());
      stopMarkersRef.current.clear();
      return;
    }
    const map = mapRef.current;
    const activeStopKeys = new Set<string>();

    visibleDeliveries.forEach((delivery) => {
      if (!delivery.is_multi_stop) return;
      const stops = multiStopData.get(delivery.id);
      if (!stops || stops.length === 0) return;

      const sc = STATUS_CONFIG[delivery.status] || STATUS_CONFIG.pending;

      stops.forEach((stop) => {
        if (!stop.latitude || !stop.longitude) return;
        const stopKey = `stop-${stop.id}`;
        activeStopKeys.add(stopKey);

        if (!stopMarkersRef.current.has(stopKey)) {
          const el = createStopMarkerElement(stop, sc, delivery);
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            showStopPopup(stop, delivery, [stop.longitude, stop.latitude]);
          });

          const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([stop.longitude, stop.latitude])
            .addTo(map);

          stopMarkersRef.current.set(stopKey, marker);
        }
      });
    });

    // Remove stale stop markers
    stopMarkersRef.current.forEach((marker, key) => {
      if (!activeStopKeys.has(key)) {
        marker.remove();
        stopMarkersRef.current.delete(key);
      }
    });
  }, [mapReady, visibleDeliveries, multiStopData, showDropoff]);

  // ── Update selection styling ────────────────────────────────────
  useEffect(() => {
    markersRef.current.forEach((marker, key) => {
      const deliveryId = key.replace(/^(pickup|dropoff)-/, '');
      const isSelected = selectedDeliveries.includes(deliveryId);
      updateMarkerStyle(marker.getElement(), isSelected);
    });
    // Also update stop markers selection
    stopMarkersRef.current.forEach((marker, key) => {
      const stopId = key.replace(/^stop-/, '');
      // Find which delivery this stop belongs to
      let deliveryId = '';
      multiStopData.forEach((stops, dId) => {
        if (stops.some(s => s.id === stopId)) deliveryId = dId;
      });
      const isSelected = deliveryId ? selectedDeliveries.includes(deliveryId) : false;
      updateMarkerStyle(marker.getElement(), isSelected);
    });
  }, [selectedDeliveries, multiStopData]);

  // ── Render driver location markers ──────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !showDrivers) {
      driverMarkersRef.current.forEach(m => m.remove());
      driverMarkersRef.current.clear();
      return;
    }
    const map = mapRef.current;
    const activeDriverKeys = new Set<string>();

    driverLocations.forEach((loc, deliveryId) => {
      const delivery = visibleDeliveries.find(d => d.id === deliveryId);
      if (!delivery?.driver_id) return;

      const driverKey = `driver-${delivery.driver_id}`;
      activeDriverKeys.add(driverKey);
      const driverProfile = drivers.find(d => d.id === delivery.driver_id);
      const driverName = driverProfile?.full_name || 'Driver';

      const existing = driverMarkersRef.current.get(driverKey);
      if (existing) {
        existing.setLngLat([loc.longitude, loc.latitude]);
      } else {
        const el = document.createElement('div');
        el.style.cursor = 'pointer';
        const root = createRoot(el);
        root.render(
          <DriverMarker
            driverName={driverName}
            avatarUrl={null}
            heading={loc.heading || 0}
            isOnline={true}
            lastUpdateSeconds={0}
            speed={loc.speed || 0}
          />
        );

        // Driver info popup on click
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          showDriverPopup(delivery, driverProfile, loc, [loc.longitude, loc.latitude]);
        });

        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([loc.longitude, loc.latitude])
          .addTo(map);

        driverMarkersRef.current.set(driverKey, marker);
      }
    });

    driverMarkersRef.current.forEach((marker, key) => {
      if (!activeDriverKeys.has(key)) {
        marker.remove();
        driverMarkersRef.current.delete(key);
      }
    });
  }, [mapReady, driverLocations, visibleDeliveries, drivers, showDrivers]);

  // ── Draw route preview when orders are selected ─────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !routeLayerAdded.current) return;
    const map = mapRef.current;
    const source = map.getSource('selected-route') as mapboxgl.GeoJSONSource;
    if (!source) return;

    // Need at least 1 selected delivery to draw a route
    // (a single multi-stop order has multiple waypoints, so still draws a line)
    if (selectedDeliveries.length === 0) {
      source.setData({ type: 'FeatureCollection', features: [] });
      setRouteEta(null);
      return;
    }

    // Collect waypoints from selected deliveries (pickup → stops/dropoff for each)
    const waypoints: [number, number][] = [];
    selectedDeliveries.forEach(id => {
      const d = visibleDeliveries.find(del => del.id === id);
      if (!d) return;
      if (d.pickup_latitude && d.pickup_longitude) {
        waypoints.push([d.pickup_longitude, d.pickup_latitude]);
      }
      if (d.is_multi_stop) {
        // Add all stops in order
        const stops = multiStopData.get(d.id);
        if (stops) {
          stops.forEach(s => {
            if (s.latitude && s.longitude) {
              waypoints.push([s.longitude, s.latitude]);
            }
          });
        }
      } else if (d.delivery_latitude && d.delivery_longitude) {
        waypoints.push([d.delivery_longitude, d.delivery_latitude]);
      }
    });

    if (waypoints.length < 2) {
      source.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    // Limit to 25 waypoints (Mapbox Directions API limit)
    const limitedWaypoints = waypoints.slice(0, 25);
    const coords = limitedWaypoints.map(w => w.join(',')).join(';');

    fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&overview=full&access_token=${mapboxgl.accessToken}`
    )
      .then(res => res.json())
      .then(data => {
        if (data.routes && data.routes[0]) {
          const route = data.routes[0];
          source.setData({
            type: 'Feature',
            properties: {},
            geometry: route.geometry,
          } as GeoJSON.Feature);
          // Store ETA and distance for the route badge
          setRouteEta({
            distance: route.distance, // meters
            duration: route.duration, // seconds
          });
        }
      })
      .catch(err => console.warn('Route preview error:', err));
  }, [mapReady, selectedDeliveries, visibleDeliveries, multiStopData]);

  // ── Fit bounds ──────────────────────────────────────────────────
  const fitToAllMarkers = useCallback(() => {
    if (!mapRef.current) return;
    const bounds = new mapboxgl.LngLatBounds();
    let hasPoints = false;

    visibleDeliveries.forEach((d) => {
      if (d.pickup_latitude && d.pickup_longitude) {
        bounds.extend([d.pickup_longitude, d.pickup_latitude]);
        hasPoints = true;
      }
      if (d.is_multi_stop) {
        const stops = multiStopData.get(d.id);
        stops?.forEach(s => {
          if (s.latitude && s.longitude) {
            bounds.extend([s.longitude, s.latitude]);
            hasPoints = true;
          }
        });
      } else if (d.delivery_latitude && d.delivery_longitude) {
        bounds.extend([d.delivery_longitude, d.delivery_latitude]);
        hasPoints = true;
      }
    });

    driverLocations.forEach((loc) => {
      bounds.extend([loc.longitude, loc.latitude]);
      hasPoints = true;
    });

    if (hasPoints) {
      mapRef.current.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 800 });
    }
  }, [visibleDeliveries, driverLocations, multiStopData]);

  // Fit on initial load
  useEffect(() => {
    if (mapReady && visibleDeliveries.length > 0) {
      const timer = setTimeout(fitToAllMarkers, 500);
      return () => clearTimeout(timer);
    }
  }, [mapReady]);

  // ── Marker helpers ──────────────────────────────────────────────
  // IMPORTANT: Never set `transform` on a Mapbox marker element — Mapbox uses
  // `transform: translate(...)` internally for positioning. Overwriting it causes
  // markers to drift when zooming. Instead, style the inner wrapper div.
  function updateMarkerStyle(el: HTMLElement, isSelected: boolean) {
    const inner = el.querySelector('[data-marker-inner]') as HTMLElement | null;
    if (inner) {
      inner.style.transform = isSelected ? 'scale(1.2)' : 'scale(1)';
      inner.style.filter = isSelected ? 'drop-shadow(0 0 6px rgba(59,130,246,0.5))' : 'none';
      inner.style.transition = 'transform 0.2s ease, filter 0.2s ease';
      // Update border
      const badge = inner.querySelector('[data-marker-badge]') as HTMLElement | null;
      if (badge) {
        badge.style.borderColor = isSelected ? '#1d4ed8' : '#fff';
      }
    }
  }

  function createMarkerElement(
    type: 'pickup' | 'dropoff',
    sc: { color: string; label: string; emoji: string; pulse?: boolean },
    delivery: Delivery
  ): HTMLDivElement {
    const el = document.createElement('div');
    el.style.cursor = 'pointer';
    // Do NOT set transform on the outer element — Mapbox needs it for positioning

    const isPickup = type === 'pickup';
    const isPending = delivery.status === 'pending';
    const shortId = (delivery.tracking_number || '').replace(/^SD-\d{8}-/, '').substring(0, 5);

    el.innerHTML = `
      <div data-marker-inner style="display:flex;flex-direction:column;align-items:center;transition:transform 0.2s ease, filter 0.2s ease;">
        <div style="position:relative;">
          ${isPending ? `<div style="
            position:absolute;top:-4px;right:-4px;z-index:2;
            width:11px;height:11px;border-radius:50%;
            background:#f59e0b;border:2px solid #fff;
            animation:dispatch-pulse 1.5s infinite;
          "></div>` : ''}
          <div data-marker-badge style="
            min-width:38px;height:32px;border-radius:8px;
            background:${sc.color};
            border:2.5px solid #fff;
            box-shadow:0 2px 8px rgba(0,0,0,0.25);
            display:flex;align-items:center;justify-content:center;gap:3px;
            padding:0 7px;
            transition:border-color 0.2s ease;
          ">
            <span style="font-size:12px;line-height:1;">${isPickup ? '📍' : '🏁'}</span>
            ${shortId ? `<span style="
              font-size:10px;font-weight:700;color:#fff;
              font-family:ui-monospace,SFMono-Regular,monospace;letter-spacing:0.5px;
            ">${shortId}</span>` : ''}
          </div>
        </div>
        <div style="
          width:0;height:0;
          border-left:6px solid transparent;
          border-right:6px solid transparent;
          border-top:7px solid ${sc.color};
          margin-top:-1px;
        "></div>
      </div>
    `;

    el.title = `${isPickup ? 'Pickup' : 'Dropoff'} · ${delivery.tracking_number || ''} · ${sc.label}`;
    return el;
  }

  function createStopMarkerElement(
    stop: DeliveryStop,
    sc: { color: string; label: string },
    delivery: Delivery
  ): HTMLDivElement {
    const el = document.createElement('div');
    el.style.cursor = 'pointer';

    const stopColor = stop.status === 'completed' ? '#10b981' : stop.status === 'in_progress' ? '#0ea5e9' : sc.color;

    el.innerHTML = `
      <div data-marker-inner style="display:flex;flex-direction:column;align-items:center;transition:transform 0.2s ease, filter 0.2s ease;">
        <div style="position:relative;">
          <div data-marker-badge style="
            width:32px;height:32px;border-radius:50%;
            background:${stopColor};
            border:2.5px solid #fff;
            box-shadow:0 2px 8px rgba(0,0,0,0.25);
            display:flex;align-items:center;justify-content:center;
            transition:border-color 0.2s ease;
          ">
            <span style="
              font-size:13px;font-weight:800;color:#fff;
              font-family:ui-monospace,SFMono-Regular,monospace;
            ">${stop.stop_number}</span>
          </div>
        </div>
        <div style="
          width:0;height:0;
          border-left:5px solid transparent;
          border-right:5px solid transparent;
          border-top:6px solid ${stopColor};
          margin-top:-1px;
        "></div>
      </div>
    `;

    el.title = `Stop ${stop.stop_number} · ${stop.recipient_name || ''} · ${stop.address?.substring(0, 40) || ''}`;
    return el;
  }

  function showStopPopup(stop: DeliveryStop, delivery: Delivery, lngLat: [number, number]) {
    if (!mapRef.current) return;
    popupRef.current?.remove();

    const sc = STATUS_CONFIG[delivery.status] || STATUS_CONFIG.pending;
    const stopStatusColor = stop.status === 'completed' ? '#10b981' : stop.status === 'in_progress' ? '#0ea5e9' : sc.color;
    const stopStatusLabel = stop.status === 'completed' ? 'Completed' : stop.status === 'in_progress' ? 'In Progress' : 'Pending';
    const isSelected = selectedDeliveries.includes(delivery.id);

    const html = `
      <div style="font-family:system-ui,-apple-system,sans-serif;min-width:220px;max-width:280px;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
          <span style="
            display:inline-flex;align-items:center;justify-content:center;
            width:24px;height:24px;border-radius:50%;
            background:${stopStatusColor};color:#fff;
            font-size:12px;font-weight:800;font-family:ui-monospace,SFMono-Regular,monospace;
          ">${stop.stop_number}</span>
          <span style="
            display:inline-flex;align-items:center;gap:4px;
            padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;
            background:${stopStatusColor}18;color:${stopStatusColor};border:1px solid ${stopStatusColor}40;
          ">${stopStatusLabel}</span>
          <span style="font-size:10px;color:#9ca3af;font-family:monospace;">${delivery.tracking_number || ''}</span>
        </div>
        <div style="font-size:12px;color:#1f2937;margin-bottom:6px;line-height:1.3;">
          ${stop.address?.substring(0, 100) || 'No address'}${(stop.address?.length || 0) > 100 ? '…' : ''}
        </div>
        ${stop.recipient_name ? `
        <div style="display:flex;align-items:center;gap:6px;font-size:12px;color:#4b5563;margin-bottom:4px;">
          <span>👤</span>
          <span>${stop.recipient_name}</span>
          ${stop.recipient_phone ? `<span style="color:#9ca3af;">· ${stop.recipient_phone}</span>` : ''}
        </div>
        ` : ''}
        ${stop.delivery_notes ? `
        <div style="font-size:11px;color:#6b7280;margin-bottom:6px;padding:4px 6px;background:#f9fafb;border-radius:4px;">
          📝 ${stop.delivery_notes.substring(0, 60)}${stop.delivery_notes.length > 60 ? '…' : ''}
        </div>
        ` : ''}
        <div style="display:flex;gap:6px;border-top:1px solid #e5e7eb;padding-top:8px;">
          <button
            onclick="document.dispatchEvent(new CustomEvent('dispatch-map-select', {detail:'${delivery.id}'}))"
            style="
              flex:1;padding:5px 0;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;
              border:1px solid ${isSelected ? '#3b82f6' : '#d1d5db'};
              background:${isSelected ? '#3b82f6' : '#fff'};
              color:${isSelected ? '#fff' : '#374151'};
            "
          >${isSelected ? '✓ Selected' : 'Select Order'}</button>
          <button
            onclick="document.dispatchEvent(new CustomEvent('dispatch-map-view', {detail:'${delivery.id}'}))"
            style="
              flex:1;padding:5px 0;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;
              border:1px solid #d1d5db;background:#fff;color:#374151;
            "
          >View All Stops</button>
        </div>
      </div>
    `;

    const popup = new mapboxgl.Popup({
      closeButton: true,
      closeOnClick: true,
      maxWidth: '300px',
      offset: [0, -10],
    })
      .setLngLat(lngLat)
      .setHTML(html)
      .addTo(mapRef.current);

    popupRef.current = popup;
  }

  // ── Show driver info popup ──────────────────────────────────────
  function showDriverPopup(
    delivery: Delivery,
    driver: Driver | undefined,
    loc: { latitude: number; longitude: number; speed?: number; heading?: number },
    lngLat: [number, number]
  ) {
    if (!mapRef.current) return;
    popupRef.current?.remove();

    const name = driver?.full_name || 'Unknown Driver';
    const vehicle = driver?.vehicle_model || 'N/A';
    const plate = driver?.plate_number || 'N/A';
    const rating = driver?.rating ? `⭐ ${driver.rating.toFixed(1)}` : '';
    const speed = loc.speed ? `${(loc.speed * 3.6).toFixed(0)} km/h` : 'Idle';
    const sc = STATUS_CONFIG[delivery.status] || STATUS_CONFIG.pending;
    const trackingId = delivery.tracking_number || '';
    const hasSelected = selectedDeliveries.length > 0;

    const html = `
      <div style="font-family:system-ui,-apple-system,sans-serif;min-width:230px;max-width:290px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <div style="
            width:36px;height:36px;border-radius:50%;
            background:linear-gradient(135deg,#3b82f6,#1d4ed8);
            display:flex;align-items:center;justify-content:center;
            font-size:16px;color:#fff;font-weight:700;
            border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.2);
          ">${name.charAt(0).toUpperCase()}</div>
          <div>
            <div style="font-size:13px;font-weight:700;color:#1f2937;">${name}</div>
            <div style="font-size:11px;color:#6b7280;">${driver?.phone || ''} ${rating}</div>
          </div>
        </div>
        <div style="display:flex;gap:12px;margin-bottom:8px;padding:6px 8px;background:#f9fafb;border-radius:6px;">
          <div style="font-size:11px;">
            <div style="color:#9ca3af;font-weight:600;">Vehicle</div>
            <div style="color:#374151;font-weight:500;">${vehicle}</div>
          </div>
          <div style="font-size:11px;">
            <div style="color:#9ca3af;font-weight:600;">Plate</div>
            <div style="color:#374151;font-weight:500;">${plate}</div>
          </div>
          <div style="font-size:11px;">
            <div style="color:#9ca3af;font-weight:600;">Speed</div>
            <div style="color:#374151;font-weight:500;">🏎️ ${speed}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
          <span style="
            display:inline-flex;align-items:center;gap:4px;
            padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;
            background:${sc.color}18;color:${sc.color};border:1px solid ${sc.color}40;
          ">${sc.emoji} ${sc.label}</span>
          <span style="font-size:10px;color:#9ca3af;font-family:monospace;">${trackingId}</span>
        </div>
        <div style="display:flex;gap:6px;border-top:1px solid #e5e7eb;padding-top:8px;">
          <button
            onclick="document.dispatchEvent(new CustomEvent('dispatch-map-view', {detail:'${delivery.id}'}))"
            style="
              flex:1;padding:5px 0;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;
              border:1px solid #d1d5db;background:#fff;color:#374151;
            "
          >View Delivery</button>
          ${hasSelected ? `
          <button
            onclick="document.dispatchEvent(new CustomEvent('dispatch-map-assign-driver', {detail:'${driver?.id || ''}'}))"
            style="
              flex:1;padding:5px 0;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;
              border:1px solid #3b82f6;background:#3b82f6;color:#fff;
            "
          >Assign ${selectedDeliveries.length} Order${selectedDeliveries.length > 1 ? 's' : ''}</button>
          ` : ''}
        </div>
      </div>
    `;

    const popup = new mapboxgl.Popup({
      closeButton: true,
      closeOnClick: true,
      maxWidth: '310px',
      offset: [0, -24],
    })
      .setLngLat(lngLat)
      .setHTML(html)
      .addTo(mapRef.current);

    popupRef.current = popup;
  }

  // ── Add pulse animation CSS ─────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && boxSelectMode) {
        setBoxSelectMode(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [boxSelectMode]);

  // ── Add pulse animation CSS ─────────────────────────────────────
  useEffect(() => {
    const styleId = 'dispatch-map-pulse-style';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes dispatch-pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(1.4); }
      }
    `;
    document.head.appendChild(style);
    return () => { document.getElementById(styleId)?.remove(); };
  }, []);

  // ── Isochrone zones ─────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !isochroneAdded.current) return;
    const map = mapRef.current;
    const source = map.getSource('isochrone') as mapboxgl.GeoJSONSource;
    if (!source) return;

    if (!showIsochrone) {
      source.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    // Calculate centroid of pending deliveries as isochrone origin
    const pendingWithCoords = visibleDeliveries.filter(
      d => d.status === 'pending' && d.pickup_latitude && d.pickup_longitude
    );
    if (pendingWithCoords.length === 0) {
      source.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    const centroid: [number, number] = [
      pendingWithCoords.reduce((sum, d) => sum + d.pickup_longitude!, 0) / pendingWithCoords.length,
      pendingWithCoords.reduce((sum, d) => sum + d.pickup_latitude!, 0) / pendingWithCoords.length,
    ];

    const contours = [10, isochroneMinutes, 30].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b);

    fetch(
      `https://api.mapbox.com/isochrone/v1/mapbox/driving/${centroid[0]},${centroid[1]}?contours_minutes=${contours.join(',')}&polygons=true&access_token=${mapboxgl.accessToken}`
    )
      .then(res => res.json())
      .then(data => {
        if (data.features) {
          source.setData(data);
        }
      })
      .catch(err => console.warn('Isochrone error:', err));
  }, [mapReady, showIsochrone, isochroneMinutes, visibleDeliveries]);

  // ── Box select (shift+drag area select) ─────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const canvas = map.getCanvasContainer();

    if (!boxSelectMode) {
      canvas.style.cursor = '';
      map.dragPan.enable();
      map.boxZoom.enable();
      return;
    }

    canvas.style.cursor = 'crosshair';
    map.dragPan.disable();
    map.boxZoom.disable();

    const onMouseDown = (e: MouseEvent) => {
      if (!boxSelectMode) return;
      boxSelectStart.current = { x: e.clientX, y: e.clientY };

      // Create overlay
      const overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.border = '2px dashed #3b82f6';
      overlay.style.background = 'rgba(59,130,246,0.08)';
      overlay.style.borderRadius = '4px';
      overlay.style.pointerEvents = 'none';
      overlay.style.zIndex = '9999';
      document.body.appendChild(overlay);
      boxSelectOverlay.current = overlay;

      const onMouseMove = (ev: MouseEvent) => {
        if (!boxSelectStart.current || !boxSelectOverlay.current) return;
        const start = boxSelectStart.current;
        const left = Math.min(start.x, ev.clientX);
        const top = Math.min(start.y, ev.clientY);
        const w = Math.abs(ev.clientX - start.x);
        const h = Math.abs(ev.clientY - start.y);
        boxSelectOverlay.current.style.left = left + 'px';
        boxSelectOverlay.current.style.top = top + 'px';
        boxSelectOverlay.current.style.width = w + 'px';
        boxSelectOverlay.current.style.height = h + 'px';
      };

      const onMouseUp = (ev: MouseEvent) => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        boxSelectOverlay.current?.remove();
        boxSelectOverlay.current = null;

        if (!boxSelectStart.current) return;
        const start = boxSelectStart.current;
        boxSelectStart.current = null;

        // Only register if drag was at least 10px
        if (Math.abs(ev.clientX - start.x) < 10 || Math.abs(ev.clientY - start.y) < 10) return;

        // Convert screen coordinates to map coordinates
        const mapCanvas = map.getCanvas();
        const rect = mapCanvas.getBoundingClientRect();
        const sw = map.unproject([
          Math.min(start.x, ev.clientX) - rect.left,
          Math.max(start.y, ev.clientY) - rect.top,
        ]);
        const ne = map.unproject([
          Math.max(start.x, ev.clientX) - rect.left,
          Math.min(start.y, ev.clientY) - rect.top,
        ]);

        // Find deliveries within the box
        const bounds = new mapboxgl.LngLatBounds(sw, ne);
        const idsInBox: string[] = [];

        visibleDeliveries.forEach(d => {
          let inBox = false;
          if (d.pickup_latitude && d.pickup_longitude) {
            if (bounds.contains([d.pickup_longitude, d.pickup_latitude])) inBox = true;
          }
          if (d.delivery_latitude && d.delivery_longitude) {
            if (bounds.contains([d.delivery_longitude, d.delivery_latitude])) inBox = true;
          }
          if (d.is_multi_stop) {
            const stops = multiStopData.get(d.id);
            stops?.forEach(s => {
              if (s.latitude && s.longitude && bounds.contains([s.longitude, s.latitude])) inBox = true;
            });
          }
          if (inBox && !selectedDeliveries.includes(d.id)) {
            idsInBox.push(d.id);
          }
        });

        // Select all deliveries in the box
        idsInBox.forEach(id => onSelectDelivery(id));

        // Auto-exit box select mode
        setBoxSelectMode(false);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    canvas.addEventListener('mousedown', onMouseDown);
    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.style.cursor = '';
      map.dragPan.enable();
      map.boxZoom.enable();
    };
  }, [mapReady, boxSelectMode, visibleDeliveries, selectedDeliveries, multiStopData, onSelectDelivery]);

  // ── Counts ─────────────────────────────────────────────────────
  const pendingCount = visibleDeliveries.filter(d => d.status === 'pending').length;
  const offeredCount = visibleDeliveries.filter(d => d.status === 'driver_offered').length;
  const activeCount = visibleDeliveries.filter(d =>
    ['driver_assigned', 'going_to_pickup', 'pickup_arrived', 'package_collected', 'in_transit', 'at_destination'].includes(d.status)
  ).length;
  const completedCount = deliveries.filter(d => d.status === 'delivered').length;
  const cancelledCount = deliveries.filter(d => d.status === 'cancelled').length;
  const liveDriverCount = driverLocations.size;
  const unassignedCount = visibleDeliveries.filter(d => !d.driver_id && ['pending', 'driver_offered'].includes(d.status)).length;

  return (
    <div className="relative w-full h-[calc(100vh-140px)] overflow-hidden">
      {/* Map container */}
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" />

      {/* Map controls — top right */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5">
        <Button
          variant="secondary"
          size="icon"
          className="h-8 w-8 bg-white shadow-md hover:bg-gray-50 text-gray-700"
          onClick={() => mapRef.current?.zoomIn()}
          title="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-8 w-8 bg-white shadow-md hover:bg-gray-50 text-gray-700"
          onClick={() => mapRef.current?.zoomOut()}
          title="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-8 w-8 bg-white shadow-md hover:bg-gray-50 text-gray-700"
          onClick={fitToAllMarkers}
          title="Fit all markers"
        >
          <LocateFixed className="h-4 w-4" />
        </Button>
      </div>

      {/* Layer toggles — top left */}
      <div className="absolute top-3 left-3 z-10 bg-white rounded-xl shadow-lg p-2.5 space-y-1 min-w-[155px]">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 px-1 pb-1 border-b border-gray-100 mb-1">
          <Layers className="h-3.5 w-3.5" />
          Layers
        </div>
        <LayerToggle checked={showPickup} onChange={setShowPickup} icon="📍" label="Pickups" />
        <LayerToggle checked={showDropoff} onChange={setShowDropoff} icon="🏁" label="Dropoffs" />
        <LayerToggle checked={showDrivers} onChange={setShowDrivers} icon="🚗" label={`Drivers${liveDriverCount > 0 ? ` (${liveDriverCount})` : ''}`} />
        <div className="border-t border-gray-100 pt-1 mt-1">
          <LayerToggle checked={showCompleted} onChange={setShowCompleted} icon="✅" label={`Delivered (${completedCount})`} />
          <LayerToggle checked={showIsochrone} onChange={setShowIsochrone} icon="🔵" label="Drive Zones" />
          {showIsochrone && (
            <div className="flex items-center gap-1.5 px-1.5 pt-0.5">
              {[10, 15, 20, 30].map(mins => (
                <button
                  key={mins}
                  onClick={() => setIsochroneMinutes(mins)}
                  className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    isochroneMinutes === mins
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {mins}m
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Status legend — bottom left */}
      <div className="absolute bottom-3 left-3 z-10 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg px-3 py-2 flex items-center gap-3 text-xs font-medium">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
          <span>Pending ({pendingCount})</span>
        </div>
        {offeredCount > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
            <span>Offered ({offeredCount})</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-sky-500" />
          <span>Active ({activeCount})</span>
        </div>
        {liveDriverCount > 0 && (
          <div className="flex items-center gap-1.5">
            <Truck className="h-3 w-3 text-blue-600" />
            <span>{liveDriverCount} live</span>
          </div>
        )}
        <div className="text-gray-400">|</div>
        <span className="text-gray-400">{cancelledCount} cancelled (hidden)</span>
      </div>

      {/* Selection action bar — bottom center */}
      {selectedDeliveries.length > 0 && (
        <div className="absolute bottom-14 left-1/2 transform -translate-x-1/2 z-10 bg-white shadow-xl rounded-xl px-4 py-2.5 flex items-center gap-3 border border-blue-200">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-7 w-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
              {selectedDeliveries.length}
            </div>
            <span className="text-sm font-semibold">selected</span>
          </div>
          <div className="w-px h-6 bg-gray-200" />
          <Button size="sm" onClick={onAssign} className="gap-1.5 bg-blue-600 hover:bg-blue-700">
            <UserCheck className="h-3.5 w-3.5" />
            Assign Driver
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              selectedDeliveries.forEach(id => onSelectDelivery(id));
            }}
            className="text-xs"
          >
            Clear
          </Button>
        </div>
      )}

      {/* Unassigned orders alert badge — top center */}
      {unassignedCount > 0 && selectedDeliveries.length === 0 && (
        <div className="absolute top-3 left-1/2 transform -translate-x-1/2 z-10 bg-amber-500 text-white shadow-lg rounded-lg px-3.5 py-2 text-xs font-semibold flex items-center gap-2 animate-pulse">
          <AlertTriangle className="h-3.5 w-3.5" />
          {unassignedCount} order{unassignedCount !== 1 ? 's' : ''} need{unassignedCount === 1 ? 's' : ''} a driver
        </div>
      )}

      {/* Route preview info badge with ETA */}
      {selectedDeliveries.length >= 1 && (
        (() => {
          const hasMultiStop = selectedDeliveries.some(id => visibleDeliveries.find(d => d.id === id)?.is_multi_stop);
          const showBadge = selectedDeliveries.length >= 2 || hasMultiStop;
          if (!showBadge) return null;
          const totalStops = selectedDeliveries.reduce((sum, id) => {
            const d = visibleDeliveries.find(del => del.id === id);
            if (!d) return sum;
            if (d.is_multi_stop) return sum + (multiStopData.get(d.id)?.length || d.total_stops || 0);
            return sum + 1;
          }, 0);
          const etaText = routeEta
            ? (() => {
                const mins = Math.round(routeEta.duration / 60);
                const km = (routeEta.distance / 1000).toFixed(1);
                return `${mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`} · ${km} km`;
              })()
            : null;
          return (
            <div className="absolute top-3 left-1/2 transform -translate-x-1/2 z-10 bg-blue-600 text-white shadow-lg rounded-xl px-4 py-2 text-xs font-medium flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Navigation className="h-3 w-3" />
                <span>{selectedDeliveries.length} order{selectedDeliveries.length > 1 ? 's' : ''} · {totalStops} stop{totalStops !== 1 ? 's' : ''}</span>
              </div>
              {etaText && (
                <>
                  <div className="w-px h-4 bg-blue-400" />
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    <span>{etaText}</span>
                  </div>
                </>
              )}
            </div>
          );
        })()
      )}

      {/* Box select button — top right, below zoom controls */}
      <div className="absolute top-[140px] right-3 z-10">
        <Button
          variant={boxSelectMode ? 'default' : 'secondary'}
          size="icon"
          className={`h-8 w-8 shadow-md ${
            boxSelectMode
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-white hover:bg-gray-50 text-gray-700'
          }`}
          onClick={() => setBoxSelectMode(prev => !prev)}
          title={boxSelectMode ? 'Exit area select' : 'Area select — drag to select multiple orders'}
        >
          <BoxSelect className="h-4 w-4" />
        </Button>
      </div>

      {/* Box select mode indicator */}
      {boxSelectMode && (
        <div className="absolute top-3 left-1/2 transform -translate-x-1/2 z-10 bg-blue-600 text-white shadow-lg rounded-lg px-3.5 py-2 text-xs font-semibold flex items-center gap-2">
          <BoxSelect className="h-3.5 w-3.5" />
          Drag to select orders in area · Press Esc or click button to cancel
        </div>
      )}
    </div>
  );
}

// ── Layer toggle sub-component ──────────────────────────────────
function LayerToggle({
  checked,
  onChange,
  icon,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  icon: string;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-gray-50 cursor-pointer text-sm select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onChange(!checked)}
        className="rounded border-gray-300 h-3.5 w-3.5 focus:ring-1 focus:ring-offset-0"
      />
      <span className="text-sm">{icon}</span>
      <span className={`text-xs font-medium ${checked ? 'text-gray-800' : 'text-gray-400'}`}>{label}</span>
    </label>
  );
}
