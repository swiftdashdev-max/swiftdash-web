'use client';

import React, { useEffect, useRef, useState, memo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

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

const DeliveryMapComponent = ({ pickup, dropoffs = [], className = '', onRouteCalculated }: DeliveryMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const pickupMarker = useRef<mapboxgl.Marker | null>(null);
  const dropoffMarkers = useRef<mapboxgl.Marker[]>([]);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/swiftdash/cmgtdgxbe000e01st0atdhrex', // Custom SwiftDash style
      center: [121.0340, 14.5995], // Metro Manila
      zoom: 11,
      pitch: 45,
      bearing: 0,
    });

    console.log('🗺️ Map initialized');

    map.current.on('load', () => {
      console.log('✅ Map loaded successfully');
    });

    map.current.on('style.load', () => {
      console.log('✅ Map style loaded successfully');
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
      map.current?.remove();
      map.current = null;
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

    // Create pickup marker element
    const el = document.createElement('div');
    el.className = 'pickup-marker';
    el.style.width = '40px';
    el.style.height = '40px';
    el.style.backgroundImage = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='%2310b981' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z'/%3E%3Ccircle cx='12' cy='10' r='3' fill='%2310b981'/%3E%3C/svg%3E")`;
    el.style.backgroundSize = 'contain';
    el.style.cursor = 'pointer';

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

    // Fly to pickup location
    map.current.flyTo({
      center: [pickup.lng, pickup.lat],
      zoom: 14,
      duration: 1500,
    });
  }, [pickup]);

  // Update dropoff markers
  useEffect(() => {
    if (!map.current) return;

    // Remove existing dropoff markers
    dropoffMarkers.current.forEach(marker => marker.remove());
    dropoffMarkers.current = [];

    if (dropoffs.length === 0) return;

    // Add dropoff markers
    dropoffs.forEach((dropoff, index) => {
      // Create dropoff marker element
      const el = document.createElement('div');
      el.className = 'dropoff-marker';
      el.style.width = '40px';
      el.style.height = '40px';
      el.style.backgroundImage = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='%23ef4444' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z'/%3E%3Ccircle cx='12' cy='10' r='3' fill='%23ef4444'/%3E%3C/svg%3E")`;
      el.style.backgroundSize = 'contain';
      el.style.cursor = 'pointer';

      // Add number badge for multi-stop
      if (dropoffs.length > 1) {
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

    // Fit map to show all markers
    if (pickup && dropoffs.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([pickup.lng, pickup.lat]);
      dropoffs.forEach(dropoff => bounds.extend([dropoff.lng, dropoff.lat]));

      map.current.fitBounds(bounds, {
        padding: { top: 80, bottom: 80, left: 80, right: 80 },
        duration: 1500,
      });
    }
  }, [dropoffs, pickup]);
  // Draw optimized route with polylines using Mapbox Directions API
  useEffect(() => {
    console.log('🔄 Route useEffect triggered', {
      hasMap: !!map.current,
      hasPickup: !!pickup,
      pickupData: pickup,
      dropoffsCount: dropoffs.length,
      dropoffsData: dropoffs,
    });

    if (!map.current || !pickup || dropoffs.length === 0) {
      console.log('⚠️ Skipping route fetch - missing requirements', {
        hasMap: !!map.current,
        hasPickup: !!pickup,
        dropoffsCount: dropoffs.length,
      });

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
      setRouteInfo(null);
      return;
    }

    const fetchOptimizedRoute = async () => {
      try {
        if (!map.current) {
          console.warn('Map not initialized yet');
          return;
        }

        // Build coordinates string for Mapbox Directions API
        const coordinates = [
          [pickup.lng, pickup.lat],
          ...dropoffs.map(d => [d.lng, d.lat]),
        ];
        
        const coordinatesString = coordinates.map(coord => `${coord[0]},${coord[1]}`).join(';');
        
        // Determine if we need optimization (multi-stop)
        const optimize = dropoffs.length > 1 ? 'true' : 'false';
        
        // Fetch route from Mapbox Directions API with optimization
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinatesString}?` +
          `geometries=geojson` +
          `&overview=full` +
          `&steps=true` +
          `&annotations=distance,duration` +
          (dropoffs.length > 1 ? `&waypoints_per_route=true` : '') +
          `&access_token=${mapboxgl.accessToken}`;
        
        console.log('🚗 Fetching route...', { 
          pickup: pickup.label, 
          dropoffs: dropoffs.map(d => d.label),
          optimize: dropoffs.length > 1 ? 'yes' : 'no',
          url: url.substring(0, 100) + '...'
        });
        
        const response = await fetch(url);
        
        if (!response.ok) {
          console.error('❌ Route fetch failed:', response.status, response.statusText);
          return;
        }
        
        const data = await response.json();
        
        console.log('📦 Route data received:', data);
        
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

        console.log('📍 Route geometry:', {
          type: geometry.type,
          coordinatesCount: geometry.coordinates?.length || 0
        });
        
        // Calculate distance and duration
        const distanceKm = (route.distance / 1000).toFixed(2); // meters to km
        const durationMin = Math.round(route.duration / 60); // seconds to minutes
        
        console.log('✅ Route calculated:', {
          distance: `${distanceKm} km`,
          duration: `${durationMin} min`,
          waypoints: route.waypoints?.length || 0
        });

        // Store route info
        const calculatedRoute: RouteInfo = {
          distance: parseFloat(distanceKm),
          duration: durationMin,
          polyline: geometry,
        };
        
        setRouteInfo(calculatedRoute);
        
        // Notify parent component
        if (onRouteCalculated) {
          onRouteCalculated(calculatedRoute);
        }
        
        if (!map.current) return;

        // Wait for map style to be fully loaded before adding layers
        const addRouteLayer = () => {
          if (!map.current) return;
          
          console.log('🗺️ Adding route to map...', {
            styleLoaded: map.current.isStyleLoaded(),
            geometryType: geometry.type,
            coordinatesCount: geometry.coordinates?.length || 0
          });

          // Add or update route source
          if (!map.current.getSource('route')) {
            map.current.addSource('route', {
              type: 'geojson',
              data: {
                type: 'Feature',
                properties: {},
                geometry: geometry,
              },
              lineMetrics: true, // Required for gradient
            });

            // Add route line layer with neon blue color
            map.current.addLayer({
              id: 'route',
              type: 'line',
              source: 'route',
              layout: {
                'line-join': 'round',
                'line-cap': 'round',
              },
              paint: {
                'line-color': '#00d9ff', // Neon blue
                'line-width': 8,
                'line-opacity': 0.9,
                'line-emissive-strength': 1, // Makes it glow and not affected by map lighting
              },
            });

            // Add directional arrows along the route
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
                'text-color': '#ffffff', // White text
                'text-halo-color': '#00d9ff', // Neon blue halo
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
        };

        // Ensure style is loaded before adding layers
        if (map.current.isStyleLoaded()) {
          addRouteLayer();
        } else {
          console.log('⏳ Waiting for map style to load...');
          map.current.once('idle', addRouteLayer); // Changed from 'style.load' to 'idle'
        }

        // If multi-stop, reorder markers based on optimized waypoints
        if (route.waypoints && dropoffs.length > 1) {
          console.log('📍 Optimized waypoint order:', route.waypoints.map((w: any, i: number) => ({
            index: i,
            originalIndex: w.waypoint_index,
            location: route.waypoints[i]
          })));
        }

      } catch (error) {
        console.error('❌ Error fetching route:', error);
      }
    };

    // Wait for map to be ready before fetching route
    const mapReady = map.current.loaded() && map.current.isStyleLoaded();
    
    console.log('🗺️ Checking if map is ready to fetch route', {
      loaded: map.current.loaded(),
      styleLoaded: map.current.isStyleLoaded(),
      ready: mapReady,
    });

    if (mapReady) {
      console.log('✅ Map is ready, fetching route now');
      fetchOptimizedRoute();
    } else {
      console.log('⏳ Map not ready, waiting for idle event');
      map.current.once('idle', () => {
        console.log('✅ Map idle event fired, fetching route');
        fetchOptimizedRoute();
      });
    }
  }, [pickup, dropoffs, onRouteCalculated]);

  return (
    <div ref={mapContainer} className={`w-full h-full ${className}`} />
  );
};

// Memoize the component to prevent unnecessary re-renders
export const DeliveryMap = memo(DeliveryMapComponent);
export default DeliveryMap;
