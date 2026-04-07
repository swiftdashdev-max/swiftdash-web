'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { bookDeliveryStorefront } from '@/lib/supabase/edge-functions';
import { GooglePlacesAutocomplete } from '@/components/google-places-autocomplete';
import { GoogleMapsLoader } from '@/components/google-maps-loader';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Package,
  MapPin,
  Plus,
  X,
  Truck,
  User,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Calendar,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Clock,
  Zap,
  Phone,
  Star,
  Shield,
  Navigation,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

// ── Types ─────────────────────────────────────────────────────────────────────
interface BusinessInfo {
  id: string;
  business_name: string;
  business_phone: string | null;
  business_email: string | null;
  settings: {
    logo_url?: string;
    primary_color?: string;
  };
  storefront_settings: {
    hero_text?: string;
    description?: string;
    accepted_vehicles?: string[];
    payment_methods?: string[];
    max_stops?: number;
    show_price_estimate?: boolean;
    banner_image_url?: string;
    accent_color?: string;
    tagline_badges?: string[];
    operating_hours_text?: string;
    booking_note?: string;
  };
}

interface VehicleType {
  id: string;
  name: string;
  display_name?: string | null;
  description: string | null;
  base_price: number;
  price_per_km: number;
  max_weight_kg: number;
  icon_url: string | null;
  image_url?: string | null;
  additional_stop_charge: number;
}

interface DropoffStop {
  id: string;
  address: string;
  lat?: number;
  lng?: number;
  contactName: string;
  contactPhone: string;
  instructions: string;
}

// ── Vehicle icon mapping ───────────────────────────────────────────────────────
function getVehicleEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('motorcycle') || n.includes('bike')) return '🏍️';
  if (n.includes('sedan')) return '🚗';
  if (n.includes('suv') || n.includes('crossover')) return '🚙';
  if (n.includes('van') || n.includes('7-seater')) return '🚐';
  if (n.includes('pickup')) return '🛻';
  if (n.includes('light truck') || n.includes('fb')) return '🚚';
  if (n.includes('medium truck')) return '🚛';
  if (n.includes('large truck') || n.includes('wing')) return '🚜';
  return '🚗';
}

// ── Step definitions ───────────────────────────────────────────────────────────
const STEPS = ['Route', 'Package', 'Vehicle', 'You', 'Review'];

// ── Main Component ─────────────────────────────────────────────────────────────
export default function StorefrontBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const [slug, setSlug] = useState<string>('');
  const supabase = createClient();

  const [business, setBusiness] = useState<BusinessInfo | null>(null);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState(0);

  const [deliveryType, setDeliveryType] = useState<'single' | 'multi'>('single');
  const [pickup, setPickup] = useState({ address: '', lat: 0, lng: 0, contactName: '', contactPhone: '', instructions: '' });
  const [dropoffs, setDropoffs] = useState<DropoffStop[]>([
    { id: '1', address: '', lat: 0, lng: 0, contactName: '', contactPhone: '', instructions: '' },
  ]);

  const [packageDesc, setPackageDesc] = useState('');
  const [packageWeight, setPackageWeight] = useState<number>(0);
  const [packageValue, setPackageValue] = useState<number>(0);

  const [selectedVehicle, setSelectedVehicle] = useState<string>('');

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  const [routeDistance, setRouteDistance] = useState(0);
  const [routeDuration, setRouteDuration] = useState(0);
  const [routeLoading, setRouteLoading] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [stepErrors, setStepErrors] = useState<string[]>([]);

  useEffect(() => {
    params.then((p) => setSlug(p.slug));
  }, [params]);

  useEffect(() => {
    if (!slug) return;
    async function fetchBusiness() {
      setLoading(true);
      try {
        const { data: biz, error: bizErr } = await supabase
          .from('business_accounts')
          .select('id, business_name, business_phone, business_email, settings, storefront_settings')
          .eq('slug', slug)
          .eq('storefront_enabled', true)
          .single();

        if (bizErr || !biz) { setError('This storefront is not available.'); setLoading(false); return; }
        setBusiness(biz as BusinessInfo);

        // Try business-specific vehicle pricing first (partner fleet)
        const { data: bizVehicles } = await supabase
          .from('business_vehicle_pricing')
          .select('*, vehicle_types!inner(id, name, description, max_weight_kg, icon_url, is_active)')
          .eq('business_id', biz.id)
          .eq('is_enabled', true)
          .order('sort_order');

        if (bizVehicles?.length) {
          // Partner has configured their own fleet vehicles & pricing
          const mapped: VehicleType[] = bizVehicles.map((bv: any) => ({
            id: bv.vehicle_type_id,
            name: bv.vehicle_types.name,
            display_name: bv.display_name,
            description: bv.description || bv.vehicle_types.description,
            base_price: Number(bv.base_price),
            price_per_km: Number(bv.price_per_km),
            max_weight_kg: Number(bv.max_weight_kg ?? bv.vehicle_types.max_weight_kg),
            icon_url: bv.vehicle_types.icon_url,
            image_url: bv.image_url,
            additional_stop_charge: Number(bv.additional_stop_charge),
          }));
          setVehicleTypes(mapped);
          if (mapped.length > 0) setSelectedVehicle(mapped[0].id);
        } else {
          // Fallback: check business_fleet for vehicle types the partner actually has
          const { data: fleetVehicleTypeIds } = await supabase
            .from('business_fleet')
            .select('vehicle_type_id')
            .eq('business_id', biz.id);

          const { data: vehicles } = await supabase
            .from('vehicle_types').select('*').eq('is_active', true).order('base_price');

          if (vehicles?.length) {
            const accepted = (biz as BusinessInfo).storefront_settings?.accepted_vehicles;
            // Filter by fleet vehicle types if partner has registered fleet
            const fleetTypeIds = fleetVehicleTypeIds?.length
              ? [...new Set(fleetVehicleTypeIds.map((f: any) => f.vehicle_type_id))]
              : null;
            let filtered = vehicles;
            if (accepted?.length) {
              filtered = vehicles.filter((v: VehicleType) => accepted.includes(v.id));
            } else if (fleetTypeIds?.length) {
              filtered = vehicles.filter((v: VehicleType) => fleetTypeIds.includes(v.id));
            }
            setVehicleTypes(filtered as VehicleType[]);
            if (filtered.length > 0) setSelectedVehicle(filtered[0].id);
          }
        }
      } catch { setError('Something went wrong loading this page.'); }
      setLoading(false);
    }
    fetchBusiness();
  }, [slug]);

  useEffect(() => {
    if (step !== 4 || !mapContainerRef.current) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!token || mapRef.current) return;

    import('mapbox-gl').then((mapboxgl) => {
      mapboxgl.default.accessToken = token;
      const map = new mapboxgl.default.Map({
        container: mapContainerRef.current!,
        style: 'mapbox://styles/mapbox/light-v11',
        zoom: 11,
        center: pickup.lng && pickup.lat ? [pickup.lng, pickup.lat] : [121.0244, 14.5547],
        attributionControl: false,
      });
      mapRef.current = map;

      map.on('load', () => {
        const allPoints = [
          [pickup.lng, pickup.lat],
          ...dropoffs.filter(d => d.lat && d.lng).map(d => [d.lng, d.lat]),
        ].filter(p => p[0] && p[1]);

        const bc = business?.settings?.primary_color || '#3b82f6';
        const markerColors = [bc, '#ef4444'];

        // Build labeled markers
        const labels = ['Pickup', ...dropoffs.filter(d => d.lat && d.lng).map((d, i) => d.address?.split(',')[0]?.slice(0, 18) || `Stop ${i + 1}`)];
        allPoints.forEach((pt, i) => {
          const isPickup = i === 0;
          const color = isPickup ? bc : '#ef4444';

          const wrapper = document.createElement('div');
          wrapper.style.cssText = 'display:flex;flex-direction:column;align-items:center;pointer-events:none;';

          // Label badge
          const label = document.createElement('div');
          label.style.cssText = `background:white;color:#1f2937;font-size:11px;font-weight:600;padding:2px 8px;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,0.15);margin-bottom:4px;white-space:nowrap;max-width:140px;overflow:hidden;text-overflow:ellipsis;border:1.5px solid ${color};`;
          label.textContent = labels[i] || (isPickup ? 'Pickup' : `Stop ${i}`);
          wrapper.appendChild(label);

          // Pin
          const pin = document.createElement('div');
          pin.style.cssText = `width:36px;height:36px;border-radius:50% 50% 50% 0;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;font-size:14px;font-weight:700;transform:rotate(-45deg);`;
          const inner = document.createElement('span');
          inner.style.cssText = 'transform:rotate(45deg);display:block;line-height:1;';
          inner.textContent = isPickup ? 'P' : String(i);
          pin.appendChild(inner);
          wrapper.appendChild(pin);

          new mapboxgl.default.Marker({ element: wrapper, anchor: 'bottom' }).setLngLat(pt as [number, number]).addTo(map);
        });

        if (allPoints.length >= 2) {
          const coords = allPoints.map(p => p.join(',')).join(';');
          fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&access_token=${token}`)
            .then(r => r.json())
            .then(data => {
              if (data.routes?.[0]) {
                // Route outline (wider, white) for visibility
                map.addSource('route', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: data.routes[0].geometry } });
                map.addLayer({ id: 'route-outline', type: 'line', source: 'route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 8, 'line-opacity': 0.8 } });
                map.addLayer({ id: 'route', type: 'line', source: 'route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': bc, 'line-width': 5, 'line-opacity': 0.9 } });
                const coords2 = data.routes[0].geometry.coordinates;
                const bounds = coords2.reduce((b: any, c: any) => b.extend(c), new mapboxgl.default.LngLatBounds(coords2[0], coords2[0]));
                map.fitBounds(bounds, { padding: { top: 60, bottom: 40, left: 50, right: 50 } });
              }
            }).catch(() => {});
        } else if (allPoints.length === 1) {
          map.setCenter(allPoints[0] as [number, number]);
          map.setZoom(14);
        }
      });
    }).catch(() => {});
  }, [step]);

  useEffect(() => {
    if (!pickup.lat || !pickup.lng) return;
    const valid = dropoffs.filter(d => d.lat && d.lng);
    if (!valid.length) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!token) return;
    setRouteLoading(true);
    const coords = [`${pickup.lng},${pickup.lat}`, ...valid.map(d => `${d.lng},${d.lat}`)].join(';');
    fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?overview=false&access_token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.routes?.[0]) {
          setRouteDistance(data.routes[0].distance / 1000);
          setRouteDuration(data.routes[0].duration);
        }
      })
      .catch(() => {})
      .finally(() => setRouteLoading(false));
  }, [pickup.lat, pickup.lng, dropoffs]);

  const brandColor = business?.settings?.primary_color || '#3b82f6';
  const accentColor = business?.storefront_settings?.accent_color || brandColor;

  const selectedVehicleData = useMemo(() => vehicleTypes.find(v => v.id === selectedVehicle), [vehicleTypes, selectedVehicle]);

  const estimatedPrice = useMemo(() => {
    if (!selectedVehicleData || !routeDistance) return null;
    const base = Number(selectedVehicleData.base_price);
    const perKm = Number(selectedVehicleData.price_per_km);
    const stopCharge = Number(selectedVehicleData.additional_stop_charge || 0);
    const extraStops = deliveryType === 'multi' ? Math.max(0, dropoffs.length - 1) : 0;
    const subtotal = base + perKm * routeDistance + stopCharge * extraStops;
    return subtotal * 1.12;
  }, [selectedVehicleData, routeDistance, dropoffs.length, deliveryType]);

  const addDropoff = () => {
    const max = business?.storefront_settings?.max_stops || 10;
    if (dropoffs.length >= max) return;
    setDropoffs([...dropoffs, { id: Date.now().toString(), address: '', lat: 0, lng: 0, contactName: '', contactPhone: '', instructions: '' }]);
  };

  const removeDropoff = (id: string) => {
    if (dropoffs.length <= 1) return;
    setDropoffs(dropoffs.filter(d => d.id !== id));
  };

  const updateDropoff = (id: string, field: keyof DropoffStop, value: string | number) => {
    setDropoffs(dropoffs.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  const validateStep = (s: number): string[] => {
    const errors: string[] = [];
    if (s === 0) {
      if (!pickup.address || !pickup.lat) errors.push('Select a pickup address from the dropdown.');
      if (!pickup.contactName) errors.push('Pickup contact name is required.');
      if (!pickup.contactPhone) errors.push('Pickup contact phone is required.');
      const valid = dropoffs.filter(d => d.address && d.lat);
      if (!valid.length) errors.push('Select at least one delivery address from the dropdown.');
      valid.forEach((d, i) => {
        if (!d.contactName) errors.push(`Stop ${i + 1}: Contact name required.`);
        if (!d.contactPhone) errors.push(`Stop ${i + 1}: Phone number required.`);
      });
    }
    if (s === 2) {
      if (!selectedVehicle) errors.push('Please select a vehicle type.');
    }
    if (s === 3) {
      if (!customerName) errors.push('Your name is required.');
      if (!customerPhone) errors.push('Your phone number is required.');
      if (isScheduled && (!scheduleDate || !scheduleTime)) errors.push('Please set a date and time for scheduling.');
    }
    return errors;
  };

  const goNext = () => {
    const errors = validateStep(step);
    if (errors.length) { setStepErrors(errors); return; }
    setStepErrors([]);
    setStep(s => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => { setStepErrors([]); setStep(s => Math.max(s - 1, 0)); };

  const handleSubmit = async () => {
    const errors = validateStep(3);
    if (errors.length) { setStepErrors(errors); return; }
    setStepErrors([]);
    setIsSubmitting(true);

    try {
      const validDropoffs = dropoffs.filter(d => d.address && d.lat);
      const firstDropoff = validDropoffs[0];

      const bookingParams: Record<string, unknown> = {
        businessId: business!.id,
        vehicleTypeId: selectedVehicle,
        pickup: { address: pickup.address, location: { lat: pickup.lat, lng: pickup.lng }, contactName: pickup.contactName, contactPhone: pickup.contactPhone, instructions: pickup.instructions || undefined },
        dropoff: { address: firstDropoff.address, location: { lat: firstDropoff.lat!, lng: firstDropoff.lng! }, contactName: firstDropoff.contactName, contactPhone: firstDropoff.contactPhone, instructions: firstDropoff.instructions || undefined },
        package: { description: packageDesc || 'Package', weightKg: packageWeight || undefined, value: packageValue || undefined },
        payment: { paymentBy: 'sender', paymentMethod },
        customer: { name: customerName, phone: customerPhone, email: customerEmail || undefined },
      };

      if (validDropoffs.length > 1) {
        bookingParams.additionalStops = validDropoffs.slice(1).map(d => ({
          address: d.address, location: { lat: d.lat!, lng: d.lng! },
          contactName: d.contactName, contactPhone: d.contactPhone, instructions: d.instructions || undefined,
        }));
      }

      if (isScheduled && scheduleDate && scheduleTime) {
        bookingParams.isScheduled = true;
        bookingParams.scheduledPickupTime = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
      }

      const result = await bookDeliveryStorefront(bookingParams as Parameters<typeof bookDeliveryStorefront>[0]);
      if (!result.success) throw new Error(result.error || 'Failed to create delivery');
      setTrackingNumber(result.delivery?.tracking_number || '');
      setSubmitted(true);
    } catch (err: any) {
      setStepErrors([err.message || 'Something went wrong. Please try again.']);
    }
    setIsSubmitting(false);
  };

  const resetForm = () => {
    setSubmitted(false); setStep(0); setTrackingNumber('');
    setPickup({ address: '', lat: 0, lng: 0, contactName: '', contactPhone: '', instructions: '' });
    setDropoffs([{ id: '1', address: '', lat: 0, lng: 0, contactName: '', contactPhone: '', instructions: '' }]);
    setPackageDesc(''); setPackageWeight(0); setPackageValue(0);
    setRouteDistance(0); setRouteDuration(0);
    setCustomerName(''); setCustomerPhone(''); setCustomerEmail('');
    setIsScheduled(false); mapRef.current = null;
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/80 text-sm font-medium">Loading storefront...</p>
        </div>
      </div>
    );
  }

  if (error || !business) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Package className="h-10 w-10 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Storefront Not Found</h1>
          <p className="text-gray-500">{error || "This business storefront doesn't exist or has been disabled."}</p>
          <Link href="https://swiftdashdms.com" className="text-blue-600 hover:underline text-sm mt-4 inline-block">← Go to SwiftDash</Link>
        </div>
      </div>
    );
  }

  const heroText = business.storefront_settings?.hero_text || 'Book a Delivery';
  const desc = business.storefront_settings?.description || 'Fast, reliable delivery.';
  const showPrice = business.storefront_settings?.show_price_estimate !== false;
  const badges = business.storefront_settings?.tagline_badges || ['Fast Delivery', 'Real-time Tracking', 'Insured'];
  const bookingNote = business.storefront_settings?.booking_note;

  // ── Success ────────────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: `linear-gradient(135deg, ${brandColor}15 0%, ${brandColor}05 100%)` }}>
        <GoogleMapsLoader />
        <header className="bg-white/80 backdrop-blur border-b px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            {business.settings.logo_url && <Image src={business.settings.logo_url} alt={business.business_name} width={32} height={32} className="rounded-lg object-contain" />}
            <span className="font-bold text-sm">{business.business_name}</span>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="max-w-md w-full text-center">
            <div className="relative w-24 h-24 mx-auto mb-8">
              <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ backgroundColor: brandColor }} />
              <div className="relative w-24 h-24 rounded-full flex items-center justify-center" style={{ backgroundColor: `${brandColor}20` }}>
                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: brandColor }}>
                  <CheckCircle2 className="w-8 h-8 text-white" />
                </div>
              </div>
            </div>

            <h2 className="text-3xl font-bold text-gray-900 mb-2">You're all set! 🎉</h2>
            <p className="text-gray-500 mb-8">Your delivery has been booked and is awaiting a driver.</p>

            {trackingNumber && (
              <div className="bg-white rounded-2xl shadow-lg border p-6 mb-6 text-left">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${brandColor}20` }}>
                    <Navigation className="w-4 h-4" style={{ color: brandColor }} />
                  </div>
                  <span className="font-semibold text-sm">Your Tracking Details</span>
                </div>
                <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Tracking Number</p>
                <p className="text-2xl font-mono font-bold mb-4" style={{ color: brandColor }}>{trackingNumber}</p>
                <div className="space-y-2 text-sm text-gray-600 border-t pt-4">
                  <div className="flex justify-between"><span>From</span><span className="font-medium text-right max-w-[180px] truncate">{pickup.address}</span></div>
                  <div className="flex justify-between"><span>To</span><span className="font-medium text-right max-w-[180px] truncate">{dropoffs[0].address}</span></div>
                  {routeDistance > 0 && <div className="flex justify-between"><span>Distance</span><span className="font-medium">{routeDistance.toFixed(1)} km</span></div>}
                  {estimatedPrice && showPrice && <div className="flex justify-between"><span>Est. Price</span><span className="font-bold" style={{ color: brandColor }}>₱{estimatedPrice.toFixed(0)}</span></div>}
                </div>
                <Link
                  href={`/track/${trackingNumber}`}
                  className="mt-4 flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-white text-sm transition-all hover:opacity-90"
                  style={{ backgroundColor: brandColor }}
                >
                  <Navigation className="w-4 h-4" />
                  Track Live
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}

            <button onClick={resetForm} className="text-sm text-gray-500 hover:text-gray-700 underline">
              Book another delivery
            </button>
          </div>
        </div>

        <footer className="py-4 text-center text-xs text-gray-400 bg-white/50">
          Powered by <Link href="https://swiftdashdms.com" className="font-semibold text-gray-500 hover:underline">SwiftDash</Link>
        </footer>
      </div>
    );
  }

  // ── Main Form ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <GoogleMapsLoader />

      {/* Sticky Header */}
      <header className="bg-white/90 backdrop-blur-md border-b sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          {business.settings.logo_url && (
            <Image src={business.settings.logo_url} alt={business.business_name} width={36} height={36} className="rounded-xl object-contain flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold leading-tight truncate">{business.business_name}</h1>
            <p className="text-xs text-gray-400">Delivery Booking</p>
          </div>
          {business.business_phone && (
            <a href={`tel:${business.business_phone}`} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border hover:bg-gray-50 text-gray-600 transition-colors flex-shrink-0">
              <Phone className="w-3 h-3" />
              Call
            </a>
          )}
        </div>

        {/* Step progress */}
        <div className="max-w-2xl mx-auto px-4 pb-3">
          <div className="flex items-center gap-1">
            {STEPS.map((label, i) => (
              <React.Fragment key={label}>
                <button
                  type="button"
                  onClick={() => i < step && setStep(i)}
                  className={`flex items-center gap-1 text-xs font-medium transition-all ${i <= step ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition-all ${i < step || i === step ? 'text-white' : 'bg-gray-200 text-gray-400'}`}
                    style={i <= step ? { backgroundColor: brandColor } : {}}
                  >
                    {i < step ? <CheckCircle2 className="w-3 h-3" /> : i + 1}
                  </div>
                  <span className={`hidden sm:block ${i === step ? 'text-gray-900' : i < step ? 'text-gray-500' : 'text-gray-400'}`}>{label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className="flex-1 h-0.5 rounded-full transition-all" style={{ backgroundColor: i < step ? brandColor : '#e5e7eb' }} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </header>

      {/* Hero (step 0 only) */}
      {step === 0 && (
        <div className="relative overflow-hidden text-white py-10 px-4" style={{ background: `linear-gradient(135deg, ${brandColor} 0%, ${brandColor}cc 60%, ${accentColor}99 100%)` }}>
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full opacity-10 bg-white" />
          <div className="absolute -bottom-16 -left-10 w-64 h-64 rounded-full opacity-10 bg-white" />
          <div className="max-w-2xl mx-auto relative z-10">
            <h2 className="text-2xl md:text-3xl font-bold mb-2 leading-tight">{heroText}</h2>
            <p className="text-white/75 text-sm md:text-base mb-5">{desc}</p>
            <div className="flex flex-wrap gap-2">
              {badges.map((b: string, i: number) => (
                <span key={i} className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/20 text-white text-xs font-medium px-3 py-1.5 rounded-full">
                  {i === 0 && <Zap className="w-3 h-3" />}
                  {i === 1 && <Navigation className="w-3 h-3" />}
                  {i === 2 && <Shield className="w-3 h-3" />}
                  {i > 2 && <Star className="w-3 h-3" />}
                  {b}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step Content */}
      <div className="max-w-2xl mx-auto px-4 py-6 pb-32">

        {stepErrors.length > 0 && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 space-y-1">
            {stepErrors.map((err, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-red-600">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{err}</span>
              </div>
            ))}
          </div>
        )}

        {/* STEP 0: Route */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="flex p-1 bg-white rounded-2xl border shadow-sm">
              {(['single', 'multi'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setDeliveryType(t); if (t === 'single') setDropoffs([dropoffs[0]]); }}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${deliveryType === t ? 'text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  style={deliveryType === t ? { backgroundColor: brandColor } : {}}
                >
                  {t === 'single' ? '📍 Single Stop' : '🗺️ Multi-Stop'}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center gap-2" style={{ backgroundColor: `${brandColor}08` }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: brandColor }}>P</div>
                <span className="font-semibold text-sm">Pickup Location</span>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <Label className="text-xs text-gray-400 uppercase tracking-wide mb-1.5 block">Address</Label>
                  <GooglePlacesAutocomplete
                    id="sf-pickup" value={pickup.address}
                    onChange={v => setPickup({ ...pickup, address: v })}
                    onPlaceSelected={p => setPickup({ ...pickup, address: p.address, lat: p.lat, lng: p.lng })}
                    placeholder="Search pickup address..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-gray-400 uppercase tracking-wide mb-1.5 block">Contact Name</Label>
                    <Input value={pickup.contactName} onChange={e => setPickup({ ...pickup, contactName: e.target.value })} placeholder="Juan Dela Cruz" className="h-10" />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-400 uppercase tracking-wide mb-1.5 block">Phone</Label>
                    <Input value={pickup.contactPhone} onChange={e => setPickup({ ...pickup, contactPhone: e.target.value })} placeholder="09171234567" className="h-10" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-gray-400 uppercase tracking-wide mb-1.5 block">Instructions <span className="normal-case text-gray-300">(optional)</span></Label>
                  <Input value={pickup.instructions} onChange={e => setPickup({ ...pickup, instructions: e.target.value })} placeholder="e.g., Ring doorbell, Unit 3B" className="h-10" />
                </div>
              </div>
            </div>

            {dropoffs.map((stop, idx) => (
              <div key={stop.id} className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b flex items-center justify-between" style={{ backgroundColor: '#fff7ed' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold">{idx + 1}</div>
                    <span className="font-semibold text-sm">{dropoffs.length === 1 ? 'Delivery Location' : `Stop ${idx + 1}`}</span>
                  </div>
                  {dropoffs.length > 1 && (
                    <button type="button" onClick={() => removeDropoff(stop.id)} className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <Label className="text-xs text-gray-400 uppercase tracking-wide mb-1.5 block">Address</Label>
                    <GooglePlacesAutocomplete
                      id={`sf-dropoff-${stop.id}`} value={stop.address}
                      onChange={v => updateDropoff(stop.id, 'address', v)}
                      onPlaceSelected={p => setDropoffs(dropoffs.map(d => d.id === stop.id ? { ...d, address: p.address, lat: p.lat, lng: p.lng } : d))}
                      placeholder="Search delivery address..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-gray-400 uppercase tracking-wide mb-1.5 block">Recipient Name</Label>
                      <Input value={stop.contactName} onChange={e => updateDropoff(stop.id, 'contactName', e.target.value)} placeholder="Maria Santos" className="h-10" />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-400 uppercase tracking-wide mb-1.5 block">Recipient Phone</Label>
                      <Input value={stop.contactPhone} onChange={e => updateDropoff(stop.id, 'contactPhone', e.target.value)} placeholder="09181234567" className="h-10" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-400 uppercase tracking-wide mb-1.5 block">Instructions <span className="normal-case text-gray-300">(optional)</span></Label>
                    <Input value={stop.instructions} onChange={e => updateDropoff(stop.id, 'instructions', e.target.value)} placeholder="e.g., Leave with guard" className="h-10" />
                  </div>
                </div>
              </div>
            ))}

            {deliveryType === 'multi' && (
              <button type="button" onClick={addDropoff} className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-400 transition-all bg-white">
                <Plus className="h-4 w-4" />
                Add Another Stop
              </button>
            )}

            {routeDistance > 0 && (
              <div className="flex items-center gap-3 bg-white rounded-2xl border px-4 py-3 shadow-sm">
                {routeLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                ) : (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${brandColor}15` }}>
                    <Navigation className="w-4 h-4" style={{ color: brandColor }} />
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">{routeDistance.toFixed(1)} km route</p>
                  <p className="text-xs text-gray-400">~{Math.round(routeDuration / 60)} min drive</p>
                </div>
                {showPrice && estimatedPrice && selectedVehicleData && (
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Est. from</p>
                    <p className="text-base font-bold" style={{ color: brandColor }}>₱{estimatedPrice.toFixed(0)}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* STEP 1: Package */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="text-center pb-2">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: `${brandColor}15` }}>
                <Package className="w-6 h-6" style={{ color: brandColor }} />
              </div>
              <h3 className="text-lg font-bold">What are you sending?</h3>
              <p className="text-sm text-gray-400 mt-1">Help your driver know what to handle</p>
            </div>

            <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-4">
              <div>
                <Label className="text-xs text-gray-400 uppercase tracking-wide mb-1.5 block">Package Description</Label>
                <Input value={packageDesc} onChange={e => setPackageDesc(e.target.value)} placeholder="e.g., Documents, Clothing, Electronics, Food" className="h-11" />
              </div>
              <div className="flex flex-wrap gap-2">
                {['Documents', 'Food', 'Clothing', 'Electronics', 'Medicine'].map(item => (
                  <button key={item} type="button" onClick={() => setPackageDesc(item)}
                    className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${packageDesc === item ? 'text-white border-transparent' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                    style={packageDesc === item ? { backgroundColor: brandColor, borderColor: brandColor } : {}}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-gray-400 uppercase tracking-wide mb-1.5 block">Weight (kg) <span className="normal-case text-gray-300">optional</span></Label>
                  <Input type="number" step="0.1" value={packageWeight || ''} onChange={e => setPackageWeight(parseFloat(e.target.value) || 0)} placeholder="e.g., 0.5" className="h-11" />
                </div>
                <div>
                  <Label className="text-xs text-gray-400 uppercase tracking-wide mb-1.5 block">Declared Value (₱) <span className="normal-case text-gray-300">optional</span></Label>
                  <Input type="number" step="1" value={packageValue || ''} onChange={e => setPackageValue(parseFloat(e.target.value) || 0)} placeholder="e.g., 500" className="h-11" />
                </div>
              </div>
              <p className="text-xs text-gray-400">Declared value is for insurance purposes. Be accurate to ensure coverage.</p>
            </div>
          </div>
        )}

        {/* STEP 2: Vehicle */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="text-center pb-2">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: `${brandColor}15` }}>
                <Truck className="w-6 h-6" style={{ color: brandColor }} />
              </div>
              <h3 className="text-lg font-bold">Choose a Vehicle</h3>
              <p className="text-sm text-gray-400 mt-1">
                {routeDistance > 0 ? `${routeDistance.toFixed(1)} km route — prices include 12% VAT` : 'Select the right size for your cargo'}
              </p>
            </div>

            <div className="space-y-3">
              {vehicleTypes.map((v) => {
                const isSelected = selectedVehicle === v.id;
                const price = routeDistance > 0
                  ? (Number(v.base_price) + Number(v.price_per_km) * routeDistance) * 1.12
                  : null;

                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedVehicle(v.id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all ${isSelected ? 'shadow-md' : 'bg-white hover:border-gray-300'}`}
                    style={isSelected ? { borderColor: brandColor, backgroundColor: `${brandColor}06` } : {}}
                  >
                    <div
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden ${isSelected ? 'shadow-sm' : 'bg-gray-50'}`}
                      style={isSelected ? { backgroundColor: `${brandColor}15` } : {}}
                    >
                      {v.image_url ? (
                        <Image src={v.image_url} alt={v.display_name || v.name} width={56} height={56} className="w-full h-full object-cover" />
                      ) : (
                        getVehicleEmoji(v.name)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm" style={isSelected ? { color: brandColor } : {}}>{v.display_name || v.name}</span>
                        {isSelected && <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium" style={{ backgroundColor: brandColor }}>Selected</span>}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">Up to {v.max_weight_kg}kg</p>
                      {v.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{v.description.split('.')[0]}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      {price !== null && showPrice ? (
                        <>
                          <p className="text-lg font-bold" style={{ color: brandColor }}>₱{price.toFixed(0)}</p>
                          <p className="text-xs text-gray-400">incl. VAT</p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-bold text-gray-900">₱{Number(v.base_price).toFixed(0)}</p>
                          <p className="text-xs text-gray-400">base + ₱{Number(v.price_per_km)}/km</p>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 3: You */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="text-center pb-2">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: `${brandColor}15` }}>
                <User className="w-6 h-6" style={{ color: brandColor }} />
              </div>
              <h3 className="text-lg font-bold">Your Details</h3>
              <p className="text-sm text-gray-400 mt-1">So we can keep you updated on your delivery</p>
            </div>

            <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-4">
              <div>
                <Label className="text-xs text-gray-400 uppercase tracking-wide mb-1.5 block">Full Name</Label>
                <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Your full name" className="h-11" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-400 uppercase tracking-wide mb-1.5 block">Phone Number</Label>
                  <Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="09171234567" className="h-11" />
                </div>
                <div>
                  <Label className="text-xs text-gray-400 uppercase tracking-wide mb-1.5 block">Email <span className="normal-case text-gray-300">optional</span></Label>
                  <Input type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="you@email.com" className="h-11" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-3">
              <Label className="text-xs text-gray-400 uppercase tracking-wide block">Payment Method</Label>
              <div className="grid grid-cols-2 gap-3">
                {(business.storefront_settings?.payment_methods?.length
                  ? business.storefront_settings.payment_methods
                  : ['cash', 'maya']
                ).map((method: string) => {
                  const labels: Record<string, string> = { cash: '💵 Cash', maya: '📱 Maya', card: '💳 Card', gcash: '🟦 GCash' };
                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all ${paymentMethod === method ? 'text-white' : 'bg-gray-50 text-gray-600 hover:border-gray-300'}`}
                      style={paymentMethod === method ? { backgroundColor: brandColor, borderColor: brandColor } : {}}
                    >
                      {labels[method] ?? method}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${brandColor}15` }}>
                    <Calendar className="w-4 h-4" style={{ color: brandColor }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Schedule for Later</p>
                    <p className="text-xs text-gray-400">Default is ASAP</p>
                  </div>
                </div>
                <Switch checked={isScheduled} onCheckedChange={setIsScheduled} />
              </div>
              {isScheduled && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <Label className="text-xs text-gray-400 uppercase tracking-wide mb-1.5 block">Date</Label>
                    <Input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="h-11" />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-400 uppercase tracking-wide mb-1.5 block">Time</Label>
                    <Input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="h-11" />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 4: Review */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="text-center pb-2">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: `${brandColor}15` }}>
                <CheckCircle2 className="w-6 h-6" style={{ color: brandColor }} />
              </div>
              <h3 className="text-lg font-bold">Review Your Order</h3>
              <p className="text-sm text-gray-400 mt-1">Everything look good? Tap Book Delivery to confirm.</p>
            </div>

            {pickup.lat && dropoffs.some(d => d.lat) && (
              <div className="rounded-2xl overflow-hidden border shadow-sm h-72">
                <div ref={mapContainerRef} className="w-full h-full" />
              </div>
            )}

            <div className="bg-white rounded-2xl border shadow-sm divide-y">
              <div className="p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Route</p>
                <div className="space-y-2">
                  <div className="flex gap-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5" style={{ backgroundColor: brandColor }}>P</div>
                    <div>
                      <p className="text-sm font-medium leading-tight">{pickup.address}</p>
                      <p className="text-xs text-gray-400">{pickup.contactName} · {pickup.contactPhone}</p>
                    </div>
                  </div>
                  {dropoffs.filter(d => d.address).map((d, i) => (
                    <div key={d.id} className="flex gap-3">
                      <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">{i + 1}</div>
                      <div>
                        <p className="text-sm font-medium leading-tight">{d.address}</p>
                        <p className="text-xs text-gray-400">{d.contactName} · {d.contactPhone}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {routeDistance > 0 && (
                  <div className="mt-3 flex gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Navigation className="w-3 h-3" />{routeDistance.toFixed(1)} km</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />~{Math.round(routeDuration / 60)} min</span>
                  </div>
                )}
              </div>

              <div className="p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Package</p>
                <p className="text-sm font-medium">{packageDesc || 'Package'}</p>
                <div className="flex gap-4 text-xs text-gray-400 mt-1">
                  {packageWeight > 0 && <span>{packageWeight} kg</span>}
                  {packageValue > 0 && <span>Value: ₱{packageValue}</span>}
                </div>
              </div>

              <div className="p-4 flex items-center gap-3">
                {selectedVehicleData?.image_url ? (
                  <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
                    <Image src={selectedVehicleData.image_url} alt={selectedVehicleData.display_name || selectedVehicleData.name} width={40} height={40} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <span className="text-2xl">{selectedVehicleData ? getVehicleEmoji(selectedVehicleData.name) : '🚗'}</span>
                )}
                <div className="flex-1">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Vehicle</p>
                  <p className="text-sm font-medium">{selectedVehicleData?.display_name || selectedVehicleData?.name || '—'}</p>
                </div>
              </div>

              <div className="p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Sender</p>
                <p className="text-sm font-medium">{customerName}</p>
                <p className="text-xs text-gray-400">{customerPhone}{customerEmail ? ` · ${customerEmail}` : ''}</p>
                <p className="text-xs text-gray-400 mt-1">{{ cash: '💵 Cash', maya: '📱 Maya', card: '💳 Card', gcash: '🟦 GCash' }[paymentMethod] ?? paymentMethod}{isScheduled && scheduleDate ? ` · Scheduled ${scheduleDate} ${scheduleTime}` : ' · ASAP'}</p>
              </div>
            </div>

            {showPrice && estimatedPrice !== null && (
              <div className="rounded-2xl p-5 text-center" style={{ background: `linear-gradient(135deg, ${brandColor}12 0%, ${brandColor}06 100%)`, border: `2px solid ${brandColor}30` }}>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Estimated Total</p>
                <p className="text-4xl font-bold mb-1" style={{ color: brandColor }}>₱{estimatedPrice.toFixed(0)}</p>
                <p className="text-xs text-gray-400">{routeDistance.toFixed(1)} km · incl. 12% VAT · {selectedVehicleData?.display_name || selectedVehicleData?.name}</p>
              </div>
            )}

            {bookingNote && (
              <div className="rounded-xl border bg-amber-50 border-amber-200 p-4">
                <p className="text-sm text-amber-800">{bookingNote}</p>
              </div>
            )}

            {stepErrors.length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-1">
                {stepErrors.map((err, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-red-600">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{err}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sticky Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t px-4 py-3 z-50">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          {step > 0 && (
            <button type="button" onClick={goBack} className="flex items-center gap-1.5 px-4 py-3 rounded-xl border font-medium text-sm text-gray-600 hover:bg-gray-50 transition-all">
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          )}

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={goNext}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 shadow-lg"
              style={{ backgroundColor: brandColor, boxShadow: `0 4px 14px ${brandColor}40` }}
            >
              Continue to {STEPS[step + 1]}
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 shadow-lg disabled:opacity-60"
              style={{ backgroundColor: brandColor, boxShadow: `0 4px 14px ${brandColor}40` }}
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Creating Delivery...</>
              ) : (
                <><Truck className="w-4 h-4" />Book Delivery{estimatedPrice && showPrice ? ` · ₱${estimatedPrice.toFixed(0)}` : ''}<ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          )}
        </div>
        <p className="text-center text-xs text-gray-400 mt-2">
          Powered by <Link href="https://swiftdashdms.com" className="font-semibold hover:underline">SwiftDash</Link>
        </p>
      </div>
    </div>
  );
}
