'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { createClient } from '@/lib/supabase/client';
import { useMultipleDriverLocations, useAblyConnectionState } from '@/lib/ably-client';
import { useUserContext } from '@/lib/supabase/user-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
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
  tracking_number: string;
  status: string;
  pickup_address: string;
  delivery_address: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  package_description: string;
  total_amount: number;
  created_at: string;
  updated_at: string;
  driver_id: string | null;
  business_id: string;
  driver_profiles?: {
    id: string;
    user_profiles: {
      full_name: string;
      phone_number: string | null;
      avatar_url: string | null;
    };
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
  const deliveriesRef = useRef<DeliveryWithDriver[]>([]);
  const isProgrammaticMoveRef = useRef<boolean>(false);
  const moveEndHandlerRef = useRef<(() => void) | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryWithDriver | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Fetch active deliveries with React Query
  const { data: deliveries = [], isLoading, refetch } = useQuery({
    queryKey: ['active-deliveries', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      
      const { data, error } = await supabase
        .from('deliveries')
        .select(`
          *,
          driver_profiles (
            id,
            user_profiles (
              full_name,
              phone_number,
              avatar_url
            )
          )
        `)
        .eq('business_id', businessId)
        .in('status', [
          'driver_offered',
          'driver_assigned',
          'going_to_pickup',
          'arrived_at_pickup',
          'picked_up',
          'going_to_dropoff',
          'arrived_at_dropoff'
        ])
        .not('driver_id', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
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

  // Update markers when deliveries change
  useEffect(() => {
    if (!mapRef.current || deliveries.length === 0) return;

    // Check if deliveries actually changed (by comparing IDs)
    const currentIds = deliveries.map(d => d.id).sort().join(',');
    const previousIds = deliveriesRef.current.map(d => d.id).sort().join(',');
    
    if (currentIds === previousIds) return; // No change
    
    deliveriesRef.current = deliveries;

    const map = mapRef.current;
    const bounds = new mapboxgl.LngLatBounds();
    let hasValidBounds = false;

    deliveries.forEach((delivery) => {
      // Add pickup marker
      if (delivery.pickup_lat && delivery.pickup_lng) {
        const pickupId = `pickup-${delivery.id}`;
        if (!pickupMarkersRef.current.has(pickupId)) {
          const el = document.createElement('div');
          el.className = 'pickup-marker';
          el.innerHTML = '📦';
          el.style.fontSize = '24px';
          el.style.cursor = 'pointer';

          const marker = new mapboxgl.Marker(el)
            .setLngLat([delivery.pickup_lng, delivery.pickup_lat])
            .setPopup(
              new mapboxgl.Popup({ offset: 25 })
                .setHTML(`<strong>Pickup</strong><br/>${delivery.pickup_address}`)
            )
            .addTo(map);

          pickupMarkersRef.current.set(pickupId, marker);
        }

        bounds.extend([delivery.pickup_lng, delivery.pickup_lat]);
        hasValidBounds = true;
      }

      // Add dropoff marker
      if (delivery.dropoff_lat && delivery.dropoff_lng) {
        const dropoffId = `dropoff-${delivery.id}`;
        if (!dropoffMarkersRef.current.has(dropoffId)) {
          const el = document.createElement('div');
          el.className = 'dropoff-marker';
          el.innerHTML = '📍';
          el.style.fontSize = '24px';
          el.style.cursor = 'pointer';

          const marker = new mapboxgl.Marker(el)
            .setLngLat([delivery.dropoff_lng, delivery.dropoff_lat])
            .setPopup(
              new mapboxgl.Popup({ offset: 25 })
                .setHTML(`<strong>Dropoff</strong><br/>${delivery.delivery_address}`)
            )
            .addTo(map);

          dropoffMarkersRef.current.set(dropoffId, marker);
        }

        bounds.extend([delivery.dropoff_lng, delivery.dropoff_lat]);
        hasValidBounds = true;
      }
    });

    // Fit map to show all markers
    if (hasValidBounds) {
      isProgrammaticMoveRef.current = true;
      map.fitBounds(bounds, { padding: 100, maxZoom: 15 });
    }
  }, [deliveries]);

  // Update driver markers with real-time locations
  useEffect(() => {
    if (!mapRef.current || driverLocations.size === 0) return;

    const map = mapRef.current;

    driverLocations.forEach((location, deliveryId) => {
      const delivery = deliveries.find(d => d.id === deliveryId);
      if (!delivery) return;

      const markerId = `driver-${deliveryId}`;
      
      if (!markersRef.current.has(markerId)) {
        // Create new driver marker
        const el = document.createElement('div');
        el.className = 'driver-marker';
        el.innerHTML = '🚗';
        el.style.fontSize = '32px';
        el.style.cursor = 'pointer';
        el.style.filter = `drop-shadow(0 2px 4px rgba(0,0,0,0.3))`;
        el.onclick = () => {
          setSelectedDelivery(delivery);
          setDetailsOpen(true);
        };

        const marker = new mapboxgl.Marker(el)
          .setLngLat([location.longitude, location.latitude])
          .addTo(map);

        const interpolator = new MarkerInterpolator(
          marker,
          location.latitude,
          location.longitude
        );

        markersRef.current.set(markerId, { marker, interpolator });
      } else {
        // Update existing marker with interpolation
        const { interpolator } = markersRef.current.get(markerId)!;
        interpolator.setTarget(location.latitude, location.longitude);
      }
    });
  }, [driverLocations, deliveries]);

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
      picked_up: 'Picked Up',
      going_to_dropoff: 'In Transit',
      arrived_at_dropoff: 'Arriving'
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
    } else if (delivery.pickup_lat && delivery.pickup_lng) {
      mapRef.current.flyTo({
        center: [delivery.pickup_lng, delivery.pickup_lat],
        zoom: 14,
        duration: 1000
      });
    }

    setSelectedDelivery(delivery);
  };

  const filteredDeliveries = deliveries.filter(d =>
    d.tracking_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.pickup_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.delivery_address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-screen w-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hover:bg-gray-100"
          >
            {sidebarOpen ? (
              <ChevronLeft className="h-5 w-5" />
            ) : (
              <ChevronRight className="h-5 w-5" />
            )}
            <span className="ml-2">{sidebarOpen ? 'Hide' : 'Show'} Panel</span>
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Live Tracking</h1>
          <div className="flex items-center gap-2">
            <Circle
              className={`h-3 w-3 ${isConnected ? 'fill-green-500 text-green-500' : 'fill-red-500 text-red-500'}`}
            />
            <span className="text-sm text-gray-600">
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
          className="hover:bg-gray-50"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Refresh</span>
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div
          className={`bg-white border-r shadow-lg transition-all duration-300 ease-in-out z-10 flex flex-col ${
            sidebarOpen ? 'w-96' : 'w-0'
          }`}
          style={{ minWidth: sidebarOpen ? '24rem' : '0' }}
        >
          {sidebarOpen && (
            <>
              {/* Sidebar Header */}
              <div className="p-6 border-b bg-gray-50">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Deliveries</h2>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by tracking, address..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-white"
                  />
                </div>
              </div>

              {/* Sidebar Content */}
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
                      <p className="text-gray-600">Loading deliveries...</p>
                    </div>
                  </div>
                ) : filteredDeliveries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-center p-6">
                    <Package className="h-16 w-16 text-gray-300 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No Active Deliveries</h3>
                    <p className="text-gray-500">Assigned deliveries will appear here for real-time tracking</p>
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
                              ? 'ring-2 ring-blue-500 shadow-lg bg-blue-50' 
                              : 'hover:shadow-md hover:bg-gray-50'
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
                                      {delivery.tracking_number.slice(-3)}
                                    </span>
                                  </div>
                                  <div>
                                    <p className="font-semibold text-gray-900">{delivery.tracking_number}</p>
                                    <p className="text-sm text-gray-500">
                                      ₱{delivery.total_amount.toFixed(2)}
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
                                    <p className="text-xs text-gray-500 mb-1">Pickup</p>
                                    <p className="text-sm text-gray-800 truncate">{delivery.pickup_address}</p>
                                  </div>
                                </div>
                                <div className="flex items-start gap-2">
                                  <MapPin className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-gray-500 mb-1">Dropoff</p>
                                    <p className="text-sm text-gray-800 truncate">{delivery.delivery_address}</p>
                                  </div>
                                </div>
                              </div>

                              {/* Driver & Status */}
                              <div className="flex items-center justify-between pt-2 border-t">
                                <div className="flex items-center gap-2">
                                  {delivery.driver_profiles ? (
                                    <>
                                      <User className="h-4 w-4 text-gray-400" />
                                      <span className="text-sm text-gray-700 truncate">
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
            <Card className="bg-white/90 backdrop-blur-sm">
              <CardContent className="p-3 flex items-center gap-2">
                <Circle
                  className={`h-3 w-3 ${isConnected ? 'fill-green-500 text-green-500 animate-pulse' : 'fill-red-500 text-red-500'}`}
                />
                <span className="text-sm font-medium text-gray-700">
                  {isConnected ? 'Live' : 'Offline'}
                </span>
                {deliveries.length > 0 && (
                  <>
                    <div className="w-px h-4 bg-gray-300 mx-1" />
                    <span className="text-sm text-gray-600">{deliveries.length} active</span>
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
                      {selectedDelivery.tracking_number.slice(-3)}
                    </span>
                  </div>
                  <div>
                    <div className="text-lg">{selectedDelivery.tracking_number}</div>
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
                {selectedDelivery.driver_profiles && (
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2 text-gray-900">
                      <User className="h-5 w-5 text-blue-600" />
                      Driver Information
                    </h3>
                    <Card>
                      <CardContent className="p-4 space-y-3">
                        <div>
                          <p className="text-sm text-gray-500 mb-1">Name</p>
                          <p className="font-medium text-gray-900">
                            {selectedDelivery.driver_profiles.user_profiles.full_name}
                          </p>
                        </div>
                        {selectedDelivery.driver_profiles.user_profiles.phone_number && (
                          <div>
                            <p className="text-sm text-gray-500 mb-1">Phone</p>
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-green-600" />
                              <p className="font-medium text-gray-900">
                                {selectedDelivery.driver_profiles.user_profiles.phone_number}
                              </p>
                            </div>
                          </div>
                        )}
                        {driverLocations.get(selectedDelivery.id) && (
                          <div>
                            <p className="text-sm text-gray-500 mb-1">Last Update</p>
                            <div className="flex items-center gap-2">
                              <Circle className="h-3 w-3 fill-green-500 text-green-500 animate-pulse" />
                              <p className="text-sm text-gray-700">
                                {Math.floor((Date.now() - driverLocations.get(selectedDelivery.id)!.timestamp) / 1000)}s ago
                              </p>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Route Information */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2 text-gray-900">
                    <MapPin className="h-5 w-5 text-blue-600" />
                    Route Details
                  </h3>
                  <div className="space-y-3">
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-3 h-3 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-green-700 mb-1">Pickup Location</p>
                            <p className="text-gray-800">{selectedDelivery.pickup_address}</p>
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
                            <p className="text-sm font-medium text-red-700 mb-1">Delivery Location</p>
                            <p className="text-gray-800">{selectedDelivery.delivery_address}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Package Info */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2 text-gray-900">
                    <Package className="h-5 w-5 text-blue-600" />
                    Package Details
                  </h3>
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Description</p>
                        <p className="font-medium text-gray-900">
                          {selectedDelivery.package_description || 'No description provided'}
                        </p>
                      </div>
                      <div className="pt-2 border-t">
                        <p className="text-sm text-gray-500 mb-1">Total Amount</p>
                        <p className="font-bold text-xl text-green-600">
                          ₱{selectedDelivery.total_amount.toFixed(2)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Timeline */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2 text-gray-900">
                    <Clock className="h-5 w-5 text-blue-600" />
                    Timeline
                  </h3>
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Created</p>
                        <p className="font-medium text-gray-900">
                          {new Date(selectedDelivery.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Last Updated</p>
                        <p className="font-medium text-gray-900">
                          {formatTime(selectedDelivery.updated_at)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t">
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
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

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
