'use client';

import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Navigation, Users, Car } from 'lucide-react';

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
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);

  // Ensure we have a valid array to work with
  const safeDrivers = Array.isArray(drivers) ? drivers : [];

  // Load Google Maps API
  useEffect(() => {
    if (typeof window === 'undefined' || window.google?.maps) {
      if (window.google?.maps) {
        setMapLoaded(true);
      }
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => setMapLoaded(true);
    document.head.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || map) return;

    const initMap = new google.maps.Map(mapRef.current, {
      zoom: 12,
      center: { lat: 14.5995, lng: 120.9842 }, // Manila center
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }]
        },
        {
          featureType: 'transit',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }]
        }
      ],
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });

    setMap(initMap);
  }, [mapLoaded, map]);

  // Update markers when drivers change
  useEffect(() => {
    if (!map || !safeDrivers.length) return;

    // Clear existing markers
    markers.forEach(marker => marker.setMap(null));

    const onlineDrivers = safeDrivers.filter(driver => 
      driver.current_latitude && 
      driver.current_longitude
    );

    if (onlineDrivers.length === 0) {
      setMarkers([]);
      return;
    }

    const newMarkers: google.maps.Marker[] = [];
    const bounds = new google.maps.LatLngBounds();

    onlineDrivers.forEach((driver) => {
      if (!driver.current_latitude || !driver.current_longitude) return;

      const position = {
        lat: driver.current_latitude,
        lng: driver.current_longitude
      };

      // Create custom marker icon
      const markerIcon = {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="16" r="12" fill="#10b981" stroke="#ffffff" stroke-width="3"/>
            <path d="M12 16l3 3 6-6" stroke="#ffffff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `),
        scaledSize: new google.maps.Size(32, 32),
        anchor: new google.maps.Point(16, 16)
      };

      const marker = new google.maps.Marker({
        position,
        map,
        title: driver.full_name,
        icon: markerIcon,
        optimized: true,
      });

      // Create info window
      const infoWindow = new google.maps.InfoWindow({
        content: `
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
              ${driver.location_updated_at ? `<div class="text-xs text-gray-500 mt-2">Last seen: ${new Date(driver.location_updated_at).toLocaleTimeString()}</div>` : ''}
            </div>
          </div>
        `
      });

      marker.addListener('click', () => {
        infoWindow.open(map, marker);
      });

      newMarkers.push(marker);
      bounds.extend(position);
    });

    setMarkers(newMarkers);

    // Fit map to show all drivers
    if (newMarkers.length > 0) {
      if (newMarkers.length === 1) {
        map.setCenter(bounds.getCenter());
        map.setZoom(15);
      } else {
        map.fitBounds(bounds, { 
          left: 50,
          top: 50,
          right: 50,
          bottom: 50
        });
      }
    }
  }, [map, safeDrivers, markers]);

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