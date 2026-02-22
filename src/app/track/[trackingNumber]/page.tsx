'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { useParams, useSearchParams } from 'next/navigation';
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
  Share2,
  Copy,
  Check,
  MessageCircle,
  HeadphonesIcon,
  Mail,
  MessageSquare,
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
    accent_color?: string;
    header_bg_color?: string;
    page_bg_color?: string;
    support_phone?: string;
    support_email?: string;
    whatsapp_number?: string;
    custom_message?: string;
    tagline?: string;
    footer_message?: string;
    in_transit_message?: string;
    delivered_message?: string;
    map_style?: string;
    show_driver_phone?: boolean;
    show_pickup_address?: boolean;
    logo_size?: 'sm' | 'md' | 'lg' | 'xl';
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
  { key: 'package_collected', label: 'Package Collected', icon: Package },
  { key: 'in_transit', label: 'On the Way', icon: Navigation },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
];

// Simplified timeline for stop-specific tracking links
const STOP_STATUS_STEPS: StatusStep[] = [
  { key: 'pending', label: 'Awaiting Driver', icon: Circle },
  { key: 'in_transit', label: 'Driver En Route', icon: Navigation },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
];

export default function TrackingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
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
  const [copied, setCopied] = useState(false);

  // Dynamic page title based on business branding
  useEffect(() => {
    if (delivery?.business_branding?.business_name) {
      document.title = `Your Order | ${delivery.business_branding.business_name}`;
    } else {
      document.title = `Track ${trackingNumber} | SwiftDash`;
    }
    return () => { document.title = 'SwiftDash Deliveries'; };
  }, [delivery?.business_branding?.business_name, trackingNumber]);

  const handleShare = async () => {
    const url = window.location.href;
    const businessName = delivery?.business_branding?.business_name || 'SwiftDash';
    const statusLabel: Record<string, string> = {
      pending: 'Pending pickup',
      driver_assigned: 'Driver assigned',
      pickup_arrived: 'Driver at pickup',
      package_collected: 'Package collected',
      in_transit: 'On the way',
      delivered: 'Delivered',
    };
    const statusText = statusLabel[delivery?.status || ''] || 'In progress';
    const shareText = `Track my ${businessName} delivery (${trackingNumber}) — ${statusText}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Track your ${businessName} delivery`,
          text: shareText,
          url,
        });
      } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
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

        // Handle preview mode — load the signed-in business's own branding settings
        // with a fake delivery so the settings page preview works
        if (trackingNumber === 'SD-PREVIEW-DEMO') {
          const bizId = searchParams?.get('bizId');
          let brandingSettings = null;

          if (bizId) {
            const { data: bizData } = await supabase
              .from('business_accounts')
              .select('business_name, business_phone, settings')
              .eq('id', bizId)
              .single();

            if (bizData) {
              brandingSettings = {
                business_name: bizData.business_name,
                logo_url: bizData.settings?.logo_url,
                primary_color: bizData.settings?.primary_color || '#3b82f6',
                accent_color: bizData.settings?.accent_color,
                header_bg_color: bizData.settings?.header_bg_color,
                page_bg_color: bizData.settings?.page_bg_color,
                support_phone: bizData.business_phone,
                support_email: bizData.settings?.support_email,
                whatsapp_number: bizData.settings?.whatsapp_number,
                custom_message: bizData.settings?.custom_message,
                tagline: bizData.settings?.tagline,
                footer_message: bizData.settings?.footer_message,
                in_transit_message: bizData.settings?.in_transit_message,
                delivered_message: bizData.settings?.delivered_message,
                map_style: bizData.settings?.map_style,
                show_driver_phone: bizData.settings?.show_driver_phone !== false,
                show_pickup_address: bizData.settings?.show_pickup_address !== false,
                logo_size: bizData.settings?.logo_size,
              };
            }
          }

          setDriverInfo({ name: 'Alex', phone: '+639171234567' });
          setDelivery({
            id: 'preview',
            tracking_number: 'SD-PREVIEW-DEMO',
            status: 'in_transit',
            pickup_address: '123 Pickup Street, Makati City',
            pickup_latitude: 14.5547,
            pickup_longitude: 121.0244,
            delivery_address: '456 Delivery Avenue, BGC, Taguig',
            delivery_latitude: 14.5461,
            delivery_longitude: 121.0513,
            package_description: 'Sample Package — Electronics',
            package_weight: 1.5,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            completed_at: null,
            estimated_duration: 30,
            distance_km: 4.2,
            customer_rating: null,
            business_branding: brandingSettings || {
              business_name: 'Your Business',
              primary_color: '#3b82f6',
              show_driver_phone: true,
              show_pickup_address: true,
            },
          });
          setLoading(false);
          return;
        }

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
            accent_color: businessData.settings?.accent_color,
            header_bg_color: businessData.settings?.header_bg_color,
            page_bg_color: businessData.settings?.page_bg_color,
            support_phone: businessData.business_phone,
            support_email: businessData.settings?.support_email,
            whatsapp_number: businessData.settings?.whatsapp_number,
            custom_message: businessData.settings?.custom_message,
            tagline: businessData.settings?.tagline,
            footer_message: businessData.settings?.footer_message,
            in_transit_message: businessData.settings?.in_transit_message,
            delivered_message: businessData.settings?.delivered_message,
            map_style: businessData.settings?.map_style,
            show_driver_phone: businessData.settings?.show_driver_phone !== false,
            show_pickup_address: businessData.settings?.show_pickup_address !== false,
            logo_size: businessData.settings?.logo_size,
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

    console.log('🗺️ Initializing Mapbox map...');
    console.log('📍 Mapbox token:', mapboxgl.accessToken ? 'Set ✓' : 'Missing ✗');
    console.log('📍 Container dimensions:', {
      width: mapContainer.current.offsetWidth,
      height: mapContainer.current.offsetHeight,
    });
    console.log('📍 Delivery coordinates:', {
      pickup: [delivery.pickup_longitude, delivery.pickup_latitude],
      delivery: [delivery.delivery_longitude, delivery.delivery_latitude]
    });

    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      try {
        const MAP_STYLES: Record<string, string> = {
          streets: 'mapbox://styles/mapbox/streets-v12',
          light: 'mapbox://styles/mapbox/light-v11',
          dark: 'mapbox://styles/mapbox/dark-v11',
          satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
          outdoors: 'mapbox://styles/mapbox/outdoors-v12',
        };
        const mapStyleUrl = MAP_STYLES[delivery.business_branding?.map_style || 'streets'] || MAP_STYLES.streets;
        const map = new mapboxgl.Map({
          container: mapContainer.current!,
          style: mapStyleUrl,
          center: [delivery.pickup_longitude, delivery.pickup_latitude],
          zoom: 12,
        });

        map.on('error', (e) => {
          console.error('❌ Mapbox error:', e);
          setError('Failed to load map. Please refresh the page.');
        });

        map.on('load', () => {
          console.log('✅ Mapbox map loaded successfully');
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
        console.error('❌ Failed to initialize map:', error);
        setError('Failed to load map. Please check your internet connection.');
      }
    }, 100); // Small delay to ensure DOM is ready

    return () => {
      clearTimeout(timer);
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
      in_transit: 'On the Way',
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
  const accentColor = delivery.business_branding?.accent_color || primaryColor;
  const headerBg = delivery.business_branding?.header_bg_color || primaryColor;
  const pageBg = delivery.business_branding?.page_bg_color || undefined;

  // Determine if header is dark enough to need white text
  const isHeaderDark = (hex: string) => {
    const c = hex.replace('#', '');
    const r = parseInt(c.slice(0,2),16);
    const g = parseInt(c.slice(2,4),16);
    const b = parseInt(c.slice(4,6),16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  };
  const headerTextColor = isHeaderDark(headerBg) ? 'white' : '#1f2937';
  const headerSubColor = isHeaderDark(headerBg) ? 'rgba(255,255,255,0.7)' : 'rgba(31,41,55,0.6)';

  return (
    <div className="min-h-screen" style={pageBg ? { backgroundColor: pageBg } : { backgroundColor: '#f9fafb' }}>
      {/* Header with Business Branding */}
      <div className="shadow-sm" style={{ backgroundColor: headerBg }}>
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {delivery.business_branding?.logo_url ? (
                <div className="flex-shrink-0 bg-white rounded-lg p-1 shadow-sm">
                  <img
                    src={delivery.business_branding.logo_url}
                    alt={delivery.business_branding.business_name}
                    className={`w-auto object-contain block ${
                      delivery.business_branding.logo_size === 'sm' ? 'h-6 max-w-[80px]' :
                      delivery.business_branding.logo_size === 'lg' ? 'h-12 max-w-[160px]' :
                      delivery.business_branding.logo_size === 'xl' ? 'h-16 max-w-[200px]' :
                      'h-8 max-w-[120px]' // md (default)
                    }`}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              ) : (
                <div
                  className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl"
                  style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
                >
                  <Package className="h-5 w-5" style={{ color: headerTextColor }} />
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-lg font-bold truncate" style={{ color: headerTextColor }}>
                  {delivery.business_branding?.business_name || 'SwiftDash'}
                </h1>
                <p className="text-xs truncate" style={{ color: headerSubColor }}>
                  {delivery.business_branding?.tagline || 'Track Your Delivery'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="text-right">
                <p className="text-xs" style={{ color: headerSubColor }}>Tracking</p>
                <p className="font-mono font-semibold text-xs" style={{ color: headerTextColor }}>{trackingNumber}</p>
                {delivery.stop_info && (
                  <p className="text-xs mt-0.5" style={{ color: headerSubColor }}>
                    Stop {delivery.stop_info.stop_number}
                  </p>
                )}
              </div>
              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 px-3 rounded-lg text-xs font-medium transition-all active:scale-95"
                style={{
                  minHeight: '44px',
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  color: headerTextColor,
                  border: `1px solid rgba(255,255,255,0.3)`,
                }}
              >
                {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                <span>{copied ? 'Copied!' : 'Share'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Custom business message banner */}
      {delivery.business_branding?.custom_message && (
        <div
          className="px-4 py-3 flex items-center gap-2 text-sm"
          style={{
            backgroundColor: `${primaryColor}15`,
            borderBottom: `1px solid ${primaryColor}30`,
            color: primaryColor,
          }}
        >
          <MessageCircle className="h-4 w-4 flex-shrink-0" />
          <span>{delivery.business_branding.custom_message}</span>
        </div>
      )}

      {/* Main Content - Map Dominant Layout */}
      <div className="flex flex-col lg:flex-row lg:h-[calc(100vh-88px)]">
        {/* Map Section - fixed 45vh on mobile, full height on desktop */}
        <div className="flex-shrink-0 h-[45vh] lg:h-full lg:w-2/3 relative bg-gray-100">
          <div 
            ref={mapContainer} 
            className="w-full h-full"
          />
          
          {/* Floating Status Badge - desktop only, mobile uses sticky strip below */}
          <div className="hidden lg:block absolute top-4 left-4 z-10">
            {getStatusBadge(delivery.status)}
          </div>

          {/* ETA pill on desktop only — on mobile it appears in the info panel */}
          {driverLocation && driverConnected && shouldTrackDriver && eta && (
            <Card className="hidden lg:block absolute bottom-4 left-4 w-80 shadow-lg border-blue-500 bg-white/95 dark:bg-gray-800/95 backdrop-blur">
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

        {/* Info Panel - scrollable on mobile, fixed height sidebar on desktop */}
        <div className="min-h-[55vh] lg:min-h-0 lg:h-full lg:w-1/3 overflow-y-auto bg-white dark:bg-gray-800 border-t lg:border-t-0 lg:border-l">
          {/* Mobile drag handle */}
          <div className="flex justify-center pt-2 pb-1 lg:hidden">
            <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
          </div>

          {/* Mobile sticky status + ETA strip */}
          <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-4 py-2 flex items-center justify-between lg:hidden">
            <div className="flex items-center gap-2">
              {getStatusBadge(delivery.status)}
            </div>
            {driverLocation && driverConnected && shouldTrackDriver && eta && (
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1 text-blue-600 font-semibold">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{eta} min ETA</span>
                </div>
                {distanceToDelivery && (
                  <div className="flex items-center gap-1 text-gray-500">
                    <Navigation className="h-3 w-3" />
                    <span>{distanceToDelivery} km</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-4 space-y-4">
            {/* Status Timeline */}
            <div>
              <h3 className="font-semibold text-lg mb-4">Delivery Status</h3>
              {(() => {
                const isStopView = !!delivery.stop_info;
                const steps = isStopView ? STOP_STATUS_STEPS : STATUS_STEPS;
                // For stop view: map delivered→2, in_transit→1, anything else→0
                const stopIndex = delivery.status === 'delivered' ? 2
                  : delivery.status === 'in_transit' ? 1
                  : 0;
                const activeIndex = isStopView ? stopIndex : currentStatusIndex;
                return (
                  <div className="relative">
                    <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
                    <div className="space-y-6">
                      {steps.map((step, index) => {
                        const isCompleted = index <= activeIndex;
                        const isCurrent = index === activeIndex;
                        const Icon = step.icon;
                        // Multi-stop: show extra hint when pending but overall delivery is active
                        const showWaitingHint = isStopView && step.key === 'pending' && isCurrent
                          && ['driver_assigned', 'pickup_arrived', 'package_collected', 'in_transit'].includes(
                            // We need the raw parent status — use isCurrent on pending step as proxy
                            delivery.status === 'in_transit' ? 'in_transit' : ''
                          );

                        return (
                          <div key={step.key} className="relative flex items-start gap-4">
                            <div
                              className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 ${
                                isCompleted
                                  ? 'border-transparent'
                                  : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
                              }`}
                              style={isCompleted ? { backgroundColor: primaryColor } : {}}
                            >
                              <Icon className={`h-5 w-5 ${isCompleted ? 'text-white' : 'text-gray-400'}`} />
                            </div>
                            <div className="flex-1 pt-2">
                              <p className={`text-sm font-medium ${
                                isCurrent ? 'text-gray-900 dark:text-white'
                                  : isCompleted ? 'text-gray-600 dark:text-gray-400'
                                  : 'text-gray-400 dark:text-gray-600'
                              }`}>
                                {step.label}
                              </p>
                              {isCurrent && (
                                <p className="text-xs text-gray-500 mt-1">
                                  {showWaitingHint
                                    ? 'Driver is completing another stop'
                                    : new Date(delivery.updated_at).toLocaleTimeString()
                                  }
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            <Separator />

            {/* Status-specific message */}
            {(delivery.status === 'in_transit' || delivery.status === 'package_collected') && delivery.business_branding?.in_transit_message && (
              <div
                className="flex items-start gap-2 p-3 rounded-xl text-sm"
                style={{ backgroundColor: `${accentColor}10`, color: accentColor, border: `1px solid ${accentColor}20` }}
              >
                <Truck className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{delivery.business_branding.in_transit_message}</span>
              </div>
            )}
            {delivery.status === 'delivered' && delivery.business_branding?.delivered_message && (
              <div
                className="flex items-start gap-2 p-3 rounded-xl text-sm"
                style={{ backgroundColor: '#16a34a15', color: '#16a34a', border: '1px solid #16a34a20' }}
              >
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{delivery.business_branding.delivered_message}</span>
              </div>
            )}

            {/* Driver Info */}
            {driverInfo && (
              <>
                <div>
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    Your Driver
                  </h3>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
                      style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}99)` }}
                    >
                      {driverInfo.name?.charAt(0) || 'D'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{driverInfo.name || 'Driver'}</p>
                      {driverInfo.phone && delivery.business_branding?.show_driver_phone !== false && (
                        <p className="text-xs text-muted-foreground">{driverInfo.phone}</p>
                      )}
                    </div>
                    {driverInfo.phone && delivery.business_branding?.show_driver_phone !== false && (
                      <a
                        href={`tel:${driverInfo.phone}`}
                        className="flex-shrink-0 inline-flex items-center justify-center gap-1.5 px-4 rounded-lg transition-all active:scale-95 text-xs font-medium text-white"
                        style={{ backgroundColor: accentColor, minHeight: '44px' }}
                      >
                        <Phone className="h-3.5 w-3.5" />
                        Call Driver
                      </a>
                    )}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Support Contact */}
            {(delivery.business_branding?.support_phone || delivery.business_branding?.support_email || delivery.business_branding?.whatsapp_number) && (
              <>
                <div>
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <HeadphonesIcon className="h-4 w-4" />
                    Need Help?
                  </h3>
                  <div
                    className="p-3 rounded-xl space-y-2"
                    style={{ backgroundColor: `${accentColor}10`, border: `1px solid ${accentColor}25` }}
                  >
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Customer Support</p>
                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                      {delivery.business_branding?.support_phone && (
                        <a
                          href={`tel:${delivery.business_branding.support_phone}`}
                          className="inline-flex items-center justify-center gap-1.5 px-3 rounded-lg text-xs font-medium text-white transition-all active:scale-95"
                          style={{ backgroundColor: accentColor, minHeight: '44px' }}
                        >
                          <Phone className="h-3.5 w-3.5" />
                          Call Support
                        </a>
                      )}
                      {delivery.business_branding?.whatsapp_number && (
                        <a
                          href={`https://wa.me/${delivery.business_branding.whatsapp_number.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1.5 px-3 rounded-lg text-xs font-medium text-white transition-all active:scale-95"
                          style={{ backgroundColor: '#25d366', minHeight: '44px' }}
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          WhatsApp
                        </a>
                      )}
                      {delivery.business_branding?.support_email && (
                        <a
                          href={`mailto:${delivery.business_branding.support_email}`}
                          className="inline-flex items-center justify-center gap-1.5 px-3 rounded-lg text-xs font-medium transition-all active:scale-95"
                          style={{ backgroundColor: `${accentColor}15`, color: accentColor, border: `1px solid ${accentColor}30`, minHeight: '44px' }}
                        >
                          <Mail className="h-3.5 w-3.5" />
                          Email
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Addresses */}
            <div className="space-y-3">
              {delivery.business_branding?.show_pickup_address !== false && (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="h-4 w-4 text-green-600" />
                  <h4 className="text-xs font-semibold text-gray-500">Pickup</h4>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 ml-6">
                  {delivery.pickup_address}
                </p>
              </div>
              )}
              
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Navigation className="h-4 w-4 text-red-600" />
                    <h4 className="text-xs font-semibold text-gray-500">
                      Delivery {delivery.stop_info && `(Stop ${delivery.stop_info.stop_number})`}
                    </h4>
                  </div>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(delivery.delivery_address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md active:scale-95 transition-all"
                    style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
                  >
                    <Navigation className="h-3 w-3" />
                    Maps
                  </a>
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

            {/* Footer message */}
            {delivery.business_branding?.footer_message && (
              <>
                <Separator />
                <p className="text-xs text-center text-muted-foreground pb-2">
                  {delivery.business_branding.footer_message}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
