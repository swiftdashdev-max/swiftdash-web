'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Navigation, Users, Car } from 'lucide-react';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '';

interface Driver {
  id: string;
  full_name: string;
  phone: string;
  current_latitude: number;
  current_longitude: number;
  vehicle_model?: string;
  plate_number?: string;
  rating: number;
  total_deliveries: number;
  location_updated_at: string;
  employment_type: string;
}

interface FleetMapProps {
  drivers: Driver[];
  isLoading?: boolean;
}

export default function FleetMap({ drivers = [], isLoading }: FleetMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Ensure we have a valid array to work with
  const safeDrivers = Array.isArray(drivers) ? drivers : [];

  // Initialize Mapbox map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [120.9842, 14.5995], // Manila center [lng, lat]
      zoom: 12,
    });

    map.on('load', () => {
      setMapLoaded(true);
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      setMapLoaded(false);
    };
  }, []);

  // Update markers when drivers change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    const onlineDrivers = safeDrivers.filter(driver => 
      driver.current_latitude && 
      driver.current_longitude
    );

    if (onlineDrivers.length === 0) return;

    const bounds = new mapboxgl.LngLatBounds();

    onlineDrivers.forEach((driver) => {
      if (!driver.current_latitude || !driver.current_longitude) return;

      const coordinates: [number, number] = [driver.current_longitude, driver.current_latitude];

      // Create custom marker element
      const el = document.createElement('div');
      el.className = 'driver-marker';
      el.style.width = '32px';
      el.style.height = '32px';
      el.style.cursor = 'pointer';
      el.innerHTML = `
        <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
          <circle cx="16" cy="16" r="12" fill="#10b981" stroke="#ffffff" stroke-width="3"/>
          <path d="M12 16l3 3 6-6" stroke="#ffffff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;

      // Create popup
      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div class="p-3 min-w-[200px]">
          <h3 class="font-semibold text-gray-800 mb-2">
            ${driver.full_name}
          </h3>
          <div class="space-y-1 text-sm text-gray-600">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 bg-green-500 rounded-full"></span>
              Online
            </div>
            ${driver.phone ? `<div>📞 ${driver.phone}</div>` : ''}
            ${driver.vehicle_model ? `<div>🚗 ${driver.vehicle_model}</div>` : ''}
            ${driver.plate_number ? `<div>🚙 ${driver.plate_number}</div>` : ''}
            ${driver.location_updated_at ? `<div class="text-xs text-gray-500 mt-2">Last seen: ${new Date(driver.location_updated_at).toLocaleTimeString()}</div>` : ''}
          </div>
        </div>
      `);

      const marker = new mapboxgl.Marker(el)
        .setLngLat(coordinates)
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
      bounds.extend(coordinates);
    });

    // Fit map to show all drivers
    if (onlineDrivers.length > 0) {
      if (onlineDrivers.length === 1) {
        map.flyTo({
          center: [onlineDrivers[0].current_longitude, onlineDrivers[0].current_latitude],
          zoom: 15
        });
      } else {
        map.fitBounds(bounds, { 
          padding: 50,
          maxZoom: 15
        });
      }
    }
  }, [safeDrivers]);

  const driversWithLocation = safeDrivers.filter(d => d.current_latitude && d.current_longitude);

  if (isLoading) {
    return (
      <Card className="h-96">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-6 w-24" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-full w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-96">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-600" />
            Live Fleet Map
          </CardTitle>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="flex items-center gap-1">
              <Car className="h-3 w-3" />
              {driversWithLocation.length} tracked
            </Badge>
            <Badge 
              variant={safeDrivers.length > 0 ? "default" : "secondary"} 
              className="flex items-center gap-1"
            >
              <div className={`w-2 h-2 rounded-full ${safeDrivers.length > 0 ? 'bg-green-500' : 'bg-gray-400'}`} />
              {safeDrivers.length} online
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 h-80 relative">
        {!mapLoaded ? (
          <div className="h-full flex items-center justify-center bg-gray-50 border-t">
            <div className="text-center">
              <Navigation className="h-8 w-8 mx-auto mb-2 text-gray-400 animate-spin" />
              <p className="text-sm text-gray-500">Loading map...</p>
            </div>
          </div>
        ) : driversWithLocation.length === 0 ? (
          <div className="h-full flex items-center justify-center bg-gray-50 border-t">
            <div className="text-center">
              <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500">No drivers with location data</p>
              {safeDrivers.length > 0 && (
                <p className="text-sm text-gray-400 mt-1">
                  {safeDrivers.length} driver{safeDrivers.length > 1 ? 's' : ''} online but location not available
                </p>
              )}
            </div>
          </div>
        ) : (
          <div ref={mapRef} className="h-full w-full" />
        )}
      </CardContent>
    </Card>
  );
}