'use client';

import React, { useEffect, useRef, useState, memo, useCallback, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { fetchCachedRoute } from '@/lib/route-cache';

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
}

interface DeliveryMapProps {
  pickup?: Location;
  dropoffs?: Location[];
  className?: string;
  onRouteCalculated?: (routeInfo: RouteInfo) => void;
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

const DeliveryMapComponent = ({ pickup, dropoffs = [], className = '', onRouteCalculated }: DeliveryMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const pickupMarker = useRef<mapboxgl.Marker | null>(null);
  const dropoffMarkers = useRef<mapboxgl.Marker[]>([]);
  const [isMapReady, setIsMapReady] = useState(false);

  // Memoize coordinates for route calculation to prevent unnecessary re-calculations
  const coordinates = useMemo(() => {
    if (!pickup || dropoffs.length === 0) return null;
    return [
      [pickup.lng, pickup.lat],
      ...dropoffs.map(d => [d.lng, d.lat]),
    ];
  }, [pickup?.lng, pickup?.lat, dropoffs.map(d => `${d.lng},${d.lat}`).join('|')]);

  // Initialize map with optimized settings
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/swiftdash/cmgtdgxbe000e01st0atdhrex', // Custom SwiftDash style
      center: [121.0340, 14.5995], // Metro Manila
      zoom: 11,
      pitch: 45,
      bearing: 0,
      // Performance optimizations
      antialias: true, // Enable antialiasing for crisp rendering
    });

    console.log('🗺️ Map initialized with performance optimizations');

    map.current.on('load', () => {
      console.log('✅ Map loaded successfully');
      setIsMapReady(true);
    });

    map.current.on('idle', () => {
      if (!isMapReady) {
        console.log('✅ Map idle - ready for route calculation');
        setIsMapReady(true);
      }
    });

    map.current.on('error', (e) => {
      console.error('❌ Map error:', e);
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

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
      setIsMapReady(false);
    };
  }, []);

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
    if (!map.current || !pickup) return;

    // Remove existing pickup marker
    if (pickupMarker.current) {
      pickupMarker.current.remove();
    }

    // Create pickup marker
    const el = createPickupMarkerElement();

    // Add pickup marker
    pickupMarker.current = new mapboxgl.Marker({ element: el })
      .setLngLat([pickup.lng, pickup.lat])
      .setPopup(
        new mapboxgl.Popup({ offset: 25 }).setHTML(
          `<div class="font-semibold text-sm">Pickup Location</div>
           <div class="text-xs text-muted-foreground">${pickup.label || 'Pickup Point'}</div>`
        )
      )
      .addTo(map.current);

    // Fly to pickup location only if this is the first location set
    if (!dropoffs.length) {
      map.current.flyTo({
        center: [pickup.lng, pickup.lat],
        zoom: 14,
        duration: 1000, // Reduced duration for faster navigation
      });
    }
  }, [pickup, dropoffs.length]);

  // Update dropoff markers
  useEffect(() => {
    if (!map.current) return;

    // Remove existing dropoff markers
    dropoffMarkers.current.forEach(marker => marker.remove());
    dropoffMarkers.current = [];

    if (dropoffs.length === 0) return;

    // Add dropoff markers
    dropoffs.forEach((dropoff, index) => {
      const el = createDropoffMarkerElement(index, dropoffs.length);

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([dropoff.lng, dropoff.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(
            `<div class="font-semibold text-sm">Dropoff Location ${dropoffs.length > 1 ? `#${index + 1}` : ''}</div>
             <div class="text-xs text-muted-foreground">${dropoff.label || 'Dropoff Point'}</div>`
          )
        );
      
      if (map.current) {
        marker.addTo(map.current);
      }

      dropoffMarkers.current.push(marker);
    });

    // Fit map to show all markers if we have both pickup and dropoffs
    if (pickup && dropoffs.length > 0 && map.current) {
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([pickup.lng, pickup.lat]);
      dropoffs.forEach(dropoff => bounds.extend([dropoff.lng, dropoff.lat]));

      map.current.fitBounds(bounds, {
        padding: { top: 80, bottom: 80, left: 80, right: 80 },
        duration: 1000, // Reduced duration for faster navigation
      });
    }
  }, [dropoffs, pickup]);

  // Cached route calculation with optimized debouncing
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
      console.log('🚗 Fetching cached route...', { 
        coordinatesCount: coordinates.length,
        coordinates: coordinates.map(c => `${c[0].toFixed(3)},${c[1].toFixed(3)}`),
      });

      // Use cached route fetcher
      const data = await fetchCachedRoute(
        coordinates,
        mapboxgl.accessToken || '',
        {
          optimize: coordinates.length > 2,
          overview: 'full',
        }
      );

      if (!data.routes || data.routes.length === 0) {
        console.warn('⚠️ No route found in response');
        return;
      }

      const route = data.routes[0];
      const geometry = route.geometry;

      if (!geometry || !geometry.coordinates) {
        console.error('❌ Invalid geometry in route:', geometry);
        return;
      }

      // Calculate distance and duration
      const distanceKm = parseFloat((route.distance / 1000).toFixed(2));
      const durationMin = Math.round(route.duration / 60);

      console.log('✅ Route calculated:', {
        distance: `${distanceKm} km`,
        duration: `${durationMin} min`,
      });

      // Store route info and notify parent
      const calculatedRoute: RouteInfo = {
        distance: distanceKm,
        duration: durationMin,
        polyline: geometry,
      };

      if (onRouteCalculated) {
        onRouteCalculated(calculatedRoute);
      }

      // Add route to map
      if (map.current && map.current.isStyleLoaded()) {
        // Add or update route source
        if (!map.current.getSource('route')) {
          map.current.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: geometry,
            },
            lineMetrics: true,
          });

          // Add route line layer
          map.current.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': '#00d9ff',
              'line-width': 8,
              'line-opacity': 0.9,
            },
          });

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
              'text-halo-color': '#00d9ff',
              'text-halo-width': 3,
            },
          });

          console.log('✅ Route layers added to map');
        } else {
          // Update existing route
          const source = map.current.getSource('route') as mapboxgl.GeoJSONSource;
          if (source) {
            source.setData({
              type: 'Feature',
              properties: {},
              geometry: geometry,
            });
            console.log('✅ Route updated on map');
          }
        }
      }

    } catch (error) {
      console.error('❌ Error fetching cached route:', error);
    }
  }, [coordinates, isMapReady, onRouteCalculated]);

  // Debounced route calculation
  useEffect(() => {
    if (!coordinates || !isMapReady) {
      // Remove route if no destinations
      if (map.current?.getSource('route')) {
        if (map.current.getLayer('route')) {
          map.current.removeLayer('route');
        }
        if (map.current.getLayer('route-arrows')) {
          map.current.removeLayer('route-arrows');
        }
        map.current.removeSource('route');
      }
      return;
    }

    // Debounce route calculation to avoid excessive API calls
    const timeoutId = setTimeout(() => {
      fetchOptimizedRoute();
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [coordinates, isMapReady, fetchOptimizedRoute]);

  return (
    <div ref={mapContainer} className={`w-full h-full ${className}`} />
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