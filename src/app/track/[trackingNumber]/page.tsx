'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { useParams } from 'next/navigation';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { createClient } from '@/lib/supabase/client';
import { useDriverLocation } from '@/lib/ably-client';
import { DriverMarker } from '@/components/driver-marker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Package,
  MapPin,
  Navigation,
  Clock,
  Phone,
  Loader2,
  CheckCircle2,
  Circle,
  Truck,
  AlertCircle,
  Star,
} from 'lucide-react';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '';

// Validate Mapbox token
if (!mapboxgl.accessToken) {
  console.error('NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN is not set');
}

interface DeliveryData {
  id: string;
  tracking_number: string;
  status: string;
  pickup_address: string;
  pickup_latitude: number;
  pickup_longitude: number;
  delivery_address: string;
  delivery_latitude: number;
  delivery_longitude: number;
  package_description: string;
  package_weight: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  estimated_duration: number | null;
  distance_km: number | null;
  customer_rating: number | null;
  is_multi_stop?: boolean;
  stop_info?: {
    stop_number: number;
    recipient_name: string | null;
    recipient_phone: string | null;
    delivery_notes: string | null;
  };
  driver_info?: {
    name: string;
    phone: string;
    vehicle: string;
    rating: number;
  };
  business_branding?: {
    business_name: string;
    logo_url?: string;
    primary_color?: string;
    support_phone?: string;
  };
}

interface StatusStep {
  key: string;
  label: string;
  icon: React.ElementType;
}

const STATUS_STEPS: StatusStep[] = [
  { key: 'pending', label: 'Order Placed', icon: Circle },
  { key: 'driver_assigned', label: 'Driver Assigned', icon: Truck },
  { key: 'pickup_arrived', label: 'Arriving at Pickup', icon: MapPin },
  { key: 'package_collected', label: 'In Transit', icon: Navigation },
  { key: 'in_transit', label: 'In Transit', icon: Navigation },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
];

export default function TrackingPage() {
  const params = useParams();
  const trackingNumber = params?.trackingNumber as string;
  
  const [delivery, setDelivery] = useState<DeliveryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);
  const [driverInfo, setDriverInfo] = useState<any>(null);
  const [eta, setEta] = useState<number | null>(null);
  const [distanceToDelivery, setDistanceToDelivery] = useState<number | null>(null);
  const [rating, setRating] = useState<number>(0);
  const [feedback, setFeedback] = useState<string>('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const mapContainer = useRef<HTMLDivElement>(null);
  const driverMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const pickupMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const deliveryMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const lastRouteUpdateRef = useRef<number>(0);

  const supabase = createClient();

  // Subscribe to driver location updates via Ably
  const shouldTrackDriver = delivery?.status && ['driver_assigned', 'pickup_arrived', 'package_collected', 'in_transit'].includes(delivery.status);
  const { location: driverLocation, isConnected: driverConnected } = useDriverLocation(
    shouldTrackDriver ? delivery?.id || null : null
  );

  // Fetch delivery data
  useEffect(() => {
    if (!trackingNumber) return;

    const fetchDelivery = async () => {
      try {
        setLoading(true);
        
        // Parse tracking code to detect stop-specific tracking
        // Format: SD-20241218-abc123 (full delivery) or SD-20241218-abc123-1 (stop 1)
        const stopMatch = trackingNumber.match(/^(.+)-(\d+)$/);
        const isStopSpecific = !!stopMatch;
        const parentTrackingNumber = stopMatch ? stopMatch[1] : trackingNumber;
        const stopNumber = stopMatch ? parseInt(stopMatch[2]) : null;

        // Fetch delivery using parent tracking number
        const { data, error } = await supabase
          .from('deliveries')
          .select(`
            id,
            tracking_number,
            status,
            pickup_address,
            pickup_latitude,
            pickup_longitude,
            delivery_address,
            delivery_latitude,
            delivery_longitude,
            package_description,
            package_weight,
            created_at,
            updated_at,
            completed_at,
            estimated_duration,
            distance_km,
            customer_rating,
            driver_id,
            business_id,
            is_multi_stop
          `)
          .eq('tracking_number', parentTrackingNumber)
          .single();

        if (error) throw error;
        if (!data) throw new Error('Delivery not found');

        // If stop-specific tracking, fetch and filter to that stop only
        let stopData = null;
        if (isStopSpecific && data.is_multi_stop && stopNumber) {
          const { data: stops, error: stopsError } = await supabase
            .from('delivery_stops')
            .select('*')
            .eq('delivery_id', data.id)
            .eq('stop_number', stopNumber)
            .single();

          if (stopsError) {
            throw new Error('Stop not found');
          }
          stopData = stops;
          
          // Override delivery addresses with stop-specific data for privacy
          data.delivery_address = stops.address;
          data.delivery_latitude = stops.latitude;
          data.delivery_longitude = stops.longitude;
          
          // Override delivery status with stop-specific status
          // Map stop status to delivery status format
          if (stops.status === 'completed') {
            data.status = 'delivered';
            data.completed_at = stops.completed_at;
          } else if (stops.status === 'in_progress') {
            data.status = 'in_transit';
          } else if (stops.status === 'pending') {
            // Keep the overall delivery status (driver might be at another stop)
            // Only override if delivery is already in transit
            if (data.status === 'in_transit' || data.status === 'at_destination') {
              data.status = 'in_transit';
            }
          }
        }

        // Fetch business branding
        const { data: businessData } = await supabase
          .from('business_accounts')
          .select('business_name, business_phone, settings')
          .eq('id', data.business_id)
          .single();

        // Fetch driver info if assigned
        if (data.driver_id) {
          const { data: driverData } = await supabase
            .from('driver_profiles')
            .select('id, user_id')
            .eq('id', data.driver_id)
            .single();

          if (driverData?.user_id) {
            const { data: userProfile } = await supabase
              .from('user_profiles')
              .select('full_name, phone_number')
              .eq('id', driverData.user_id)
              .single();

            if (userProfile) {
              setDriverInfo({
                name: userProfile.full_name?.split(' ')[0] || 'Driver',
                phone: userProfile.phone_number || '',
              });
            }
          }
        }

        const deliveryData: DeliveryData = {
          ...data,
          stop_info: stopData ? {
            stop_number: stopData.stop_number,
            recipient_name: stopData.recipient_name,
            recipient_phone: stopData.recipient_phone,
            delivery_notes: stopData.delivery_notes,
          } : undefined,
          driver_info: driverInfo,
          business_branding: businessData ? {
            business_name: businessData.business_name,
            logo_url: businessData.settings?.logo_url,
            primary_color: businessData.settings?.primary_color || '#3b82f6',
            support_phone: businessData.business_phone,
          } : undefined,
        };

        setDelivery(deliveryData);
      } catch (err: any) {
        console.error('Error fetching delivery:', err);
        setError(err.message || 'Failed to load tracking information');
      } finally {
        setLoading(false);
      }
    };

    fetchDelivery();

    // Parse tracking code for subscription
    const stopMatch = trackingNumber.match(/^(.+)-(\d+)$/);
    const isStopSpecific = !!stopMatch;
    const parentTrackingNumber = stopMatch ? stopMatch[1] : trackingNumber;
    const stopNumber = stopMatch ? parseInt(stopMatch[2]) : null;

    // Subscribe to real-time updates
    const channel = supabase.channel(`delivery:${trackingNumber}`);
    
    // Always subscribe to main delivery updates
    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'deliveries',
        filter: `tracking_number=eq.${parentTrackingNumber}`,
      },
      (payload) => {
        setDelivery((prev) => {
          if (!prev) return null;
          // Don't override stop-specific status if viewing a stop
          if (isStopSpecific && prev.stop_info) {
            return { ...prev, ...payload.new, status: prev.status, completed_at: prev.completed_at };
          }
          return { ...prev, ...payload.new };
        });
      }
    );
    
    // If viewing stop-specific tracking, also subscribe to that stop's updates
    if (isStopSpecific && delivery?.id && stopNumber) {
      channel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'delivery_stops',
          filter: `delivery_id=eq.${delivery.id}&stop_number=eq.${stopNumber}`,
        },
        (payload: any) => {
          setDelivery((prev) => {
            if (!prev) return null;
            
            // Update stop-specific data
            const updates: any = {
              delivery_address: payload.new.address,
              delivery_latitude: payload.new.latitude,
              delivery_longitude: payload.new.longitude,
            };
            
            // Map stop status to delivery status
            if (payload.new.status === 'completed') {
              updates.status = 'delivered';
              updates.completed_at = payload.new.completed_at;
            } else if (payload.new.status === 'in_progress') {
              updates.status = 'in_transit';
            }
            
            // Update stop_info
            if (prev.stop_info) {
              updates.stop_info = {
                ...prev.stop_info,
                recipient_name: payload.new.recipient_name,
                recipient_phone: payload.new.recipient_phone,
                delivery_notes: payload.new.delivery_notes,
              };
            }
            
            return { ...prev, ...updates };
          });
        }
      );
    }
    
    channel.subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [trackingNumber]);

  // Initialize rating from existing customer_rating
  useEffect(() => {
    if (delivery?.customer_rating) {
      setRating(delivery.customer_rating);
      setRatingSubmitted(true);
    }
  }, [delivery?.customer_rating]);

  // Handle rating submission
  const handleSubmitRating = async () => {
    if (!delivery || rating === 0) return;

    try {
      setSubmittingRating(true);
      const { error } = await supabase
        .from('deliveries')
        .update({ customer_rating: rating })
        .eq('id', delivery.id);

      if (error) throw error;

      setRatingSubmitted(true);
      setDelivery((prev) => prev ? { ...prev, customer_rating: rating } : null);
    } catch (err) {
      console.error('Error submitting rating:', err);
      alert('Failed to submit rating. Please try again.');
    } finally {
      setSubmittingRating(false);
    }
  };

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !delivery || mapInstance) return;

    console.log('Initializing Mapbox map...');
    console.log('Mapbox token:', mapboxgl.accessToken ? 'Set ✓' : 'Missing ✗');
    console.log('Delivery coordinates:', {
      pickup: [delivery.pickup_longitude, delivery.pickup_latitude],
      delivery: [delivery.delivery_longitude, delivery.delivery_latitude]
    });

    try {
      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12', // Use default Mapbox style
        center: [delivery.pickup_longitude, delivery.pickup_latitude],
        zoom: 12,
      });

      map.on('error', (e) => {
        console.error('Mapbox error:', e);
        setError('Failed to load map. Please refresh the page.');
      });

      map.on('load', () => {
        console.log('Mapbox map loaded successfully');
        // Add pickup marker with pin styling (matching order page)
      const pickupEl = document.createElement('div');
      pickupEl.className = 'pickup-marker';
      pickupEl.style.width = '40px';
      pickupEl.style.height = '40px';
      pickupEl.style.backgroundImage = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2310b981\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z\'/%3E%3Ccircle cx=\'12\' cy=\'10\' r=\'3\' fill=\'%2310b981\'/%3E%3C/svg%3E")';
      pickupEl.style.backgroundSize = 'contain';
      pickupEl.style.cursor = 'pointer';

      const pickupMarker = new mapboxgl.Marker({ element: pickupEl, anchor: 'bottom' })
        .setLngLat([delivery.pickup_longitude, delivery.pickup_latitude])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML('<strong>Pickup</strong><br/>' + delivery.pickup_address)
        )
        .addTo(map);
      pickupMarkerRef.current = pickupMarker;

      // Add delivery marker with pin styling (matching order page)
      const deliveryEl = document.createElement('div');
      deliveryEl.className = 'delivery-marker';
      deliveryEl.style.width = '40px';
      deliveryEl.style.height = '40px';
      deliveryEl.style.backgroundImage = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23ef4444\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z\'/%3E%3Ccircle cx=\'12\' cy=\'10\' r=\'3\' fill=\'%23ef4444\'/%3E%3C/svg%3E")';
      deliveryEl.style.backgroundSize = 'contain';
      deliveryEl.style.cursor = 'pointer';

      const deliveryMarker = new mapboxgl.Marker({ element: deliveryEl, anchor: 'bottom' })
        .setLngLat([delivery.delivery_longitude, delivery.delivery_latitude])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML('<strong>Delivery</strong><br/>' + delivery.delivery_address)
        )
        .addTo(map);
      deliveryMarkerRef.current = deliveryMarker;

      // Fit bounds to show both markers
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([delivery.pickup_longitude, delivery.pickup_latitude]);
      bounds.extend([delivery.delivery_longitude, delivery.delivery_latitude]);
      map.fitBounds(bounds, { padding: 50 });
      
      // Add route layer source (will be updated when driver location changes)
      map.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: []
          }
        }
      });

      map.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#3b82f6',
          'line-width': 6,
          'line-opacity': 0.9,
          'line-emissive-strength': 1.2
        }
      });
    });

      setMapInstance(map);
    } catch (error) {
      console.error('Failed to initialize map:', error);
      setError('Failed to load map. Please check your internet connection.');
    }

    return () => {
      if (driverMarkerRef.current) driverMarkerRef.current.remove();
      if (pickupMarkerRef.current) pickupMarkerRef.current.remove();
      if (deliveryMarkerRef.current) deliveryMarkerRef.current.remove();
      if (mapInstance) mapInstance.remove();
    };
  }, [delivery, mapInstance]);

  // Update driver marker and route when location changes
  useEffect(() => {
    if (!mapInstance || !delivery) return;

    // Clear map elements when delivery is completed
    if (delivery.status === 'delivered') {
      // Remove driver marker
      if (driverMarkerRef.current) {
        driverMarkerRef.current.remove();
        driverMarkerRef.current = null;
      }

      // Clear route polyline
      const source = mapInstance.getSource('route') as mapboxgl.GeoJSONSource;
      if (source) {
        source.setData({
          type: 'FeatureCollection',
          features: []
        } as any);
      }

      // Clear ETA and distance
      setEta(null);
      setDistanceToDelivery(null);

      return;
    }

    // Don't update markers if no driver location
    if (!driverLocation) return;

    const lastUpdateSeconds = Math.floor((Date.now() - driverLocation.timestamp) / 1000);
    
    // Create or update driver marker with DriverMarker component
    if (!driverMarkerRef.current) {
      try {
        // Create custom marker element for driver using business logo
        const el = document.createElement('div');
        el.className = 'driver-marker-wrapper';
        
        // Use business logo instead of driver avatar
        const businessLogo = delivery.business_branding?.logo_url || null;
        const businessName = delivery.business_branding?.business_name || 'Driver';
        
        // Render DriverMarker React component
        const root = createRoot(el);
        root.render(
          <DriverMarker
            driverName={businessName}
            avatarUrl={businessLogo}
            heading={driverLocation.heading}
            isOnline={true}
            lastUpdateSeconds={lastUpdateSeconds}
            speed={driverLocation.speed}
          />
        );

        const marker = new mapboxgl.Marker({
          element: el,
          anchor: 'center',
          rotationAlignment: 'map'
        })
          .setLngLat([driverLocation.longitude, driverLocation.latitude]);

        // Safety check: ensure map container still exists before adding marker
        if (mapInstance && mapInstance.getContainer()) {
          marker.addTo(mapInstance);
          driverMarkerRef.current = marker;
        }
      } catch (error) {
        console.error('Error creating driver marker:', error);
      }
    } else {
      // Update existing marker position
      driverMarkerRef.current.setLngLat([driverLocation.longitude, driverLocation.latitude]);
      
      // Re-render DriverMarker component with updated data
      const el = driverMarkerRef.current.getElement();
      const businessLogo = delivery.business_branding?.logo_url || null;
      const businessName = delivery.business_branding?.business_name || 'Driver';
      
      const root = createRoot(el);
      root.render(
        <DriverMarker
          driverName={businessName}
          avatarUrl={businessLogo}
          heading={driverLocation.heading}
          isOnline={true}
          lastUpdateSeconds={lastUpdateSeconds}
          speed={driverLocation.speed}
        />
      );
    }

    // Fetch and update route from driver to delivery
    const updateRoute = async () => {
      // Throttle route updates to every 10 seconds to avoid excessive API calls
      const now = Date.now();
      if (now - lastRouteUpdateRef.current < 10000) {
        return; // Skip update if less than 10 seconds since last update
      }
      lastRouteUpdateRef.current = now;

      try {
        // Determine destination based on delivery status
        // Before pickup: route to pickup address
        // After pickup: route to delivery address
        const isBeforePickup = ['pending', 'driver_assigned', 'going_to_pickup', 'pickup_arrived'].includes(delivery.status);
        const destLng = isBeforePickup ? delivery.pickup_longitude : delivery.delivery_longitude;
        const destLat = isBeforePickup ? delivery.pickup_latitude : delivery.delivery_latitude;

        const url = 'https://api.mapbox.com/directions/v5/mapbox/driving/' + 
          driverLocation.longitude + ',' + driverLocation.latitude + ';' +
          destLng + ',' + destLat +
          '?geometries=geojson&access_token=' + mapboxgl.accessToken;
        const response = await fetch(url);
        const data = await response.json();

        if (data.routes && data.routes[0]) {
          const route = data.routes[0];
          const routeGeoJSON = {
            type: 'Feature',
            properties: {},
            geometry: route.geometry
          };

          // Update route layer
          const source = mapInstance.getSource('route') as mapboxgl.GeoJSONSource;
          if (source) {
            source.setData(routeGeoJSON as any);
          }

          // Update ETA and distance
          setEta(Math.ceil(route.duration / 60)); // Convert seconds to minutes
          setDistanceToDelivery(parseFloat((route.distance / 1000).toFixed(1))); // Convert meters to km
        }
      } catch (error) {
        console.error('Error fetching route:', error);
      }
    };

    updateRoute();
  }, [driverLocation, mapInstance, delivery]);

  const getStatusIndex = (status: string): number => {
    return STATUS_STEPS.findIndex((step) => step.key === status);
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      driver_assigned: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      pickup_arrived: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      package_collected: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
      in_transit: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
      delivered: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      failed: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    };

    const labels: Record<string, string> = {
      pending: 'Pending',
      driver_assigned: 'Driver Assigned',
      pickup_arrived: 'Arriving at Pickup',
      package_collected: 'Package Collected',
      in_transit: 'In Transit',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
      failed: 'Failed',
    };

    return (
      <Badge className={colors[status] || colors.pending}>
        {labels[status] || status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading tracking information...</p>
        </div>
      </div>
    );
  }

  if (error || !delivery) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Tracking Not Found</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {error || 'We could not find a delivery with this tracking number.'}
              </p>
              <p className="text-sm text-gray-500">Tracking Number: {trackingNumber}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Block access to completed/cancelled deliveries
  if (delivery.status === 'delivered' || delivery.status === 'cancelled') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <CheckCircle2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Tracking Expired</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                This delivery has been completed and tracking is no longer available.
              </p>
              <p className="text-sm text-gray-500">Tracking Number: {trackingNumber}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentStatusIndex = getStatusIndex(delivery.status);
  const primaryColor = delivery.business_branding?.primary_color || '#3b82f6';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header with Business Branding */}
      <div className="bg-white dark:bg-gray-800 border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {delivery.business_branding?.logo_url ? (
                <img
                  src={delivery.business_branding.logo_url}
                  alt={delivery.business_branding.business_name}
                  className="h-10 w-auto"
                />
              ) : (
                <Package className="h-10 w-10" style={{ color: primaryColor }} />
              )}
              <div>
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {delivery.business_branding?.business_name || 'SwiftDash'}
                </h1>
                <p className="text-sm text-gray-500">Track Your Delivery</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Tracking Number</p>
              <p className="font-mono font-semibold text-sm">{trackingNumber}</p>
              {delivery.stop_info && (
                <p className="text-xs text-gray-500 mt-1">
                  🔒 Stop {delivery.stop_info.stop_number} (Private)
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Map Dominant Layout */}
      <div className="h-[calc(100vh-88px)] flex flex-col lg:flex-row">
        {/* Map Section - Takes full height on mobile, 2/3 on desktop */}
        <div className="h-1/2 lg:h-full lg:w-2/3 relative">
          <div ref={mapContainer} className="w-full h-full" />
          
          {/* Floating Status Badge */}
          <div className="absolute top-4 left-4 z-10">
            {getStatusBadge(delivery.status)}
          </div>

          {/* Floating ETA Card */}
          {driverLocation && driverConnected && shouldTrackDriver && eta && (
            <Card className="absolute bottom-4 left-4 right-4 lg:right-auto lg:w-80 shadow-lg border-blue-500 bg-white/95 dark:bg-gray-800/95 backdrop-blur">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    <Truck className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-gray-900 dark:text-white">Driver is on the way</p>
                    <div className="flex items-center gap-4 mt-1">
                      {eta && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-blue-600" />
                          <span className="text-xs font-medium text-blue-600">{eta} min</span>
                        </div>
                      )}
                      {distanceToDelivery && (
                        <div className="flex items-center gap-1">
                          <Navigation className="h-3 w-3 text-gray-600" />
                          <span className="text-xs text-gray-600">{distanceToDelivery} km</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Info Sidebar - Scrollable on mobile, fixed height on desktop */}
        <div className="h-1/2 lg:h-full lg:w-1/3 overflow-y-auto bg-white dark:bg-gray-800 border-t lg:border-t-0 lg:border-l">
          <div className="p-4 space-y-4">
            {/* Status Timeline */}
            <div>
              <h3 className="font-semibold text-lg mb-4">Delivery Status</h3>
              <div className="relative">
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
                <div className="space-y-6">
                  {STATUS_STEPS.map((step, index) => {
                    const isCompleted = index <= currentStatusIndex;
                    const isCurrent = index === currentStatusIndex;
                    const Icon = step.icon;

                    return (
                      <div key={step.key} className="relative flex items-start gap-4">
                        <div
                          className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 ${
                            isCompleted
                              ? 'border-transparent'
                              : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
                          }`}
                          style={
                            isCompleted
                              ? { backgroundColor: primaryColor }
                              : {}
                          }
                        >
                          <Icon
                            className={`h-5 w-5 ${
                              isCompleted ? 'text-white' : 'text-gray-400'
                            }`}
                          />
                        </div>
                        <div className="flex-1 pt-2">
                          <p
                            className={`text-sm font-medium ${
                              isCurrent
                                ? 'text-gray-900 dark:text-white'
                                : isCompleted
                                ? 'text-gray-600 dark:text-gray-400'
                                : 'text-gray-400 dark:text-gray-600'
                            }`}
                          >
                            {step.label}
                          </p>
                          {isCurrent && (
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(delivery.updated_at).toLocaleTimeString()}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <Separator />

            {/* Driver Info */}
            {driverInfo && (
              <>
                <div>
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    Your Driver
                  </h3>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
                      {driverInfo.name?.charAt(0) || 'D'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{driverInfo.name || 'Driver'}</p>
                      {driverInfo.phone && (
                        <p className="text-xs text-muted-foreground">{driverInfo.phone}</p>
                      )}
                    </div>
                    {driverInfo.phone && (
                      <a
                        href={`tel:${driverInfo.phone}`}
                        className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs"
                      >
                        <Phone className="h-3 w-3" />
                        Call
                      </a>
                    )}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Addresses */}
            <div className="space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="h-4 w-4 text-green-600" />
                  <h4 className="text-xs font-semibold text-gray-500">Pickup</h4>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 ml-6">
                  {delivery.pickup_address}
                </p>
              </div>
              
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Navigation className="h-4 w-4 text-red-600" />
                  <h4 className="text-xs font-semibold text-gray-500">
                    Delivery {delivery.stop_info && `(Stop ${delivery.stop_info.stop_number})`}
                  </h4>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 ml-6">
                  {delivery.delivery_address}
                </p>
                {delivery.stop_info?.recipient_name && (
                  <p className="text-xs text-gray-500 ml-6 mt-1">
                    For: {delivery.stop_info.recipient_name}
                  </p>
                )}
              </div>
            </div>

            <Separator />

            {/* Package Details */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Package className="h-4 w-4" />
                <h4 className="text-xs font-semibold text-gray-500">Package Details</h4>
              </div>
              <div className="space-y-1 ml-6">
                <p className="text-sm text-gray-700 dark:text-gray-300">{delivery.package_description}</p>
                {delivery.package_weight && (
                  <p className="text-xs text-gray-500">Weight: {delivery.package_weight} kg</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
