'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { useQuery } from '@tanstack/react-query';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { createClient } from '@/lib/supabase/client';
import { useMultipleDriverLocations, useAblyConnectionState } from '@/lib/ably-client';
import { useUserContext } from '@/lib/supabase/user-context';
import { DriverMarker } from '@/components/driver-marker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Package,
  MapPin,
  Navigation,
  Clock,
  User,
  Phone,
  Loader2,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  Circle,
  XCircle,
} from 'lucide-react';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '';

// Cache map center and zoom in sessionStorage for faster loads
const MAP_CACHE_KEY = 'tracking_map_state';

interface MapState {
  center: [number, number];
  zoom: number;
}

const getMapState = (): MapState => {
  if (typeof window === 'undefined') return { center: [121.0244, 14.5547], zoom: 11 };
  
  try {
    const cached = sessionStorage.getItem(MAP_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    console.error('Failed to load cached map state', e);
  }
  
  return { center: [121.0244, 14.5547], zoom: 11 };
};

const saveMapState = (center: [number, number], zoom: number) => {
  if (typeof window === 'undefined') return;
  
  try {
    sessionStorage.setItem(MAP_CACHE_KEY, JSON.stringify({ center, zoom }));
  } catch (e) {
    console.error('Failed to cache map state', e);
  }
};

interface DeliveryWithDriver {
  id: string;
  status: string;
  pickup_address: string;
  delivery_address: string;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  package_description: string;
  total_amount: number;
  created_at: string;
  updated_at: string;
  driver_id: string | null;
  business_id: string;
  driver_profiles?: {
    id: string;
    profile_picture_url: string | null;
    user_profiles: {
      full_name: string;
      phone_number: string | null;
      profile_image_url: string | null;
    }[];
  };
}

interface DriverLocation {
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}

// MarkerInterpolator Class for Smooth Animations
class MarkerInterpolator {
  private marker: mapboxgl.Marker;
  private targetLat: number;
  private targetLng: number;
  private currentLat: number;
  private currentLng: number;
  private startLat: number;
  private startLng: number;
  private startTime: number;
  private duration: number;
  private animationId: number | null;
  private lastUpdateTime: number;
  private debounceDelay: number;

  constructor(marker: mapboxgl.Marker, initialLat: number, initialLng: number) {
    this.marker = marker;
    this.currentLat = initialLat;
    this.currentLng = initialLng;
    this.targetLat = initialLat;
    this.targetLng = initialLng;
    this.startLat = initialLat;
    this.startLng = initialLng;
    this.startTime = Date.now();
    this.duration = 2000; // 2 seconds animation
    this.animationId = null;
    this.lastUpdateTime = 0;
    this.debounceDelay = 500; // 500ms debounce
  }

  // Easing function: easeInOutQuad
  private easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  // Calculate distance in kilometers
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  setTarget(newLat: number, newLng: number): void {
    const now = Date.now();
    
    // Debouncing: Ignore updates that are too frequent
    if (now - this.lastUpdateTime < this.debounceDelay) {
      return;
    }

    // Distance threshold: Ignore movements < 1 meter (0.001 km)
    const distance = this.calculateDistance(this.currentLat, this.currentLng, newLat, newLng);
    if (distance < 0.001) {
      return;
    }

    // Cancel any ongoing animation
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }

    // Set new target
    this.startLat = this.currentLat;
    this.startLng = this.currentLng;
    this.targetLat = newLat;
    this.targetLng = newLng;
    this.startTime = now;
    this.lastUpdateTime = now;

    // Start animation
    this.animate();
  }

  private animate = (): void => {
    const now = Date.now();
    const elapsed = now - this.startTime;
    const progress = Math.min(elapsed / this.duration, 1);

    // Apply easing
    const easedProgress = this.easeInOutQuad(progress);

    // Calculate new position
    this.currentLat = this.startLat + (this.targetLat - this.startLat) * easedProgress;
    this.currentLng = this.startLng + (this.targetLng - this.startLng) * easedProgress;

    // Update marker position
    this.marker.setLngLat([this.currentLng, this.currentLat]);

    // Continue animation if not complete
    if (progress < 1) {
      this.animationId = requestAnimationFrame(this.animate);
    } else {
      this.animationId = null;
    }
  }

  stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
}

export default function TrackingPage() {
  const supabase = createClient();
  const { businessId, loading: userLoading } = useUserContext();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, { marker: mapboxgl.Marker; interpolator: MarkerInterpolator }>>(new Map());
  const pickupMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const dropoffMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const routeLayersRef = useRef<Set<string>>(new Set());
  const deliveriesRef = useRef<DeliveryWithDriver[]>([]);
  const isProgrammaticMoveRef = useRef<boolean>(false);
  const moveEndHandlerRef = useRef<(() => void) | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryWithDriver | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const routeDataRef = useRef<Map<string, { distance: number; duration: number }>>(new Map());
  const [, forceUpdate] = useState({});

  // Fetch active deliveries with React Query
  const { data: deliveries = [], isLoading, refetch } = useQuery({
    queryKey: ['active-deliveries', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      
      // Fetch deliveries that are actively being tracked (assigned and in progress)
      const { data: deliveriesData, error: deliveriesError } = await supabase
        .from('deliveries')
        .select('*')
        .eq('business_id', businessId)
        .in('status', [
          'driver_assigned',
          'going_to_pickup',
          'arrived_at_pickup',
          'pickup_arrived',
          'picked_up',
          'going_to_dropoff',
          'arrived_at_dropoff',
          'dropoff_arrived'
        ])
        .not('driver_id', 'is', null)
        .order('created_at', { ascending: false });

      if (deliveriesError) throw deliveriesError;
      if (!deliveriesData || deliveriesData.length === 0) return [];

      // Get unique driver IDs
      const driverIds = [...new Set(deliveriesData.map(d => d.driver_id).filter(Boolean))];

      // Fetch driver profiles
      const { data: driverProfilesData, error: driverProfilesError } = await supabase
        .from('driver_profiles')
        .select('*')
        .in('id', driverIds);

      if (driverProfilesError) throw driverProfilesError;

      // Fetch user profiles for drivers
      const { data: userProfilesData, error: userProfilesError } = await supabase
        .from('user_profiles')
        .select('id, first_name, last_name, phone_number, profile_image_url')
        .in('id', driverIds);

      if (userProfilesError) throw userProfilesError;

      // Create lookup maps
      const driverProfilesMap = new Map(driverProfilesData?.map(dp => [dp.id, dp]));
      const userProfilesMap = new Map(userProfilesData?.map(up => [up.id, {
        full_name: `${up.first_name || ''} ${up.last_name || ''}`.trim(),
        phone_number: up.phone_number,
        profile_image_url: up.profile_image_url
      }]));

      // Combine the data
      const enrichedDeliveries = deliveriesData.map(delivery => {
        const driverProfile = driverProfilesMap.get(delivery.driver_id);
        const userProfile = userProfilesMap.get(delivery.driver_id);
        
        return {
          ...delivery,
          driver_profiles: driverProfile ? {
            ...driverProfile,
            user_profiles: userProfile || { full_name: 'Unknown', phone_number: null, profile_image_url: null }
          } : undefined
        };
      });

      console.log('📊 Tracking deliveries loaded:', enrichedDeliveries.length, enrichedDeliveries);
      return enrichedDeliveries;
    },
    enabled: !!businessId && !userLoading,
    staleTime: 10000, // 10 seconds for real-time tracking
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const loading = isLoading || userLoading;

  // Ably real-time connection
  const { isConnected } = useAblyConnectionState();
  const deliveryIds = deliveries.map(d => d.id);
  const { locations: driverLocations } = useMultipleDriverLocations(deliveryIds);

  // Real-time subscription for delivery status changes
  useEffect(() => {
    if (!businessId) return;

    const channel = supabase
      .channel('tracking-deliveries-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'deliveries',
          filter: `business_id=eq.${businessId}`,
        },
        (payload) => {
          console.log('🔄 Delivery status updated:', payload);
          // Refetch deliveries when status changes
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId, refetch]);

  // Initialize map (only once, cached across navigations)
  useEffect(() => {
    if (!mapContainerRef.current) return;
    
    // If map already exists and container is the same, just resize and return
    if (mapRef.current) {
      // Check if the map is still attached to the container
      try {
        // Resize map when sidebar state changes
        setTimeout(() => {
          mapRef.current?.resize();
        }, 300); // Wait for animation to complete
        return;
      } catch (e) {
        // Map was detached, need to recreate
        mapRef.current = null;
      }
    }

    // Get cached map state for faster initial load
    const mapState = getMapState();

    // Create new map instance
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/swiftdash/cmgtdgxbe000e01st0atdhrex',
      center: mapState.center,
      zoom: mapState.zoom,
      attributionControl: false,
      preserveDrawingBuffer: true, // Better performance for cached rendering
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.addControl(new mapboxgl.FullscreenControl(), 'top-right');

    // Save map state when user moves/zooms (but not during programmatic moves)
    const moveEndHandler = () => {
      if (isProgrammaticMoveRef.current) {
        isProgrammaticMoveRef.current = false;
        return;
      }
      const center = map.getCenter();
      const zoom = map.getZoom();
      saveMapState([center.lng, center.lat], zoom);
    };
    
    map.on('moveend', moveEndHandler);
    moveEndHandlerRef.current = moveEndHandler;

    mapRef.current = map;

    // Clean up only when component is truly destroyed
    return () => {
      if (mapRef.current) {
        if (moveEndHandlerRef.current) {
          mapRef.current.off('moveend', moveEndHandlerRef.current);
        }
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Resize map when sidebar state changes
  useEffect(() => {
    if (mapRef.current) {
      // Wait for CSS transition to complete, then resize
      const timer = setTimeout(() => {
        mapRef.current?.resize();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [sidebarOpen]);

  // Update markers when selected delivery changes
  useEffect(() => {
    if (!mapRef.current || !selectedDelivery) {
      // Clear all markers if no delivery is selected
      pickupMarkersRef.current.forEach(marker => marker.remove());
      pickupMarkersRef.current.clear();
      dropoffMarkersRef.current.forEach(marker => marker.remove());
      dropoffMarkersRef.current.clear();
      return;
    }

    const map = mapRef.current;
    
    // Clear all existing pickup/dropoff markers
    pickupMarkersRef.current.forEach(marker => marker.remove());
    pickupMarkersRef.current.clear();
    dropoffMarkersRef.current.forEach(marker => marker.remove());
    dropoffMarkersRef.current.clear();

    const bounds = new mapboxgl.LngLatBounds();
    let hasValidBounds = false;

    // Add pickup marker for selected delivery
    if (selectedDelivery.pickup_latitude && selectedDelivery.pickup_longitude) {
      const pickupId = `pickup-${selectedDelivery.id}`;
      const el = document.createElement('div');
      el.className = 'pickup-marker';
      el.innerHTML = '📦';
      el.style.fontSize = '24px';
      el.style.cursor = 'pointer';

      const marker = new mapboxgl.Marker(el)
        .setLngLat([selectedDelivery.pickup_longitude, selectedDelivery.pickup_latitude])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 })
            .setHTML(`<strong>Pickup</strong><br/>${selectedDelivery.pickup_address}`)
        )
        .addTo(map);

      pickupMarkersRef.current.set(pickupId, marker);
      bounds.extend([selectedDelivery.pickup_longitude, selectedDelivery.pickup_latitude]);
      hasValidBounds = true;
    }

    // Add dropoff marker for selected delivery
    if (selectedDelivery.delivery_latitude && selectedDelivery.delivery_longitude) {
      const dropoffId = `dropoff-${selectedDelivery.id}`;
      const el = document.createElement('div');
      el.className = 'dropoff-marker';
      el.innerHTML = '📍';
      el.style.fontSize = '24px';
      el.style.cursor = 'pointer';

      const marker = new mapboxgl.Marker(el)
        .setLngLat([selectedDelivery.delivery_longitude, selectedDelivery.delivery_latitude])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 })
            .setHTML(`<strong>Dropoff</strong><br/>${selectedDelivery.delivery_address}`)
        )
        .addTo(map);

      dropoffMarkersRef.current.set(dropoffId, marker);
      bounds.extend([selectedDelivery.delivery_longitude, selectedDelivery.delivery_latitude]);
      hasValidBounds = true;
    }

    // Fit map to show all markers
    if (hasValidBounds) {
      isProgrammaticMoveRef.current = true;
      map.fitBounds(bounds, { padding: 100, maxZoom: 15 });
    }
  }, [selectedDelivery]);

  // Update driver markers with real-time locations
  useEffect(() => {
    if (!mapRef.current || !selectedDelivery) {
      // Clear all driver markers if no delivery is selected
      markersRef.current.forEach(({ marker }) => marker.remove());
      markersRef.current.clear();
      return;
    }

    const map = mapRef.current;
    
    // Clear driver markers that are not for the selected delivery
    markersRef.current.forEach(({ marker }, markerId) => {
      if (markerId !== `driver-${selectedDelivery.id}`) {
        marker.remove();
        markersRef.current.delete(markerId);
      }
    });

    // Only show driver marker for selected delivery
    const location = driverLocations.get(selectedDelivery.id);
    if (!location || !selectedDelivery.driver_profiles || !selectedDelivery.driver_profiles.user_profiles) return;

    const markerId = `driver-${selectedDelivery.id}`;
    const userProfile = selectedDelivery.driver_profiles.user_profiles;
    const driverName = userProfile.full_name;
    const avatarUrl = userProfile.profile_image_url || selectedDelivery.driver_profiles.profile_picture_url;
    const lastUpdateSeconds = Math.floor((Date.now() - location.timestamp) / 1000);
      
    if (!markersRef.current.has(markerId)) {
      // Create new driver marker with React component
      const el = document.createElement('div');
      el.className = 'driver-marker-wrapper';
      
      // Render React component into the element
      const root = createRoot(el);
      root.render(
        <DriverMarker
          driverName={driverName}
          avatarUrl={avatarUrl}
          heading={location.heading}
          isOnline={true}
          lastUpdateSeconds={lastUpdateSeconds}
          speed={location.speed}
          onClick={() => {
            setDetailsOpen(true);
          }}
        />
      );

      const marker = new mapboxgl.Marker({
        element: el,
        anchor: 'center',
      })
        .setLngLat([location.longitude, location.latitude])
        .addTo(map);

      const interpolator = new MarkerInterpolator(
        marker,
        location.latitude,
        location.longitude
      );

      markersRef.current.set(markerId, { marker, interpolator, root });
    } else {
      // Update existing marker position with interpolation
      const { marker, interpolator, root } = markersRef.current.get(markerId)!;
      interpolator.setTarget(location.latitude, location.longitude);

      // Update React component props (re-render with existing root)
      root.render(
        <DriverMarker
          driverName={driverName}
          avatarUrl={avatarUrl}
          heading={location.heading}
          isOnline={true}
          lastUpdateSeconds={lastUpdateSeconds}
          speed={location.speed}
          onClick={() => {
            setDetailsOpen(true);
          }}
        />
      );
    }
  }, [selectedDelivery, driverLocations]);

  // Draw route polylines and calculate ETA
  useEffect(() => {
    if (!mapRef.current || !selectedDelivery) {
      // Clear all route layers if no delivery is selected
      if (mapRef.current) {
        routeLayersRef.current.forEach((layerId) => {
          if (mapRef.current!.getLayer(layerId)) {
            mapRef.current!.removeLayer(layerId);
          }
          const sourceId = layerId.replace('route-', 'route-source-');
          if (mapRef.current!.getSource(sourceId)) {
            mapRef.current!.removeSource(sourceId);
          }
        });
        routeLayersRef.current.clear();
      }
      return;
    }

    const map = mapRef.current;
    const updateRoutes = async () => {
      const newRouteData = new Map<string, { distance: number; duration: number }>();

      // Clear old routes for other deliveries
      routeLayersRef.current.forEach((layerId) => {
        if (layerId !== `route-${selectedDelivery.id}`) {
          if (map.getLayer(layerId)) {
            map.removeLayer(layerId);
          }
          const sourceId = layerId.replace('route-', 'route-source-');
          if (map.getSource(sourceId)) {
            map.removeSource(sourceId);
          }
          routeLayersRef.current.delete(layerId);
        }
      });

      // Only show route for selected delivery
      const driverLocation = driverLocations.get(selectedDelivery.id);
      if (!driverLocation) return;

      // Determine destination based on status
      let destLat: number | null = null;
      let destLng: number | null = null;

      if (['driver_assigned', 'going_to_pickup', 'arrived_at_pickup', 'pickup_arrived'].includes(selectedDelivery.status)) {
        // Route to pickup
        destLat = selectedDelivery.pickup_latitude;
        destLng = selectedDelivery.pickup_longitude;
      } else if (['picked_up', 'going_to_dropoff', 'arrived_at_dropoff', 'dropoff_arrived'].includes(selectedDelivery.status)) {
        // Route to dropoff
        destLat = selectedDelivery.delivery_latitude;
        destLng = selectedDelivery.delivery_longitude;
      }

      if (!destLat || !destLng) return;

      const routeId = `route-${selectedDelivery.id}`;
      const sourceId = `route-source-${selectedDelivery.id}`;

      try {
        // Fetch route from Mapbox Directions API
        const response = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/driving/${driverLocation.longitude},${driverLocation.latitude};${destLng},${destLat}?geometries=geojson&access_token=${mapboxgl.accessToken}`
        );
        const data = await response.json();

        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          newRouteData.set(selectedDelivery.id, {
            distance: route.distance,
            duration: route.duration,
          });

            // Add or update route layer
            if (!map.getSource(sourceId)) {
              map.addSource(sourceId, {
                type: 'geojson',
                data: {
                  type: 'Feature',
                  properties: {},
                  geometry: route.geometry,
                },
              });

              map.addLayer({
                id: routeId,
                type: 'line',
                source: sourceId,
                layout: {
                  'line-join': 'round',
                  'line-cap': 'round',
                },
                paint: {
                  'line-color': '#3b82f6',
                  'line-width': 6,
                  'line-opacity': 0.9,
                  'line-emissive-strength': 1.2,
                },
              });

            routeLayersRef.current.add(routeId);
          } else {
            // Update existing route
            const source = map.getSource(sourceId) as mapboxgl.GeoJSONSource;
            source.setData({
              type: 'Feature',
              properties: {},
              geometry: route.geometry,
            });
          }
        }
      } catch (error) {
        console.error('Error fetching route:', error);
      }

      routeDataRef.current = newRouteData;
      forceUpdate({});
    };

    updateRoutes();

    // Update routes every 20 seconds
    const interval = setInterval(updateRoutes, 20000);

    return () => {
      clearInterval(interval);
    };
  }, [selectedDelivery, driverLocations]);

  // Helper functions
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'driver_offered':
        return 'bg-orange-500';
      case 'going_to_pickup':
      case 'going_to_dropoff':
        return 'bg-blue-500';
      case 'driver_assigned':
      case 'arrived_at_pickup':
      case 'arrived_at_dropoff':
        return 'bg-yellow-500';
      case 'picked_up':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      driver_offered: 'Driver Offered',
      driver_assigned: 'Assigned',
      going_to_pickup: 'Going to Pickup',
      arrived_at_pickup: 'At Pickup',
      pickup_arrived: 'At Pickup',
      picked_up: 'Picked Up',
      going_to_dropoff: 'In Transit',
      arrived_at_dropoff: 'Arriving',
      dropoff_arrived: 'Arriving'
    };
    return labels[status] || status;
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000); // seconds

    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  const handleCancelDelivery = async () => {
    if (!selectedDelivery) return;

    setIsCanceling(true);
    try {
      const { error } = await supabase
        .from('deliveries')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedDelivery.id);

      if (error) throw error;

      // Refresh deliveries list
      refetch();
      
      // Close dialogs
      setCancelDialogOpen(false);
      setDetailsOpen(false);
      setSelectedDelivery(null);
      
      // Show success message
      alert('Delivery cancelled successfully');
    } catch (error) {
      console.error('Error cancelling delivery:', error);
      alert('Failed to cancel delivery. Please try again.');
    } finally {
      setIsCanceling(false);
    }
  };

  const focusOnDelivery = (delivery: DeliveryWithDriver) => {
    if (!mapRef.current) return;

    const driverLocation = driverLocations.get(delivery.id);
    
    isProgrammaticMoveRef.current = true;
    if (driverLocation) {
      mapRef.current.flyTo({
        center: [driverLocation.longitude, driverLocation.latitude],
        zoom: 15,
        duration: 1000
      });
    } else if (delivery.pickup_latitude && delivery.pickup_longitude) {
      mapRef.current.flyTo({
        center: [delivery.pickup_longitude, delivery.pickup_latitude],
        zoom: 14,
        duration: 1000
      });
    }

    setSelectedDelivery(delivery);
  };

  const filteredDeliveries = deliveries.filter(d =>
    d.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.pickup_address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.delivery_address?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-screen w-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-6 py-4 flex items-center justify-between z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {sidebarOpen ? (
              <ChevronLeft className="h-5 w-5" />
            ) : (
              <ChevronRight className="h-5 w-5" />
            )}
            <span className="ml-2">{sidebarOpen ? 'Hide' : 'Show'} Panel</span>
          </Button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Live Tracking</h1>
          <div className="flex items-center gap-2">
            <Circle
              className={`h-3 w-3 ${isConnected ? 'fill-green-500 text-green-500' : 'fill-red-500 text-red-500'}`}
            />
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {isConnected ? 'Real-time Connected' : 'Disconnected'}
            </span>
          </div>
          {!loading && (
            <Badge variant="secondary" className="ml-2">
              {deliveries.length} Active Deliveries
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
          className="hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Refresh</span>
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div
          className={`bg-white dark:bg-gray-800 border-r dark:border-gray-700 shadow-lg transition-all duration-300 ease-in-out z-10 flex flex-col ${
            sidebarOpen ? 'w-96' : 'w-0'
          }`}
          style={{ minWidth: sidebarOpen ? '24rem' : '0' }}
        >
          {sidebarOpen && (
            <>
              {/* Sidebar Header */}
              <div className="p-6 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Active Deliveries</h2>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by tracking, address..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-white dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                  />
                </div>
              </div>

              {/* Sidebar Content */}
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
                      <p className="text-gray-600 dark:text-gray-300">Loading deliveries...</p>
                    </div>
                  </div>
                ) : filteredDeliveries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-center p-6">
                    <Package className="h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Active Deliveries</h3>
                    <p className="text-gray-500 dark:text-gray-400">Assigned deliveries will appear here for real-time tracking</p>
                  </div>
                ) : (
                  <div className="p-4 space-y-3">
                    {filteredDeliveries.map((delivery) => {
                      const location = driverLocations.get(delivery.id);
                      const isSelected = selectedDelivery?.id === delivery.id;

                      return (
                        <Card
                          key={delivery.id}
                          className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                            isSelected 
                              ? 'ring-2 ring-blue-500 shadow-lg bg-blue-50 dark:bg-blue-900/30' 
                              : 'hover:shadow-md hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                          onClick={() => focusOnDelivery(delivery)}
                        >
                          <CardContent className="p-4">
                            <div className="space-y-3">
                              {/* Header */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                                    <span className="text-white font-bold text-sm">
                                      #{delivery.id?.slice(-4).toUpperCase() || '---'}
                                    </span>
                                  </div>
                                  <div>
                                    <p className="font-semibold text-gray-900 dark:text-white">Delivery #{delivery.id?.slice(-8).toUpperCase() || 'N/A'}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                      ₱{delivery.total_amount?.toFixed(2) || '0.00'}
                                    </p>
                                  </div>
                                </div>
                                <Badge
                                  variant="secondary"
                                  className={`${getStatusColor(delivery.status)} text-white text-xs`}
                                >
                                  {getStatusLabel(delivery.status)}
                                </Badge>
                              </div>

                              {/* Addresses */}
                              <div className="space-y-2">
                                <div className="flex items-start gap-2">
                                  <MapPin className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Pickup</p>
                                    <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{delivery.pickup_address}</p>
                                  </div>
                                </div>
                                <div className="flex items-start gap-2">
                                  <MapPin className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Dropoff</p>
                                    <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{delivery.delivery_address}</p>
                                  </div>
                                </div>
                              </div>

                              {/* Driver & Status */}
                              <div className="flex items-center justify-between pt-2 border-t dark:border-gray-700">
                                <div className="flex items-center gap-2">
                                  {delivery.driver_profiles ? (
                                    <>
                                      <User className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                                      <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                                        {delivery.driver_profiles.user_profiles.full_name}
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-sm text-gray-500">No driver assigned</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {location && (
                                    <div className="flex items-center gap-1">
                                      <Circle className="h-2 w-2 fill-green-500 text-green-500" />
                                      <span className="text-xs text-gray-500">
                                        {Math.floor((Date.now() - location.timestamp) / 1000)}s ago
                                      </span>
                                    </div>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedDelivery(delivery);
                                      setDetailsOpen(true);
                                    }}
                                    className="h-8 px-2 hover:bg-white"
                                  >
                                    <Navigation className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Map Container */}
        <div className={`flex-1 relative transition-all duration-300 ease-in-out`}>
          <div ref={mapContainerRef} className="w-full h-full" />
          
          {/* Floating toggle button for when sidebar is closed */}
          {!sidebarOpen && (
            <Button
              onClick={() => setSidebarOpen(true)}
              className="absolute top-4 left-4 z-10 bg-white text-gray-700 shadow-lg hover:bg-gray-50 border"
              size="sm"
            >
              <ChevronRight className="h-4 w-4 mr-2" />
              Show Deliveries
            </Button>
          )}

          {/* Live connection indicator */}
          <div className="absolute top-4 right-4 z-10">
            <Card className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm">
              <CardContent className="p-3 flex items-center gap-2">
                <Circle
                  className={`h-3 w-3 ${isConnected ? 'fill-green-500 text-green-500 animate-pulse' : 'fill-red-500 text-red-500'}`}
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {isConnected ? 'Live' : 'Offline'}
                </span>
                {deliveries.length > 0 && (
                  <>
                    <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1" />
                    <span className="text-sm text-gray-600 dark:text-gray-300">{deliveries.length} active</span>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Details Sheet */}
      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selectedDelivery && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">
                      #{selectedDelivery.id?.slice(-4).toUpperCase() || '---'}
                    </span>
                  </div>
                  <div>
                    <div className="text-lg">Delivery #{selectedDelivery.id?.slice(-8).toUpperCase() || 'N/A'}</div>
                    <div className="text-sm text-gray-500 font-normal">
                      ₱{selectedDelivery.total_amount.toFixed(2)}
                    </div>
                  </div>
                </SheetTitle>
                <SheetDescription className="mt-2">
                  <Badge
                    variant="secondary"
                    className={`${getStatusColor(selectedDelivery.status)} text-white`}
                  >
                    {getStatusLabel(selectedDelivery.status)}
                  </Badge>
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Driver Info */}
                {selectedDelivery.driver_profiles && selectedDelivery.driver_profiles.user_profiles && (() => {
                  const userProfile = selectedDelivery.driver_profiles.user_profiles;
                  return (
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2 text-gray-900 dark:text-white">
                      <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      Driver Information
                    </h3>
                    <Card>
                      <CardContent className="p-4 space-y-3">
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Name</p>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {userProfile.full_name}
                          </p>
                        </div>
                        {userProfile.phone_number && (
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Phone</p>
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-green-600 dark:text-green-400" />
                              <p className="font-medium text-gray-900 dark:text-white">
                                {userProfile.phone_number}
                              </p>
                            </div>
                          </div>
                        )}
                        {driverLocations.get(selectedDelivery.id) && (() => {
                          const location = driverLocations.get(selectedDelivery.id)!;
                          const lastUpdateSeconds = Math.floor((Date.now() - location.timestamp) / 1000);
                          return (
                            <>
                              <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Last Update</p>
                                <div className="flex items-center gap-2">
                                  <Circle className="h-3 w-3 fill-green-500 text-green-500 animate-pulse" />
                                  <p className="text-sm text-gray-700 dark:text-gray-300">{lastUpdateSeconds}s ago</p>
                                </div>
                              </div>
                              {location.speed !== undefined && (
                                <div>
                                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Speed</p>
                                  <p className="font-medium text-gray-900 dark:text-white">{Math.round(location.speed)} km/h</p>
                                </div>
                              )}
                              {location.heading !== undefined && (
                                <div>
                                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Heading</p>
                                  <p className="font-medium text-gray-900 dark:text-white">{Math.round(location.heading)}°</p>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  </div>
                  );
                })()}

                {/* ETA Information */}
                {routeDataRef.current.get(selectedDelivery.id) && (
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2 text-gray-900 dark:text-white">
                      <Navigation className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      ETA & Distance
                    </h3>
                    <Card>
                      <CardContent className="p-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Estimated Time</p>
                            <p className="font-bold text-xl text-blue-600 dark:text-blue-400">
                              {Math.round(routeDataRef.current.get(selectedDelivery.id)!.duration / 60)} min
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Distance</p>
                            <p className="font-bold text-xl text-blue-600 dark:text-blue-400">
                              {(routeDataRef.current.get(selectedDelivery.id)!.distance / 1000).toFixed(1)} km
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Route Information */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2 text-gray-900 dark:text-white">
                    <MapPin className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    Route Details
                  </h3>
                  <div className="space-y-3">
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-3 h-3 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">Pickup Location</p>
                            <p className="text-gray-800 dark:text-gray-200">{selectedDelivery.pickup_address}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <div className="flex justify-center">
                      <div className="w-0.5 h-8 bg-gradient-to-b from-green-500 to-red-500"></div>
                    </div>
                    
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-3 h-3 bg-red-500 rounded-full mt-2 flex-shrink-0"></div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">Delivery Location</p>
                            <p className="text-gray-800 dark:text-gray-200">{selectedDelivery.delivery_address}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Package Info */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2 text-gray-900 dark:text-white">
                    <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    Package Details
                  </h3>
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Description</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {selectedDelivery.package_description || 'No description provided'}
                        </p>
                      </div>
                      <div className="pt-2 border-t dark:border-gray-700">
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Amount</p>
                        <p className="font-bold text-xl text-green-600 dark:text-green-400">
                          ₱{selectedDelivery.total_amount.toFixed(2)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Timeline */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2 text-gray-900 dark:text-white">
                    <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    Timeline
                  </h3>
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Created</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {new Date(selectedDelivery.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Last Updated</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {formatTime(selectedDelivery.updated_at)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3 pt-4 border-t dark:border-gray-700">
                  <div className="flex gap-3">
                    <Button 
                      onClick={() => focusOnDelivery(selectedDelivery)} 
                      className="flex-1"
                      variant="default"
                    >
                      <Navigation className="h-4 w-4 mr-2" />
                      Focus on Map
                    </Button>
                    <Button 
                      onClick={() => setDetailsOpen(false)} 
                      variant="outline"
                      className="flex-1"
                    >
                      Close
                    </Button>
                  </div>
                  {['driver_assigned', 'going_to_pickup', 'arrived_at_pickup', 'pickup_arrived', 'picked_up', 'going_to_dropoff'].includes(selectedDelivery.status) && (
                    <Button 
                      onClick={() => setCancelDialogOpen(true)} 
                      variant="destructive"
                      className="w-full"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Cancel Delivery
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Delivery?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this delivery? This action cannot be undone.
              {selectedDelivery && (
                <div className="mt-3 p-3 bg-gray-50 rounded-md">
                  <p className="text-sm text-gray-700">
                    <strong>Delivery:</strong> #{selectedDelivery.id?.slice(-8).toUpperCase()}
                  </p>
                  <p className="text-sm text-gray-700">
                    <strong>Status:</strong> {getStatusLabel(selectedDelivery.status)}
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCanceling}>No, Keep It</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelDelivery}
              disabled={isCanceling}
              className="bg-red-600 hover:bg-red-700"
            >
              {isCanceling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                'Yes, Cancel Delivery'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Custom Styles */}
      <style jsx global>{`
        .mapboxgl-popup-content {
          padding: 12px;
          border-radius: 12px;
          font-family: Inter, sans-serif;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
          border: none;
        }
        .mapboxgl-popup-close-button {
          font-size: 20px;
          padding: 8px;
          color: #6b7280;
        }
        .mapboxgl-popup-close-button:hover {
          background-color: #f3f4f6;
          border-radius: 4px;
        }
        .mapboxgl-popup-anchor-bottom .mapboxgl-popup-tip {
          border-top-color: white;
        }
        .mapboxgl-popup-anchor-top .mapboxgl-popup-tip {
          border-bottom-color: white;
        }
        .mapboxgl-popup-anchor-left .mapboxgl-popup-tip {
          border-right-color: white;
        }
        .mapboxgl-popup-anchor-right .mapboxgl-popup-tip {
          border-left-color: white;
        }
      `}</style>
    </div>
  );
}
