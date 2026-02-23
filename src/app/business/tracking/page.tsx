'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useQuery } from '@tanstack/react-query';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { createClient } from '@/lib/supabase/client';
import { useInterpolatedMultipleDriverLocations, useAblyConnectionState } from '@/lib/ably-client';
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
  Users,
  Phone,
  Loader2,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  Circle,
  XCircle,
  Truck,
  Tag,
  Filter,
  TrendingUp,
  Car,
  Wifi,
  WifiOff,
  CheckCircle2,
  ArrowRight,
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

interface DeliveryStop {
  id: string;
  stop_number: number;
  stop_type: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  delivery_notes: string | null;
  status: string;
  completed_at: string | null;
  tracking_code: string | null;
}

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
  is_multi_stop?: boolean;
  driver_profiles?: {
    id: string;
    profile_picture_url: string | null;
    user_profiles: {
      full_name: string;
      phone_number: string | null;
      profile_image_url: string | null;
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

interface OnlineDriver {
  id: string;
  is_online: boolean;
  is_available: boolean;
  current_latitude: number | null;
  current_longitude: number | null;
  location_updated_at: string | null;
  vehicle_model: string | null;
  vehicle_plate: string | null;
  color: string | null;
  full_name: string;
  phone_number: string | null;
  profile_image_url: string | null;
  // whether this driver has an active delivery right now
  hasActiveDelivery?: boolean;
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
  const markersRef = useRef<Map<string, { marker: mapboxgl.Marker; interpolator: MarkerInterpolator; root: Root }>>(new Map());
  const pickupMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const dropoffMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const routeLayersRef = useRef<Set<string>>(new Set());
  const deliveriesRef = useRef<DeliveryWithDriver[]>([]);
  const isProgrammaticMoveRef = useRef<boolean>(false);
  const moveEndHandlerRef = useRef<(() => void) | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryWithDriver | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [deliveryStops, setDeliveryStops] = useState<DeliveryStop[]>([]);
  const [loadingStops, setLoadingStops] = useState(false);
  const routeDataRef = useRef<Map<string, { distance: number; duration: number }>>(new Map());
  const [, forceUpdate] = useState({});

  // Fleet view state
  const [showFleetView, setShowFleetView] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'deliveries' | 'drivers'>('deliveries');
  const [selectedFleetDriver, setSelectedFleetDriver] = useState<OnlineDriver | null>(null);
  const [fleetDriverDetailsOpen, setFleetDriverDetailsOpen] = useState(false);
  const idleMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());

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
          'pickup_arrived',
          'package_collected',
          'in_transit',
          'at_destination'
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

  // Fetch online drivers for fleet view
  const { data: onlineDrivers = [], refetch: refetchDrivers } = useQuery({
    queryKey: ['online-drivers', businessId],
    queryFn: async () => {
      if (!businessId) return [];

      // Query drivers managed by this business directly via managed_by_business_id
      // Also union with drivers who have active deliveries for this business (independent drivers)
      const { data: profiles, error } = await supabase
        .from('driver_profiles')
        .select('id, is_online, is_available, current_latitude, current_longitude, location_updated_at, vehicle_model, plate_number, managed_by_business_id')
        .eq('managed_by_business_id', businessId)
        .eq('is_online', true);

      if (error) throw error;

      // Also fetch independent drivers currently on active deliveries for this business
      const { data: activeDeliveryDriverRows } = await supabase
        .from('deliveries')
        .select('driver_id')
        .eq('business_id', businessId)
        .in('status', ['driver_assigned','going_to_pickup','pickup_arrived','package_collected','in_transit','at_destination'])
        .not('driver_id', 'is', null);

      const managedIds = new Set((profiles || []).map((p: { id: string }) => p.id));
      const activeIds = (activeDeliveryDriverRows || [])
        .map((r: { driver_id: string }) => r.driver_id)
        .filter((id: string) => id && !managedIds.has(id));

      let combinedProfiles = [...(profiles || [])];

      if (activeIds.length > 0) {
        const { data: activeProfiles } = await supabase
          .from('driver_profiles')
          .select('id, is_online, is_available, current_latitude, current_longitude, location_updated_at, vehicle_model, plate_number, managed_by_business_id')
          .in('id', activeIds)
          .eq('is_online', true);
        if (activeProfiles) combinedProfiles = [...combinedProfiles, ...activeProfiles];
      }

      if (combinedProfiles.length === 0) return [];

      const allDriverIds = combinedProfiles.map((p: { id: string }) => p.id);

      const { data: userProfiles } = await supabase
        .from('user_profiles')
        .select('id, first_name, last_name, phone_number, profile_image_url')
        .in('id', allDriverIds);

      const userMap = new Map((userProfiles || []).map((u: { id: string; first_name: string | null; last_name: string | null; phone_number: string | null; profile_image_url: string | null }) => [
        u.id,
        {
          full_name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Unknown Driver',
          phone_number: u.phone_number,
          profile_image_url: u.profile_image_url,
        },
      ]));

      return combinedProfiles.map((p: { id: string; is_online: boolean; is_available: boolean; current_latitude: number | null; current_longitude: number | null; location_updated_at: string | null; vehicle_model: string | null; plate_number: string | null; managed_by_business_id: string | null }) => {
        const up = userMap.get(p.id) || { full_name: 'Unknown Driver', phone_number: null, profile_image_url: null };
        return {
          id: p.id,
          is_online: p.is_online,
          is_available: p.is_available,
          current_latitude: p.current_latitude,
          current_longitude: p.current_longitude,
          location_updated_at: p.location_updated_at,
          vehicle_model: p.vehicle_model,
          vehicle_plate: p.plate_number,
          color: null,
          full_name: up.full_name,
          phone_number: up.phone_number,
          profile_image_url: up.profile_image_url,
        } as OnlineDriver;
      });
    },
    enabled: !!businessId && !userLoading && showFleetView,
    staleTime: 20000,
    refetchInterval: showFleetView ? 30000 : false,
  });

  // Ably real-time connection
  const { isConnected } = useAblyConnectionState();
  const deliveryIds = deliveries.map(d => d.id);
  const { locations: driverLocations } = useInterpolatedMultipleDriverLocations(deliveryIds);

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

  // Real-time subscription for delivery_stops changes (multi-stop progress)
  useEffect(() => {
    if (!selectedDelivery?.is_multi_stop || !selectedDelivery?.id) return;

    const stopsChannel = supabase
      .channel(`tracking-stops-${selectedDelivery.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'delivery_stops',
          filter: `delivery_id=eq.${selectedDelivery.id}`,
        },
        (payload) => {
          console.log('🔄 Stop status updated:', payload);
          // Update the specific stop in state
          setDeliveryStops(prev =>
            prev.map(stop =>
              stop.id === (payload.new as any).id
                ? { ...stop, status: (payload.new as any).status, completed_at: (payload.new as any).completed_at }
                : stop
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(stopsChannel);
    };
  }, [selectedDelivery?.id, selectedDelivery?.is_multi_stop]);

  // Manage idle driver markers on the map
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Remove all idle markers when fleet view is off
    if (!showFleetView) {
      idleMarkersRef.current.forEach(m => m.remove());
      idleMarkersRef.current.clear();
      return;
    }

    // Active delivery driver IDs (already shown with Ably real-time)
    const activeDriverIds = new Set(deliveries.map(d => d.driver_id).filter(Boolean) as string[]);

    // Remove markers for drivers no longer online / now active
    idleMarkersRef.current.forEach((marker, driverId) => {
      const stillIdle = onlineDrivers.find(d => d.id === driverId && !activeDriverIds.has(driverId));
      if (!stillIdle) {
        marker.remove();
        idleMarkersRef.current.delete(driverId);
      }
    });

    // Add/update idle driver markers
    onlineDrivers.forEach(driver => {
      if (activeDriverIds.has(driver.id)) return; // already shown via Ably
      if (!driver.current_latitude || !driver.current_longitude) return;

      const staleSecs = driver.location_updated_at
        ? Math.floor((Date.now() - new Date(driver.location_updated_at).getTime()) / 1000)
        : null;

      const staleLabel = staleSecs === null
        ? 'No location'
        : staleSecs < 60
          ? `${staleSecs}s ago`
          : staleSecs < 3600
            ? `${Math.floor(staleSecs / 60)}m ago`
            : `${Math.floor(staleSecs / 3600)}h ago`;

      // Determine freshness color: green <5m, yellow <30m, grey >30m
      const isStale = staleSecs !== null && staleSecs > 1800;
      const isWarm = staleSecs !== null && staleSecs > 300;
      const dotColor = isStale ? '%236b7280' : isWarm ? '%23f59e0b' : '%2322c55e';

      if (idleMarkersRef.current.has(driver.id)) {
        // Just update position
        idleMarkersRef.current.get(driver.id)!.setLngLat([driver.current_longitude, driver.current_latitude]);
        return;
      }

      // Create a new idle marker (grey car icon + name label)
      const el = document.createElement('div');
      el.className = 'idle-driver-marker';
      el.style.cssText = 'display:flex;flex-direction:column;align-items:center;cursor:pointer;';

      const initials = driver.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

      el.innerHTML = `
        <div style="
          width:40px;height:40px;border-radius:50%;background:#e5e7eb;
          border:3px solid #9ca3af;display:flex;align-items:center;justify-content:center;
          font-weight:700;font-size:13px;color:#374151;font-family:Inter,sans-serif;
          box-shadow:0 2px 8px rgba(0,0,0,0.2);
        ">${initials}</div>
        <div style="
          margin-top:3px;background:rgba(255,255,255,0.92);border:1px solid #d1d5db;
          border-radius:8px;padding:2px 6px;font-size:10px;font-weight:600;
          color:#374151;font-family:Inter,sans-serif;white-space:nowrap;
          box-shadow:0 1px 4px rgba(0,0,0,0.12);
        ">
          <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${dotColor.replace(/%23/g,'#')};margin-right:3px;vertical-align:middle;"></span>
          ${staleLabel}
        </div>
      `;

      el.addEventListener('click', () => {
        setSelectedFleetDriver({ ...driver, hasActiveDelivery: false });
        setFleetDriverDetailsOpen(true);
      });

      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([driver.current_longitude, driver.current_latitude])
        .addTo(map);

      idleMarkersRef.current.set(driver.id, marker);
    });
  }, [showFleetView, onlineDrivers, deliveries]);

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
      el.style.width = '36px';
      el.style.height = '36px';
      el.style.backgroundImage = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='36' viewBox='0 0 24 24' fill='none' stroke='%2310b981' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z'/%3E%3Ccircle cx='12' cy='10' r='3' fill='%2310b981'/%3E%3C/svg%3E")`;
      el.style.backgroundSize = 'contain';
      el.style.backgroundRepeat = 'no-repeat';
      el.style.cursor = 'pointer';

      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
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

    // Add stop markers for multi-stop deliveries, or single dropoff marker
    if (selectedDelivery.is_multi_stop && deliveryStops.length > 0) {
      deliveryStops.forEach((stop) => {
        if (!stop.latitude || !stop.longitude) return;
        const stopId = `stop-${stop.id}`;
        const isCompleted = stop.status === 'completed';
        const isActive = stop.status === 'in_progress';
        const pinColor = isCompleted ? '%2310b981' : isActive ? '%233b82f6' : '%23ef4444';
        const fillColor = isCompleted ? '%2310b981' : isActive ? '%233b82f6' : '%23ef4444';
        const el = document.createElement('div');
        el.className = 'stop-marker';
        el.style.width = '32px';
        el.style.height = '40px';
        el.style.position = 'relative';
        el.style.cursor = 'pointer';
        el.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 24 30">
            <path d="M12 0C7.6 0 4 3.6 4 8c0 6 8 16 8 16s8-10 8-16c0-4.4-3.6-8-8-8z" fill="${decodeURIComponent(pinColor)}" />
            <circle cx="12" cy="8" r="4" fill="white" />
            <text x="12" y="12" text-anchor="middle" font-size="6" font-weight="bold" fill="${decodeURIComponent(fillColor)}">${stop.stop_number}</text>
          </svg>`;

        const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([stop.longitude, stop.latitude])
          .setPopup(
            new mapboxgl.Popup({ offset: 25 })
              .setHTML(`<strong>Stop ${stop.stop_number}</strong><br/>${stop.address}${stop.recipient_name ? `<br/><em>${stop.recipient_name}</em>` : ''}`)
          )
          .addTo(map);

        dropoffMarkersRef.current.set(stopId, marker);
        bounds.extend([stop.longitude, stop.latitude]);
        hasValidBounds = true;
      });
    } else if (selectedDelivery.delivery_latitude && selectedDelivery.delivery_longitude) {
      // Single dropoff marker
      const dropoffId = `dropoff-${selectedDelivery.id}`;
      const el = document.createElement('div');
      el.className = 'dropoff-marker';
      el.style.width = '36px';
      el.style.height = '36px';
      el.style.backgroundImage = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='36' viewBox='0 0 24 24' fill='none' stroke='%23ef4444' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z'/%3E%3Ccircle cx='12' cy='10' r='3' fill='%23ef4444'/%3E%3C/svg%3E")`;
      el.style.backgroundSize = 'contain';
      el.style.backgroundRepeat = 'no-repeat';
      el.style.cursor = 'pointer';

      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
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
  }, [selectedDelivery, deliveryStops]);

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

  // Ordered status steps for the timeline
  const STATUS_TIMELINE_STEPS = [
    { key: 'driver_assigned', label: 'Driver Assigned', icon: Truck },
    { key: 'going_to_pickup', label: 'Going to Pickup', icon: Navigation },
    { key: 'pickup_arrived', label: 'Arrived at Pickup', icon: MapPin },
    { key: 'package_collected', label: 'Package Collected', icon: Package },
    { key: 'in_transit', label: 'In Transit', icon: Navigation },
    { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
  ];

  // For multi-stop: simplified parent status flow
  const MULTI_STOP_PARENT_STEPS = [
    { key: 'driver_assigned', label: 'Driver Assigned', icon: Truck },
    { key: 'going_to_pickup', label: 'Going to Pickup', icon: Navigation },
    { key: 'pickup_arrived', label: 'At Pickup', icon: MapPin },
    { key: 'package_collected', label: 'Collected', icon: Package },
    { key: 'in_transit', label: 'Delivering Stops', icon: Navigation },
    { key: 'delivered', label: 'All Stops Delivered', icon: CheckCircle2 },
  ];

  const getTimelineStepIndex = (status: string, steps: { key: string }[]) => {
    // Map alias statuses to canonical keys
    const aliasMap: Record<string, string> = {
      'arrived_at_pickup': 'pickup_arrived',
      'picked_up': 'package_collected',
      'going_to_dropoff': 'in_transit',
      'arrived_at_dropoff': 'delivered',
      'dropoff_arrived': 'delivered',
      'at_destination': 'delivered',
    };
    const canonical = aliasMap[status] || status;
    const idx = steps.findIndex(s => s.key === canonical);
    return idx >= 0 ? idx : -1;
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

  const fetchStopsForDelivery = async (deliveryId: string) => {
    setLoadingStops(true);
    setDeliveryStops([]);
    try {
      const { data, error } = await supabase
        .from('delivery_stops')
        .select('id,stop_number,stop_type,address,latitude,longitude,recipient_name,recipient_phone,delivery_notes,status,completed_at,tracking_code')
        .eq('delivery_id', deliveryId)
        .order('stop_number', { ascending: true });
      if (!error && data) setDeliveryStops(data);
    } finally {
      setLoadingStops(false);
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

  const STATUS_GROUPS: Record<string, string[]> = {
    pickup: ['driver_assigned', 'going_to_pickup', 'arrived_at_pickup', 'pickup_arrived'],
    transit: ['picked_up', 'package_collected', 'in_transit', 'going_to_dropoff'],
    arriving: ['arrived_at_dropoff', 'dropoff_arrived', 'at_destination'],
  };

  const filteredDeliveries = deliveries.filter(d => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      !q ||
      d.id?.toLowerCase().includes(q) ||
      (d as any).tracking_number?.toLowerCase().includes(q) ||
      d.pickup_address?.toLowerCase().includes(q) ||
      d.delivery_address?.toLowerCase().includes(q) ||
      d.driver_profiles?.user_profiles?.full_name?.toLowerCase().includes(q);

    const matchesFilter =
      statusFilter === 'all' ||
      (statusFilter === 'pickup' && STATUS_GROUPS.pickup.includes(d.status)) ||
      (statusFilter === 'transit' && STATUS_GROUPS.transit.includes(d.status)) ||
      (statusFilter === 'arriving' && STATUS_GROUPS.arriving.includes(d.status));

    return matchesSearch && matchesFilter;
  });

  const countByGroup = {
    pickup: deliveries.filter(d => STATUS_GROUPS.pickup.includes(d.status)).length,
    transit: deliveries.filter(d => STATUS_GROUPS.transit.includes(d.status)).length,
    arriving: deliveries.filter(d => STATUS_GROUPS.arriving.includes(d.status)).length,
  };

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
          {showFleetView && onlineDrivers.length > 0 && (
            <Badge className="ml-1 bg-emerald-100 text-emerald-700 border-emerald-200">
              <Users className="h-3 w-3 mr-1" />
              {onlineDrivers.length} Online
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showFleetView ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setShowFleetView(v => !v);
              if (!showFleetView) setSidebarTab('drivers');
              else setSidebarTab('deliveries');
            }}
            className={showFleetView ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}
          >
            <Users className="h-4 w-4" />
            <span className="ml-2">{showFleetView ? 'Fleet View On' : 'Fleet View'}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { refetch(); if (showFleetView) refetchDrivers(); }}
            disabled={isLoading}
            className="hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">Refresh</span>
          </Button>
        </div>
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
              {/* Tab Switcher (only when fleet view is on) */}
              {showFleetView && (
                <div className="flex border-b dark:border-gray-700">
                  <button
                    onClick={() => setSidebarTab('deliveries')}
                    className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                      sidebarTab === 'deliveries'
                        ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-800'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 bg-gray-50 dark:bg-gray-900'
                    }`}
                  >
                    <Truck className="h-4 w-4 inline mr-1.5" />
                    Deliveries ({deliveries.length})
                  </button>
                  <button
                    onClick={() => setSidebarTab('drivers')}
                    className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                      sidebarTab === 'drivers'
                        ? 'border-b-2 border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-gray-800'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 bg-gray-50 dark:bg-gray-900'
                    }`}
                  >
                    <Users className="h-4 w-4 inline mr-1.5" />
                    Drivers ({onlineDrivers.length})
                  </button>
                </div>
              )}

              {/* Sidebar Header */}
              {sidebarTab === 'deliveries' && (
              <div className="p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Active Deliveries</h2>
                  {deliveries.length > 0 && (
                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                      {countByGroup.pickup > 0 && (
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
                          {countByGroup.pickup} pickup
                        </span>
                      )}
                      {countByGroup.transit > 0 && (
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                          {countByGroup.transit} transit
                        </span>
                      )}
                      {countByGroup.arriving > 0 && (
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                          {countByGroup.arriving} arriving
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by tracking, address, driver..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-white dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                  />
                </div>
                {/* Filter pills */}
                <div className="flex gap-1.5 flex-wrap">
                  {([
                    { key: 'all', label: 'All', count: deliveries.length },
                    { key: 'pickup', label: '📦 Pickup', count: countByGroup.pickup },
                    { key: 'transit', label: '🚚 Transit', count: countByGroup.transit },
                    { key: 'arriving', label: '📍 Arriving', count: countByGroup.arriving },
                  ] as const).map(({ key, label, count }) => (
                    <button
                      key={key}
                      onClick={() => setStatusFilter(key)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                        statusFilter === key
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-blue-400'
                      }`}
                    >
                      {label} {count > 0 && <span className={statusFilter === key ? 'opacity-70' : 'text-gray-400'}>{count}</span>}
                    </button>
                  ))}
                </div>
              </div>
              )}

              {/* Sidebar Content — Deliveries tab */}
              {sidebarTab === 'deliveries' && (
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
                    {searchTerm || statusFilter !== 'all' ? (
                      <>
                        <Search className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">No matches</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Try a different search or filter</p>
                        <Button variant="outline" size="sm" onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}>
                          Clear filters
                        </Button>
                      </>
                    ) : (
                      <>
                        <Truck className="h-14 w-14 text-gray-300 dark:text-gray-600 mb-3" />
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">No Active Deliveries</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Deliveries with assigned drivers will appear here for live tracking</p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="p-4 space-y-3">
                    {filteredDeliveries.map((delivery) => {
                      const location = driverLocations.get(delivery.id);
                      const isSelected = selectedDelivery?.id === delivery.id;
                      const routeInfo = routeDataRef.current.get(delivery.id);
                      const etaMin = routeInfo ? Math.round(routeInfo.duration / 60) : null;
                      const distKm = routeInfo ? (routeInfo.distance / 1000).toFixed(1) : null;
                      const trackingNum = (delivery as any).tracking_number as string | undefined;

                      return (
                        <Card
                          key={delivery.id}
                          className={`cursor-pointer transition-all duration-200 ${
                            isSelected 
                              ? 'ring-2 ring-blue-500 shadow-lg bg-blue-50 dark:bg-blue-900/30' 
                              : 'hover:shadow-md hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                          onClick={() => focusOnDelivery(delivery)}
                        >
                          <CardContent className="p-3">
                            <div className="space-y-2.5">
                              {/* Header row: status badge + ETA chip */}
                              <div className="flex items-center justify-between gap-2">
                                <Badge
                                  variant="secondary"
                                  className={`${getStatusColor(delivery.status)} text-white text-xs shrink-0`}
                                >
                                  {getStatusLabel(delivery.status)}
                                </Badge>
                                <div className="flex items-center gap-1.5">
                                  {etaMin !== null && (
                                    <span className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-semibold px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-700">
                                      <Clock className="h-3 w-3" />
                                      {etaMin} min
                                    </span>
                                  )}
                                  {distKm && (
                                    <span className="text-xs text-gray-400 dark:text-gray-500">{distKm} km</span>
                                  )}
                                </div>
                              </div>

                              {/* Tracking number + amount */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <Tag className="h-3 w-3 text-gray-400" />
                                  <span className="font-mono text-xs font-medium text-gray-600 dark:text-gray-300">
                                    {trackingNum || `#${delivery.id?.slice(-8).toUpperCase()}`}
                                  </span>
                                </div>
                                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                  ₱{delivery.total_amount?.toFixed(2) || '0.00'}
                                </span>
                              </div>

                              {/* Addresses */}
                              <div className="space-y-1.5">
                                <div className="flex items-start gap-2">
                                  <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                                  <p className="text-xs text-gray-600 dark:text-gray-300 truncate leading-snug">{delivery.pickup_address}</p>
                                </div>
                                {delivery.is_multi_stop ? (
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-purple-500 mt-0.5 flex-shrink-0" />
                                    <span className="text-xs font-medium text-purple-600 dark:text-purple-400">
                                      Multi-stop delivery
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-start gap-2">
                                    <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                                    <p className="text-xs text-gray-600 dark:text-gray-300 truncate leading-snug">{delivery.delivery_address}</p>
                                  </div>
                                )}
                              </div>

                              {/* Driver + live indicator */}
                              <div className="flex items-center justify-between pt-1.5 border-t dark:border-gray-700">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {delivery.driver_profiles ? (
                                    <>
                                      <User className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                                      <span className="text-xs text-gray-600 dark:text-gray-300 truncate">
                                        {delivery.driver_profiles.user_profiles.full_name}
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-xs text-gray-400">No driver</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {location ? (
                                    <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                                      <Circle className="h-2 w-2 fill-green-500 text-green-500 animate-pulse" />
                                      Live
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-1 text-xs text-gray-400">
                                      <Circle className="h-2 w-2 fill-gray-300 text-gray-300" />
                                      Offline
                                    </span>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedDelivery(delivery);
                                      setDetailsOpen(true);
                                      if (delivery.is_multi_stop) fetchStopsForDelivery(delivery.id);
                                    }}
                                    className="h-6 w-6 p-0 hover:bg-white dark:hover:bg-gray-600"
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
              )}

              {/* Sidebar Content — Drivers tab */}
              {sidebarTab === 'drivers' && (
              <div className="flex-1 overflow-y-auto">
                {onlineDrivers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-center p-6">
                    <Users className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">No Online Drivers</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Drivers will appear here when they go online</p>
                  </div>
                ) : (
                  <div className="p-4 space-y-3">
                    {onlineDrivers.map((driver) => {
                      const activeDriverIds = new Set(deliveries.map(d => d.driver_id).filter(Boolean));
                      const isOnDelivery = activeDriverIds.has(driver.id);
                      const staleSecs = driver.location_updated_at
                        ? Math.floor((Date.now() - new Date(driver.location_updated_at).getTime()) / 1000)
                        : null;
                      const staleLabel = staleSecs === null
                        ? 'No location'
                        : staleSecs < 60
                          ? `${staleSecs}s ago`
                          : staleSecs < 3600
                            ? `${Math.floor(staleSecs / 60)}m ago`
                            : `${Math.floor(staleSecs / 3600)}h ago`;
                      const initials = driver.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

                      return (
                        <Card
                          key={driver.id}
                          className="cursor-pointer hover:shadow-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                          onClick={() => {
                            setSelectedFleetDriver(driver);
                            setFleetDriverDetailsOpen(true);
                            // Fly to driver on map if they have a location
                            if (driver.current_latitude && driver.current_longitude && mapRef.current) {
                              isProgrammaticMoveRef.current = true;
                              mapRef.current.flyTo({
                                center: [driver.current_longitude, driver.current_latitude],
                                zoom: 15,
                                duration: 800,
                              });
                            }
                          }}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-center gap-3">
                              {/* Avatar */}
                              <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 text-sm font-bold text-gray-600 dark:text-gray-300">
                                {initials}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{driver.full_name}</p>
                                  {isOnDelivery ? (
                                    <Badge className="text-[10px] bg-blue-100 text-blue-700 border-blue-200 shrink-0">On Delivery</Badge>
                                  ) : driver.is_available ? (
                                    <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200 shrink-0">Available</Badge>
                                  ) : (
                                    <Badge className="text-[10px] bg-gray-100 text-gray-600 border-gray-200 shrink-0">Busy</Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {driver.vehicle_model && (
                                    <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                      <Car className="h-3 w-3 inline mr-0.5" />
                                      {driver.vehicle_model}{driver.vehicle_plate ? ` · ${driver.vehicle_plate}` : ''}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 mt-1">
                                  {isOnDelivery ? (
                                    <Circle className="h-2 w-2 fill-blue-500 text-blue-500 animate-pulse" />
                                  ) : staleSecs !== null && staleSecs < 300 ? (
                                    <Circle className="h-2 w-2 fill-green-500 text-green-500" />
                                  ) : staleSecs !== null && staleSecs < 1800 ? (
                                    <Circle className="h-2 w-2 fill-yellow-500 text-yellow-500" />
                                  ) : (
                                    <Circle className="h-2 w-2 fill-gray-400 text-gray-400" />
                                  )}
                                  <span className="text-xs text-gray-400 dark:text-gray-500">
                                    {isOnDelivery ? 'Live tracking' : `Last seen ${staleLabel}`}
                                  </span>
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
              )}
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
                    {selectedDelivery.is_multi_stop && (
                      <span className="ml-auto text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-2 py-0.5 rounded-full">
                        Multi-Stop
                      </span>
                    )}
                  </h3>

                  {/* Pickup */}
                  <div className="space-y-2">
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

                    {/* Multi-stop stops list */}
                    {selectedDelivery.is_multi_stop && (
                      loadingStops ? (
                        <div className="flex items-center gap-2 py-3 justify-center text-sm text-gray-500">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading stops...
                        </div>
                      ) : deliveryStops.length > 0 ? (
                        <div className="relative pl-4">
                          {/* Vertical connector line */}
                          <div className="absolute left-[13px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-green-400 via-blue-400 to-red-400" />
                          <div className="space-y-2">
                            {deliveryStops.map((stop, idx) => {
                              const isCompleted = stop.status === 'completed';
                              const isActive = stop.status === 'in_progress';
                              const dotColor = isCompleted ? 'bg-emerald-500' : isActive ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600';
                              const cardBg = isCompleted
                                ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20'
                                : isActive
                                  ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20'
                                  : '';
                              return (
                                <Card key={stop.id} className={`ml-4 ${cardBg}`}>
                                  <CardContent className="p-3">
                                    <div className="flex items-start gap-2">
                                      <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${dotColor}`} />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                          <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                                            Stop {stop.stop_number}
                                            {idx === deliveryStops.length - 1 && (
                                              <span className="ml-1 text-red-600">· Final</span>
                                            )}
                                          </p>
                                          <Badge
                                            className={`text-[10px] py-0 px-1.5 flex-shrink-0 ${
                                              isCompleted ? 'bg-emerald-100 text-emerald-700'
                                              : isActive ? 'bg-blue-100 text-blue-700'
                                              : 'bg-gray-100 text-gray-600'
                                            }`}
                                          >
                                            {isCompleted ? 'Delivered' : isActive ? 'Active' : 'Pending'}
                                          </Badge>
                                        </div>
                                        <p className="text-xs text-gray-700 dark:text-gray-200 mt-0.5 leading-snug">{stop.address}</p>
                                        {stop.recipient_name && (
                                          <p className="text-xs text-gray-500 mt-0.5">For: {stop.recipient_name}</p>
                                        )}
                                        {stop.recipient_phone && (
                                          <p className="text-xs text-gray-500">
                                            <Phone className="h-2.5 w-2.5 inline mr-0.5" />{stop.recipient_phone}
                                          </p>
                                        )}
                                        {stop.delivery_notes && (
                                          <p className="text-xs text-gray-400 italic mt-0.5">{stop.delivery_notes}</p>
                                        )}
                                        {stop.tracking_code && (
                                          <p className="text-[10px] font-mono text-gray-400 mt-0.5">#{stop.tracking_code}</p>
                                        )}
                                        {isCompleted && stop.completed_at && (
                                          <p className="text-[10px] text-emerald-600 mt-0.5">
                                            Completed {new Date(stop.completed_at).toLocaleTimeString()}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        /* Fallback: no stops data yet, show single destination */
                        <>
                          <div className="flex justify-center">
                            <div className="w-0.5 h-6 bg-gradient-to-b from-green-500 to-red-500" />
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
                        </>
                      )
                    )}

                    {/* Single-stop fallback */}
                    {!selectedDelivery.is_multi_stop && (
                      <>
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
                      </>
                    )}
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

                {/* Status Timeline */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2 text-gray-900 dark:text-white">
                    <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    Status Timeline
                  </h3>
                  <Card>
                    <CardContent className="p-4">
                      {(() => {
                        const isMulti = selectedDelivery.is_multi_stop;
                        const steps = isMulti ? MULTI_STOP_PARENT_STEPS : STATUS_TIMELINE_STEPS;
                        const currentIdx = getTimelineStepIndex(selectedDelivery.status, steps);

                        return (
                          <div className="space-y-0">
                            {/* Step timeline */}
                            <div className="relative">
                              {/* Vertical line */}
                              <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-gray-200 dark:bg-gray-700" />
                              <div className="space-y-1">
                                {steps.map((step, idx) => {
                                  const isCompleted = idx <= currentIdx;
                                  const isCurrent = idx === currentIdx;
                                  const Icon = step.icon;
                                  return (
                                    <div key={step.key} className="relative flex items-center gap-3 py-1.5">
                                      <div
                                        className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0 ${
                                          isCurrent
                                            ? 'bg-blue-600 ring-4 ring-blue-100 dark:ring-blue-900/40'
                                            : isCompleted
                                              ? 'bg-emerald-500'
                                              : 'bg-gray-200 dark:bg-gray-700'
                                        }`}
                                      >
                                        <Icon className={`h-3.5 w-3.5 ${
                                          isCompleted || isCurrent ? 'text-white' : 'text-gray-400 dark:text-gray-500'
                                        }`} />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-medium ${
                                          isCurrent
                                            ? 'text-blue-700 dark:text-blue-300'
                                            : isCompleted
                                              ? 'text-gray-700 dark:text-gray-300'
                                              : 'text-gray-400 dark:text-gray-600'
                                        }`}>
                                          {step.label}
                                        </p>
                                        {isCurrent && (
                                          <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {formatTime(selectedDelivery.updated_at)}
                                          </p>
                                        )}
                                      </div>
                                      {isCurrent && (
                                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                          Current
                                        </span>
                                      )}
                                      {isCompleted && !isCurrent && (
                                        <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Multi-stop per-stop progress */}
                            {isMulti && deliveryStops.length > 0 && (
                              <div className="mt-4 pt-4 border-t dark:border-gray-700">
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
                                  <Package className="h-3 w-3" />
                                  Stop Progress
                                </p>
                                <div className="space-y-1.5">
                                  {deliveryStops.map((stop) => {
                                    const isCompleted = stop.status === 'completed';
                                    const isActive = stop.status === 'in_progress';
                                    return (
                                      <div key={stop.id} className="flex items-center gap-2">
                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                                          isCompleted
                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                            : isActive
                                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                                              : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500'
                                        }`}>
                                          {stop.stop_number}
                                        </div>
                                        <span className="text-xs text-gray-600 dark:text-gray-300 flex-1 truncate">
                                          {stop.recipient_name || stop.address}
                                        </span>
                                        {isCompleted ? (
                                          <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                                            <CheckCircle2 className="h-3 w-3" />
                                            {stop.completed_at
                                              ? new Date(stop.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                              : 'Done'
                                            }
                                          </span>
                                        ) : isActive ? (
                                          <span className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 flex-shrink-0">
                                            <ArrowRight className="h-3 w-3" />
                                            En Route
                                          </span>
                                        ) : (
                                          <span className="text-[10px] text-gray-400 flex-shrink-0">Pending</span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                                {/* Summary bar */}
                                {(() => {
                                  const total = deliveryStops.length;
                                  const completed = deliveryStops.filter(s => s.status === 'completed').length;
                                  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                                  return (
                                    <div className="mt-3">
                                      <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400 mb-1">
                                        <span>{completed} of {total} stops completed</span>
                                        <span>{pct}%</span>
                                      </div>
                                      <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                          style={{ width: `${pct}%` }}
                                        />
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            )}

                            {/* Timestamps */}
                            <div className="mt-4 pt-3 border-t dark:border-gray-700 space-y-1.5">
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500 dark:text-gray-400">Created</span>
                                <span className="text-gray-700 dark:text-gray-300">{new Date(selectedDelivery.created_at).toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500 dark:text-gray-400">Last Updated</span>
                                <span className="text-gray-700 dark:text-gray-300">{formatTime(selectedDelivery.updated_at)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
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

      {/* Fleet Driver Details Sheet */}
      <Sheet open={fleetDriverDetailsOpen} onOpenChange={setFleetDriverDetailsOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selectedFleetDriver && (() => {
            const driver = selectedFleetDriver;
            const staleSecs = driver.location_updated_at
              ? Math.floor((Date.now() - new Date(driver.location_updated_at).getTime()) / 1000)
              : null;
            const staleLabel = staleSecs === null
              ? 'No location data'
              : staleSecs < 60
                ? `${staleSecs} seconds ago`
                : staleSecs < 3600
                  ? `${Math.floor(staleSecs / 60)} minutes ago`
                  : `${Math.floor(staleSecs / 3600)} hours ago`;
            const activeDriverIds = new Set(deliveries.map(d => d.driver_id).filter(Boolean));
            const isOnDelivery = activeDriverIds.has(driver.id);
            const initials = driver.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

            return (
              <>
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-lg font-bold text-gray-600 dark:text-gray-300">
                      {initials}
                    </div>
                    <div>
                      <div className="text-lg">{driver.full_name}</div>
                      <div className="text-sm text-gray-500 font-normal">
                        {isOnDelivery ? (
                          <span className="text-blue-600">On active delivery</span>
                        ) : driver.is_available ? (
                          <span className="text-emerald-600">Available for dispatch</span>
                        ) : (
                          <span className="text-gray-500">Online · Unavailable</span>
                        )}
                      </div>
                    </div>
                  </SheetTitle>
                  <SheetDescription>
                    {isOnDelivery ? (
                      <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                        <Circle className="h-2 w-2 fill-blue-500 mr-1 animate-pulse" />Live Tracking Active
                      </Badge>
                    ) : (
                      <Badge className={driver.is_available ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-600 border-gray-200'}>
                        {driver.is_available ? 'Available' : 'Unavailable'}
                      </Badge>
                    )}
                  </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-5">
                  {/* Contact */}
                  {driver.phone_number && (
                    <div>
                      <h3 className="font-semibold mb-2 flex items-center gap-2 text-gray-900 dark:text-white">
                        <Phone className="h-4 w-4 text-blue-600" />Contact
                      </h3>
                      <Card>
                        <CardContent className="p-4">
                          <p className="font-medium text-gray-900 dark:text-white">{driver.phone_number}</p>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* Vehicle */}
                  {(driver.vehicle_model || driver.vehicle_plate) && (
                    <div>
                      <h3 className="font-semibold mb-2 flex items-center gap-2 text-gray-900 dark:text-white">
                        <Car className="h-4 w-4 text-blue-600" />Vehicle
                      </h3>
                      <Card>
                        <CardContent className="p-4 space-y-2">
                          {driver.vehicle_model && (
                            <div>
                              <p className="text-sm text-gray-500 dark:text-gray-400">Model</p>
                              <p className="font-medium text-gray-900 dark:text-white">{driver.vehicle_model}</p>
                            </div>
                          )}
                          {driver.vehicle_plate && (
                            <div>
                              <p className="text-sm text-gray-500 dark:text-gray-400">Plate Number</p>
                              <p className="font-medium font-mono text-gray-900 dark:text-white">{driver.vehicle_plate}</p>
                            </div>
                          )}
                          {driver.color && (
                            <div>
                              <p className="text-sm text-gray-500 dark:text-gray-400">Color</p>
                              <p className="font-medium text-gray-900 dark:text-white capitalize">{driver.color}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* Location */}
                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2 text-gray-900 dark:text-white">
                      <MapPin className="h-4 w-4 text-blue-600" />Last Known Location
                    </h3>
                    <Card>
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          {staleSecs !== null && staleSecs < 300 ? (
                            <Circle className="h-3 w-3 fill-green-500 text-green-500" />
                          ) : staleSecs !== null && staleSecs < 1800 ? (
                            <Circle className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                          ) : (
                            <Circle className="h-3 w-3 fill-gray-400 text-gray-400" />
                          )}
                          <p className="text-sm text-gray-700 dark:text-gray-300">Updated {staleLabel}</p>
                        </div>
                        {driver.current_latitude && driver.current_longitude ? (
                          <p className="text-xs text-gray-400 font-mono">
                            {driver.current_latitude.toFixed(5)}, {driver.current_longitude.toFixed(5)}
                          </p>
                        ) : (
                          <p className="text-sm text-gray-400">No GPS data available</p>
                        )}
                        {isOnDelivery && (
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                            ℹ️ Real-time position shown on map via live tracking
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t dark:border-gray-700 space-y-2">
                    {driver.current_latitude && driver.current_longitude && (
                      <Button
                        className="w-full"
                        onClick={() => {
                          if (mapRef.current) {
                            isProgrammaticMoveRef.current = true;
                            mapRef.current.flyTo({
                              center: [driver.current_longitude!, driver.current_latitude!],
                              zoom: 15,
                              duration: 800,
                            });
                          }
                          setFleetDriverDetailsOpen(false);
                        }}
                      >
                        <MapPin className="h-4 w-4 mr-2" />Focus on Map
                      </Button>
                    )}
                    <Button variant="outline" className="w-full" onClick={() => setFleetDriverDetailsOpen(false)}>
                      Close
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
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
