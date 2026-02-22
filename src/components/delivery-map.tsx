'use client';

import React, { useEffect, useRef, useState, memo, useCallback, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { fetchCachedRoute } from '@/lib/route-cache';
import { 
  fetchMapboxRoute, 
  RouteAlternative,
  getVehicleRoutingProfile,
  getVehicleExclusions
} from '@/lib/mapbox-routing';

// Mapbox access token from environment variable
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '';

interface Location {
  lat: number;
  lng: number;
  label?: string;
  type?: 'pickup' | 'dropoff';
}

interface RouteInfo {
  distance: number; // in kilometers
  duration: number; // in minutes
  polyline: any; // GeoJSON geometry
  alternatives?: RouteAlternative[]; // Alternative routes
  hasTrafficData?: boolean; // Whether route includes congestion data
}

interface DeliveryMapProps {
  pickup?: Location;
  dropoffs?: Location[];
  className?: string;
  onRouteCalculated?: (routeInfo: RouteInfo) => void;
  onPickupDragEnd?: (lat: number, lng: number) => void;
  onDropoffDragEnd?: (index: number, lat: number, lng: number) => void;
  vehicleType?: string; // Vehicle type for routing profile
  showTraffic?: boolean; // Whether to show traffic gradients
  showAlternatives?: boolean; // Whether to fetch route alternatives
  selectedRouteIndex?: number; // Which alternative route to display (0 = primary)
  onRouteSelected?: (index: number, routeInfo: { distance: number; duration: number }) => void; // Callback when user selects an alternative
}

// Memoized marker creation functions
const createPickupMarkerElement = () => {
  const el = document.createElement('div');
  el.className = 'pickup-marker';
  el.style.width = '40px';
  el.style.height = '40px';
  el.style.backgroundImage = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='%2310b981' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z'/%3E%3Ccircle cx='12' cy='10' r='3' fill='%2310b981'/%3E%3C/svg%3E")`;
  el.style.backgroundSize = 'contain';
  el.style.cursor = 'pointer';
  return el;
};

const createDropoffMarkerElement = (index?: number, total?: number) => {
  const el = document.createElement('div');
  el.className = 'dropoff-marker';
  el.style.width = '40px';
  el.style.height = '40px';
  el.style.backgroundImage = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='%23ef4444' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z'/%3E%3Ccircle cx='12' cy='10' r='3' fill='%23ef4444'/%3E%3C/svg%3E")`;
  el.style.backgroundSize = 'contain';
  el.style.cursor = 'pointer';

  // Add number badge for multi-stop
  if (typeof index === 'number' && typeof total === 'number' && total > 1) {
    const badge = document.createElement('div');
    badge.className = 'marker-badge';
    badge.style.position = 'absolute';
    badge.style.top = '-5px';
    badge.style.right = '-5px';
    badge.style.width = '20px';
    badge.style.height = '20px';
    badge.style.borderRadius = '50%';
    badge.style.backgroundColor = '#ef4444';
    badge.style.color = 'white';
    badge.style.display = 'flex';
    badge.style.alignItems = 'center';
    badge.style.justifyContent = 'center';
    badge.style.fontSize = '11px';
    badge.style.fontWeight = 'bold';
    badge.style.border = '2px solid white';
    badge.textContent = (index + 1).toString();
    el.appendChild(badge);
  }

  return el;
};

const DeliveryMapComponent = ({ 
  pickup, 
  dropoffs = [], 
  className = '', 
  onRouteCalculated, 
  onPickupDragEnd, 
  onDropoffDragEnd,
  vehicleType,
  showTraffic = true,
  showAlternatives = false,
  selectedRouteIndex = 0,
  onRouteSelected
}: DeliveryMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const pickupMarker = useRef<mapboxgl.Marker | null>(null);
  const dropoffMarkers = useRef<mapboxgl.Marker[]>([]);
  const animationFrameId = useRef<number | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [routeAlternatives, setRouteAlternatives] = useState<RouteAlternative[]>([]);
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);

  // Memoize coordinates for route calculation to prevent unnecessary re-calculations
  const coordinates = useMemo(() => {
    if (!pickup || dropoffs.length === 0) return null;
    return [
      [pickup.lng, pickup.lat],
      ...dropoffs.map(d => [d.lng, d.lat]),
    ];
  }, [pickup?.lng, pickup?.lat, dropoffs.map(d => `${d.lng},${d.lat}`).join('|')]);

  // Initialize map once and keep it persistent (Option A - Performance Optimization)
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    console.log('🗺️ Initializing map (first load only)...');

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/swiftdash/cmgtdgxbe000e01st0atdhrex', // Custom SwiftDash style
      center: [121.0340, 14.5995], // Metro Manila
      zoom: 11,
      pitch: 45,
      bearing: 0,
      // Performance optimizations
      antialias: true, // Enable antialiasing for crisp rendering
      preserveDrawingBuffer: true, // Helps with screenshots/exports
      trackResize: true, // Auto-handle container resize
      // Enable aggressive caching for map tiles
      transformRequest: (url, resourceType) => {
        if (resourceType === 'Tile' || resourceType === 'Source') {
          return {
            url: url,
            headers: {},
            credentials: 'same-origin'
          };
        }
      },
    });

    map.current.on('load', () => {
      console.log('✅ Map loaded successfully (cached for subsequent renders)');
      setIsMapReady(true);
    });

    map.current.on('idle', () => {
      if (!isMapReady) {
        console.log('✅ Map idle - ready for route calculation');
        setIsMapReady(true);
      }
    });

    map.current.on('error', (e) => {
      console.error('❌ Map error:', e.error || e);
      if (e.error?.message) {
        console.error('Error message:', e.error.message);
      }
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Add fullscreen control
    map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');

    // Add geolocate control
    map.current.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true,
        },
        trackUserLocation: true,
        showUserHeading: true,
      }),
      'top-right'
    );

    // Cleanup only on unmount (keep map persistent during component lifecycle)
    return () => {
      console.log('🗺️ Cleaning up map instance');
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
      setIsMapReady(false);
    };
  }, []); // Empty deps - only initialize once

  // Handle window resize to adjust map
  useEffect(() => {
    if (!map.current) return;

    const handleResize = () => {
      if (map.current) {
        map.current.resize();
        console.log('🗺️ Map resized');
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Update pickup marker
  useEffect(() => {
    if (!map.current || !pickup) {
      console.log('⏳ Pickup marker update skipped:', { hasMap: !!map.current, hasPickup: !!pickup });
      return;
    }

    console.log('📍 Updating pickup marker:', { lat: pickup.lat, lng: pickup.lng, label: pickup.label });

    // Remove existing pickup marker
    if (pickupMarker.current) {
      pickupMarker.current.remove();
    }

    // Create pickup marker
    const el = createPickupMarkerElement();

    // Add pickup marker with draggable option
    pickupMarker.current = new mapboxgl.Marker({ element: el, draggable: true })
      .setLngLat([pickup.lng, pickup.lat])
      .setPopup(
        new mapboxgl.Popup({ offset: 25 }).setHTML(
          `<div class="font-semibold text-sm">Pickup Location</div>
           <div class="text-xs text-muted-foreground">${pickup.label || 'Pickup Point'}</div>`
        )
      )
      .addTo(map.current);

    // Add dragend event listener
    if (onPickupDragEnd) {
      pickupMarker.current.on('dragend', () => {
        const lngLat = pickupMarker.current!.getLngLat();
        console.log('🎯 Pickup marker dragged to:', { lat: lngLat.lat, lng: lngLat.lng });
        onPickupDragEnd(lngLat.lat, lngLat.lng);
      });
    }

    console.log('✅ Pickup marker added to map');

    // Fly to pickup location only if this is the first location set
    if (!dropoffs.length) {
      map.current.flyTo({
        center: [pickup.lng, pickup.lat],
        zoom: 14,
        duration: 800, // Fast animation for better UX
        essential: true, // This animation is considered essential
      });
    }
  }, [pickup, dropoffs.length]);

  // Update dropoff markers
  useEffect(() => {
    if (!map.current) {
      console.log('⏳ Dropoff markers update skipped - no map');
      return;
    }

    console.log('📍 Updating dropoff markers:', { count: dropoffs.length });

    // Remove existing dropoff markers
    dropoffMarkers.current.forEach(marker => marker.remove());
    dropoffMarkers.current = [];

    if (dropoffs.length === 0) return;

    // Add dropoff markers
    dropoffs.forEach((dropoff, index) => {
      console.log(`  📍 Adding dropoff #${index + 1}:`, { lat: dropoff.lat, lng: dropoff.lng, label: dropoff.label });
      
      const el = createDropoffMarkerElement(index, dropoffs.length);

      const marker = new mapboxgl.Marker({ element: el, draggable: true })
        .setLngLat([dropoff.lng, dropoff.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(
            `<div class="font-semibold text-sm">Dropoff Location ${dropoffs.length > 1 ? `#${index + 1}` : ''}</div>
             <div class="text-xs text-muted-foreground">${dropoff.label || 'Dropoff Point'}</div>`
          )
        );
      
      // Add dragend event listener
      if (onDropoffDragEnd) {
        const dropoffIndex = index; // Capture index in closure
        marker.on('dragend', () => {
          const lngLat = marker.getLngLat();
          console.log(`🎯 Dropoff marker #${dropoffIndex + 1} dragged to:`, { lat: lngLat.lat, lng: lngLat.lng });
          onDropoffDragEnd(dropoffIndex, lngLat.lat, lngLat.lng);
        });
      }
      
      if (map.current) {
        marker.addTo(map.current);
      }

      dropoffMarkers.current.push(marker);
    });

    console.log('✅ Dropoff markers added to map:', dropoffMarkers.current.length);

    // Fit map to show all markers if we have both pickup and dropoffs
    if (pickup && dropoffs.length > 0 && map.current) {
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([pickup.lng, pickup.lat]);
      dropoffs.forEach(dropoff => bounds.extend([dropoff.lng, dropoff.lat]));

      map.current.fitBounds(bounds, {
        padding: { top: 80, bottom: 80, left: 80, right: 80 },
        duration: 800, // Fast animation
        essential: true,
      });
      console.log('✅ Map bounds adjusted to show all markers');
    }
  }, [dropoffs, pickup]);

  // Cached route calculation with traffic data and alternatives
  const fetchOptimizedRoute = useCallback(async () => {
    if (!map.current || !isMapReady || !coordinates) {
      console.log('⚠️ Skipping route fetch - not ready', {
        hasMap: !!map.current,
        isMapReady,
        hasCoordinates: !!coordinates,
      });
      return;
    }

    try {
      console.log('🚗 Fetching route with traffic data...', { 
        coordinatesCount: coordinates.length,
        vehicleType,
        showTraffic,
        showAlternatives
      });

      // Get vehicle-specific routing profile and exclusions
      const profile = getVehicleRoutingProfile(vehicleType);
      const exclude = getVehicleExclusions(vehicleType);

      // Fetch route with traffic annotations
      const data = await fetchMapboxRoute(
        coordinates as [number, number][],
        mapboxgl.accessToken || '',
        {
          alternatives: showAlternatives,
          annotations: showTraffic ? ['congestion', 'distance', 'duration'] : ['distance', 'duration'],
          profile,
          exclude,
          optimize: coordinates.length > 2,
          overview: 'full',
        }
      );

      if (!data.routes || data.routes.length === 0) {
        console.warn('⚠️ No route found in response');
        return;
      }

      // Store all alternatives in state
      setRouteAlternatives(data.routes);

      // Use selected route or primary route
      const selectedIdx = Math.min(activeRouteIndex, data.routes.length - 1);
      const route = data.routes[selectedIdx];
      const geometry = route.geometry;

      if (!geometry || !geometry.coordinates) {
        console.error('❌ Invalid geometry in route:', geometry);
        return;
      }

      // Extract congestion data
      const congestionData = route.legs?.[0]?.annotation?.congestion || [];
      const distanceData = route.legs?.[0]?.annotation?.distance || [];
      const hasTrafficData = congestionData.length > 0 && distanceData.length > 0;

      // Calculate distance and duration
      const distanceKm = parseFloat((route.distance / 1000).toFixed(2));
      const durationMin = Math.round(route.duration / 60);

      console.log('✅ Route calculated:', {
        distance: `${distanceKm} km`,
        duration: `${durationMin} min`,
        alternatives: data.routes.length,
        hasTrafficData,
        profile
      });

      // Store route info and notify parent
      const calculatedRoute: RouteInfo = {
        distance: distanceKm,
        duration: durationMin,
        polyline: geometry,
        alternatives: data.routes,
        hasTrafficData,
      };

      if (onRouteCalculated) {
        onRouteCalculated(calculatedRoute);
      }

      // Render routes on map
      if (map.current) {
        const renderRoutes = () => {
          if (!map.current) return;
          
          try {
            // First, remove any existing alternative route layers/sources
            for (let i = 0; i < 3; i++) {
              const altId = `route-alt-${i}`;
              if (map.current.getLayer(altId)) map.current.removeLayer(altId);
              if (map.current.getSource(altId)) map.current.removeSource(altId);
            }
            // Remove primary layers
            if (map.current.getLayer('route-arrows')) map.current.removeLayer('route-arrows');
            if (map.current.getLayer('route')) map.current.removeLayer('route');
            if (map.current.getSource('route')) map.current.removeSource('route');

            // Render alternative routes FIRST (behind the selected route)
            if (data.routes.length > 1) {
              data.routes.forEach((altRoute, idx) => {
                if (idx === selectedIdx) return; // Skip the selected one
                if (!altRoute.geometry?.coordinates) return;

                const altId = `route-alt-${idx}`;
                map.current!.addSource(altId, {
                  type: 'geojson',
                  data: {
                    type: 'Feature',
                    properties: {},
                    geometry: altRoute.geometry,
                  },
                });

                map.current!.addLayer({
                  id: altId,
                  type: 'line',
                  source: altId,
                  layout: {
                    'line-join': 'round',
                    'line-cap': 'round',
                  },
                  paint: {
                    'line-color': '#94a3b8', // slate-400, subtle gray
                    'line-width': 4,
                    'line-opacity': 0.5,
                    'line-dasharray': [2, 2],
                  },
                });

                // Make alternative routes clickable
                map.current!.on('click', altId, () => {
                  setActiveRouteIndex(idx);
                  const altDistKm = parseFloat((altRoute.distance / 1000).toFixed(2));
                  const altDurMin = Math.round(altRoute.duration / 60);
                  if (onRouteSelected) {
                    onRouteSelected(idx, { distance: altDistKm, duration: altDurMin });
                  }
                });

                // Cursor pointer on hover
                map.current!.on('mouseenter', altId, () => {
                  if (map.current) map.current.getCanvas().style.cursor = 'pointer';
                });
                map.current!.on('mouseleave', altId, () => {
                  if (map.current) map.current.getCanvas().style.cursor = '';
                });
              });
            }

            // Now render the selected route on top
            map.current.addSource('route', {
              type: 'geojson',
              data: {
                type: 'Feature',
                properties: {},
                geometry: geometry,
              },
              lineMetrics: true,
            });

            map.current.addLayer({
              id: 'route',
              type: 'line',
              source: 'route',
              layout: {
                'line-join': 'round',
                'line-cap': 'round',
              },
              paint: {
                'line-color': '#3b82f6',
                'line-width': 6,
                'line-opacity': 0.9,
                'line-emissive-strength': 1.0,
                'line-trim-offset': [0, 0],
              },
            });

            // Animate the route drawing
            let progress = 0;
            const animDuration = 1500;
            const startTime = performance.now();

            const animate = (currentTime: number) => {
              if (!map.current || !map.current.getLayer('route')) {
                animationFrameId.current = null;
                return;
              }

              const elapsed = currentTime - startTime;
              progress = Math.min(elapsed / animDuration, 1);
              const trimValue = Math.max(0, Math.min(1 - progress, 1));

              map.current.setPaintProperty('route', 'line-trim-offset', [0, trimValue]);

              if (progress < 1) {
                animationFrameId.current = requestAnimationFrame(animate);
              } else {
                if (map.current && map.current.getLayer('route')) {
                  map.current.setPaintProperty('route', 'line-trim-offset', [0, 0]);
                }
                animationFrameId.current = null;
              }
            };

            if (animationFrameId.current !== null) {
              cancelAnimationFrame(animationFrameId.current);
            }
            animationFrameId.current = requestAnimationFrame(animate);

            // Add directional arrows
            map.current.addLayer({
              id: 'route-arrows',
              type: 'symbol',
              source: 'route',
              layout: {
                'symbol-placement': 'line',
                'symbol-spacing': 80,
                'text-field': '▶',
                'text-size': 16,
                'text-keep-upright': false,
                'text-rotation-alignment': 'map',
              },
              paint: {
                'text-color': '#ffffff',
                'text-halo-color': '#3b82f6',
                'text-halo-width': 3,
              },
            });

            console.log('✅ Route layers added to map (selected:', selectedIdx, 'alts:', data.routes.length - 1, ')');
          } catch (error) {
            console.error('❌ Error adding/updating route:', error);
          }
        };

        if (map.current.isStyleLoaded()) {
          renderRoutes();
        } else {
          map.current.once('styledata', () => {
            renderRoutes();
          });
        }
      }

    } catch (error) {
      console.error('❌ Error fetching route:', error);
    }
  }, [coordinates, isMapReady, onRouteCalculated, vehicleType, showTraffic, showAlternatives, activeRouteIndex, onRouteSelected]);

  // Re-render routes when active index changes (without re-fetching from API)
  useEffect(() => {
    if (!map.current || !isMapReady || routeAlternatives.length <= 1) return;
    const selectedIdx = Math.min(activeRouteIndex, routeAlternatives.length - 1);
    const route = routeAlternatives[selectedIdx];
    if (!route?.geometry?.coordinates) return;

    const rerenderRoutes = () => {
      if (!map.current) return;
      try {
        // Remove existing layers/sources
        for (let i = 0; i < 3; i++) {
          const altId = `route-alt-${i}`;
          if (map.current.getLayer(altId)) map.current.removeLayer(altId);
          if (map.current.getSource(altId)) map.current.removeSource(altId);
        }
        if (map.current.getLayer('route-arrows')) map.current.removeLayer('route-arrows');
        if (map.current.getLayer('route')) map.current.removeLayer('route');
        if (map.current.getSource('route')) map.current.removeSource('route');

        // Render alternatives first (behind)
        routeAlternatives.forEach((altRoute, idx) => {
          if (idx === selectedIdx || !altRoute.geometry?.coordinates) return;
          const altId = `route-alt-${idx}`;
          map.current!.addSource(altId, {
            type: 'geojson',
            data: { type: 'Feature', properties: {}, geometry: altRoute.geometry },
          });
          map.current!.addLayer({
            id: altId,
            type: 'line',
            source: altId,
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#94a3b8', 'line-width': 4, 'line-opacity': 0.5, 'line-dasharray': [2, 2] },
          });
          map.current!.on('click', altId, () => {
            setActiveRouteIndex(idx);
            const d = parseFloat((altRoute.distance / 1000).toFixed(2));
            const t = Math.round(altRoute.duration / 60);
            if (onRouteSelected) onRouteSelected(idx, { distance: d, duration: t });
          });
          map.current!.on('mouseenter', altId, () => { if (map.current) map.current.getCanvas().style.cursor = 'pointer'; });
          map.current!.on('mouseleave', altId, () => { if (map.current) map.current.getCanvas().style.cursor = ''; });
        });

        // Selected route on top
        map.current.addSource('route', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: route.geometry },
          lineMetrics: true,
        });
        map.current.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#3b82f6', 'line-width': 6, 'line-opacity': 0.9, 'line-emissive-strength': 1.0 },
        });
        map.current.addLayer({
          id: 'route-arrows',
          type: 'symbol',
          source: 'route',
          layout: { 'symbol-placement': 'line', 'symbol-spacing': 80, 'text-field': '▶', 'text-size': 16, 'text-keep-upright': false, 'text-rotation-alignment': 'map' },
          paint: { 'text-color': '#ffffff', 'text-halo-color': '#3b82f6', 'text-halo-width': 3 },
        });

        // Notify parent of the newly selected route
        const distKm = parseFloat((route.distance / 1000).toFixed(2));
        const durMin = Math.round(route.duration / 60);
        if (onRouteCalculated) {
          onRouteCalculated({
            distance: distKm,
            duration: durMin,
            polyline: route.geometry,
            alternatives: routeAlternatives,
            hasTrafficData: !!route.legs?.[0]?.annotation?.congestion?.length,
          });
        }
      } catch (err) {
        console.error('❌ Error re-rendering routes:', err);
      }
    };

    if (map.current.isStyleLoaded()) {
      rerenderRoutes();
    } else {
      map.current.once('styledata', rerenderRoutes);
    }
  }, [activeRouteIndex, routeAlternatives.length]);

  // Debounced route calculation
  useEffect(() => {
    if (!coordinates || !isMapReady) {
      // Remove route if no destinations
      if (map.current) {
        // Cancel any running animation first
        if (animationFrameId.current !== null) {
          cancelAnimationFrame(animationFrameId.current);
          animationFrameId.current = null;
        }
        // Remove alternative layers
        for (let i = 0; i < 3; i++) {
          const altId = `route-alt-${i}`;
          if (map.current.getLayer(altId)) map.current.removeLayer(altId);
          if (map.current.getSource(altId)) map.current.removeSource(altId);
        }
        // Remove primary layers
        if (map.current.getLayer('route-arrows')) map.current.removeLayer('route-arrows');
        if (map.current.getLayer('route')) map.current.removeLayer('route');
        if (map.current.getSource('route')) map.current.removeSource('route');
      }
      setRouteAlternatives([]);
      return;
    }

    // Debounce route calculation to avoid excessive API calls
    const timeoutId = setTimeout(() => {
      fetchOptimizedRoute();
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [coordinates, isMapReady, fetchOptimizedRoute]);

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Show subtle loading indicator only on first load */}
      {!isMapReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/10 backdrop-blur-sm z-10">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <div className="h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-sm font-medium">Loading map...</p>
          </div>
        </div>
      )}
      <div ref={mapContainer} className="w-full h-full" />
      
      {/* Route Alternatives Panel */}
      {routeAlternatives.length > 1 && (
        <div className="absolute top-4 right-4 bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg p-3 max-w-xs z-10" style={{ marginTop: '120px' }}>
          <h3 className="text-sm font-semibold mb-2 text-foreground">Route Options</h3>
          <div className="space-y-2">
            {routeAlternatives.map((route, index) => {
              const distanceKm = (route.distance / 1000).toFixed(1);
              const durationMin = Math.round(route.duration / 60);
              const isActive = index === activeRouteIndex;

              // Determine route label based on characteristics
              let label = `Route ${index + 1}`;
              if (index === 0) {
                label = '⚡ Fastest';
              } else {
                // Compare to fastest route
                const fastestDist = routeAlternatives[0].distance;
                if (route.distance < fastestDist) {
                  label = '📏 Shortest';
                } else {
                  // Check congestion
                  const congestion = route.legs?.[0]?.annotation?.congestion || [];
                  const heavyCount = congestion.filter((c: string) => c === 'heavy' || c === 'severe').length;
                  const totalCount = congestion.length || 1;
                  if (heavyCount / totalCount < 0.15) {
                    label = '🟢 Least Traffic';
                  } else {
                    label = `🔀 Alternate ${index}`;
                  }
                }
              }
              
              return (
                <button
                  key={index}
                  onClick={() => {
                    setActiveRouteIndex(index);
                    const altDistKm = parseFloat((route.distance / 1000).toFixed(2));
                    const altDurMin = Math.round(route.duration / 60);
                    if (onRouteSelected) {
                      onRouteSelected(index, { distance: altDistKm, duration: altDurMin });
                    }
                  }}
                  className={`w-full text-left p-2.5 rounded-md transition-all ${
                    isActive 
                      ? 'bg-primary text-primary-foreground shadow-sm' 
                      : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{label}</span>
                    {isActive && (
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {durationMin} min
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                      {distanceKm} km
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 text-center">Click gray routes on map to switch</p>
        </div>
      )}
    </div>
  );
};

// Memoize with custom comparison function
const arePropsEqual = (prevProps: DeliveryMapProps, nextProps: DeliveryMapProps) => {
  // Compare pickup
  if (prevProps.pickup?.lat !== nextProps.pickup?.lat || 
      prevProps.pickup?.lng !== nextProps.pickup?.lng ||
      prevProps.pickup?.label !== nextProps.pickup?.label) {
    return false;
  }

  // Compare dropoffs length first for quick check (handle undefined)
  const prevDropoffs = prevProps.dropoffs || [];
  const nextDropoffs = nextProps.dropoffs || [];
  
  if (prevDropoffs.length !== nextDropoffs.length) {
    return false;
  }

  // Compare each dropoff location
  for (let i = 0; i < prevDropoffs.length; i++) {
    const prev = prevDropoffs[i];
    const next = nextDropoffs[i];
    if (prev.lat !== next.lat || prev.lng !== next.lng || prev.label !== next.label) {
      return false;
    }
  }

  // Compare other props
  return prevProps.className === nextProps.className;
};

// Export memoized component with custom comparison
export const DeliveryMap = memo(DeliveryMapComponent, arePropsEqual);
export default DeliveryMap;