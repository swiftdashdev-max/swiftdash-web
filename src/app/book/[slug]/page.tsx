'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { bookDeliveryStorefront } from '@/lib/supabase/edge-functions';
import { GooglePlacesAutocomplete } from '@/components/google-places-autocomplete';
import { GoogleMapsLoader } from '@/components/google-maps-loader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
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
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

// ── Types ───────────────────────────────────────────────────────
interface BusinessInfo {
  id: string;
  business_name: string;
  business_phone: string | null;
  business_email: string | null;
  settings: {
    logo_url?: string;
    primary_color?: string;
    tracking_page?: {
      custom_message?: string;
      show_support_contact?: boolean;
    };
  };
  storefront_settings: {
    hero_text?: string;
    description?: string;
    accepted_vehicles?: string[];
    payment_methods?: string[];
    max_stops?: number;
    show_price_estimate?: boolean;
    require_phone?: boolean;
  };
}

interface VehicleType {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  price_per_km: number;
  max_weight_kg: number;
  icon_url: string | null;
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

// ── Component ───────────────────────────────────────────────────
export default function StorefrontBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const [slug, setSlug] = useState<string>('');
  const supabase = createClient();

  // Business data
  const [business, setBusiness] = useState<BusinessInfo | null>(null);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [deliveryType, setDeliveryType] = useState<'single' | 'multi'>('single');
  const [pickup, setPickup] = useState({ address: '', lat: 0, lng: 0, contactName: '', contactPhone: '', instructions: '' });
  const [dropoffs, setDropoffs] = useState<DropoffStop[]>([
    { id: '1', address: '', contactName: '', contactPhone: '', instructions: '' },
  ]);
  const [packageDesc, setPackageDesc] = useState('');
  const [packageWeight, setPackageWeight] = useState<number>(0);
  const [packageValue, setPackageValue] = useState<number>(0);
  const [selectedVehicle, setSelectedVehicle] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'maya'>('cash');
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [routeDistance, setRouteDistance] = useState(0);
  const [routeDuration, setRouteDuration] = useState(0);

  // Submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [formErrors, setFormErrors] = useState<string[]>([]);

  // Resolve params
  useEffect(() => {
    params.then((p) => setSlug(p.slug));
  }, [params]);

  // Fetch business info
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

        if (bizErr || !biz) {
          setError('This storefront is not available.');
          setLoading(false);
          return;
        }
        setBusiness(biz as BusinessInfo);

        // Fetch vehicle types
        const { data: vehicles } = await supabase
          .from('vehicle_types')
          .select('*')
          .eq('is_active', true)
          .order('base_price');

        if (vehicles && vehicles.length > 0) {
          // Filter to accepted vehicles if configured
          const accepted = (biz as BusinessInfo).storefront_settings?.accepted_vehicles;
          const filtered = accepted?.length
            ? vehicles.filter((v: VehicleType) => accepted.includes(v.id))
            : vehicles;
          setVehicleTypes(filtered as VehicleType[]);
          if (filtered.length > 0) setSelectedVehicle(filtered[0].id);
        }
      } catch (e) {
        setError('Something went wrong loading this page.');
      }
      setLoading(false);
    }
    fetchBusiness();
  }, [slug]);

  // Price calculation
  const selectedVehicleData = useMemo(
    () => vehicleTypes.find((v) => v.id === selectedVehicle),
    [vehicleTypes, selectedVehicle]
  );

  const estimatedPrice = useMemo(() => {
    if (!selectedVehicleData || !routeDistance) return null;
    const base = Number(selectedVehicleData.base_price);
    const perKm = Number(selectedVehicleData.price_per_km);
    const stopCharge = Number(selectedVehicleData.additional_stop_charge || 0);
    const extraStops = deliveryType === 'multi' ? Math.max(0, dropoffs.length - 1) : 0;
    return base + perKm * routeDistance + stopCharge * extraStops;
  }, [selectedVehicleData, routeDistance, dropoffs.length, deliveryType]);

  // Fetch route distance when addresses change
  useEffect(() => {
    if (!pickup.lat || !pickup.lng) return;
    const validDropoffs = dropoffs.filter((d) => d.lat && d.lng);
    if (validDropoffs.length === 0) return;

    const coords = [
      `${pickup.lng},${pickup.lat}`,
      ...validDropoffs.map((d) => `${d.lng},${d.lat}`),
    ].join(';');

    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!token) return;

    fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?overview=false&access_token=${token}`
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.routes?.[0]) {
          setRouteDistance(data.routes[0].distance / 1000);
          setRouteDuration(data.routes[0].duration);
        }
      })
      .catch(() => {});
  }, [pickup.lat, pickup.lng, dropoffs]);

  // Helpers
  const addDropoff = () => {
    const maxStops = business?.storefront_settings?.max_stops || 10;
    if (dropoffs.length >= maxStops) return;
    setDropoffs([
      ...dropoffs,
      { id: Date.now().toString(), address: '', contactName: '', contactPhone: '', instructions: '' },
    ]);
  };

  const removeDropoff = (id: string) => {
    if (dropoffs.length <= 1) return;
    setDropoffs(dropoffs.filter((d) => d.id !== id));
  };

  const updateDropoff = (id: string, field: keyof DropoffStop, value: string | number) => {
    setDropoffs(dropoffs.map((d) => (d.id === id ? { ...d, [field]: value } : d)));
  };

  // Brand color
  const brandColor = business?.settings?.primary_color || '#3b82f6';

  // Validate & submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: string[] = [];

    if (!pickup.address || !pickup.lat) errors.push('Please select a pickup address.');
    if (!pickup.contactName) errors.push('Pickup contact name is required.');
    if (!pickup.contactPhone) errors.push('Pickup contact phone is required.');

    const validDropoffs = dropoffs.filter((d) => d.address && d.lat);
    if (validDropoffs.length === 0) errors.push('Please add at least one delivery address.');
    validDropoffs.forEach((d, i) => {
      if (!d.contactName) errors.push(`Stop ${i + 1}: Contact name is required.`);
      if (!d.contactPhone) errors.push(`Stop ${i + 1}: Contact phone is required.`);
    });

    if (!selectedVehicle) errors.push('Please select a vehicle type.');
    if (!customerName) errors.push('Your name is required.');
    if (!customerPhone) errors.push('Your phone number is required.');

    if (errors.length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors([]);
    setIsSubmitting(true);

    try {
      const validDropoffs = dropoffs.filter((d) => d.address && d.lat);
      const firstDropoff = validDropoffs[0];

      // Build request matching edge function signature
      const bookingParams: Record<string, unknown> = {
        businessId: business!.id,
        vehicleTypeId: selectedVehicle,
        pickup: {
          address: pickup.address,
          location: { lat: pickup.lat, lng: pickup.lng },
          contactName: pickup.contactName,
          contactPhone: pickup.contactPhone,
          instructions: pickup.instructions || undefined,
        },
        dropoff: {
          address: firstDropoff.address,
          location: { lat: firstDropoff.lat, lng: firstDropoff.lng },
          contactName: firstDropoff.contactName,
          contactPhone: firstDropoff.contactPhone,
          instructions: firstDropoff.instructions || undefined,
        },
        package: {
          description: packageDesc || 'Package',
          weightKg: packageWeight || undefined,
          value: packageValue || undefined,
        },
        payment: {
          paymentBy: 'sender',
          paymentMethod: paymentMethod,
        },
        customer: {
          name: customerName,
          phone: customerPhone,
          email: customerEmail || undefined,
        },
      };

      // Additional stops for multi-stop
      if (validDropoffs.length > 1) {
        bookingParams.additionalStops = validDropoffs.slice(1).map((d) => ({
          address: d.address,
          location: { lat: d.lat, lng: d.lng },
          contactName: d.contactName,
          contactPhone: d.contactPhone,
          instructions: d.instructions || undefined,
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
      setFormErrors([err.message || 'Something went wrong. Please try again.']);
    }
    setIsSubmitting(false);
  };

  // ── Loading / Error states ──────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !business) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto px-6">
          <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Storefront Not Found</h1>
          <p className="text-gray-500">
            {error || "This business storefront doesn't exist or has been disabled."}
          </p>
          <Link href="/" className="text-blue-600 hover:underline text-sm mt-4 inline-block">
            ← Go to SwiftDash
          </Link>
        </div>
      </div>
    );
  }

  // ── Success state ───────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50">
        <GoogleMapsLoader />
        {/* Header */}
        <header className="bg-white border-b" style={{ borderBottomColor: brandColor }}>
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
            {business.settings.logo_url && (
              <Image
                src={business.settings.logo_url}
                alt={business.business_name}
                width={40}
                height={40}
                className="rounded-lg object-contain"
              />
            )}
            <h1 className="text-lg font-bold">{business.business_name}</h1>
          </div>
        </header>

        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <div className="flex items-center justify-center w-16 h-16 mx-auto mb-6 rounded-full bg-green-100">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Delivery Booked!</h2>
          <p className="text-gray-500 mb-6">
            Your delivery has been created and is awaiting pickup.
          </p>
          {trackingNumber && (
            <div className="bg-white rounded-xl border p-4 mb-6">
              <p className="text-sm text-gray-500 mb-1">Tracking Number</p>
              <p className="text-xl font-mono font-bold" style={{ color: brandColor }}>
                {trackingNumber}
              </p>
              <Link
                href={`/track/${trackingNumber}`}
                className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium hover:underline"
                style={{ color: brandColor }}
              >
                Track your delivery
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
          <Button
            onClick={() => {
              setSubmitted(false);
              setTrackingNumber('');
              setPickup({ address: '', lat: 0, lng: 0, contactName: '', contactPhone: '', instructions: '' });
              setDropoffs([{ id: '1', address: '', contactName: '', contactPhone: '', instructions: '' }]);
              setPackageDesc('');
              setPackageWeight(0);
              setPackageValue(0);
              setRouteDistance(0);
              setRouteDuration(0);
            }}
            variant="outline"
            className="mt-2"
          >
            Book Another Delivery
          </Button>
        </div>

        <footer className="fixed bottom-0 left-0 right-0 py-3 text-center text-xs text-gray-400 bg-gray-50">
          Powered by{' '}
          <Link href="https://swiftdashdms.com" className="font-medium text-gray-500 hover:underline">
            SwiftDash
          </Link>
        </footer>
      </div>
    );
  }

  // ── Main booking form ───────────────────────────────────────
  const heroText = business.storefront_settings?.hero_text || 'Book a Delivery';
  const desc = business.storefront_settings?.description || 'Fast, reliable delivery powered by SwiftDash.';
  const showPriceEstimate = business.storefront_settings?.show_price_estimate !== false;

  return (
    <div className="min-h-screen bg-gray-50">
      <GoogleMapsLoader />

      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50" style={{ borderBottomColor: brandColor }}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          {business.settings.logo_url && (
            <Image
              src={business.settings.logo_url}
              alt={business.business_name}
              width={36}
              height={36}
              className="rounded-lg object-contain"
            />
          )}
          <div>
            <h1 className="text-base font-bold leading-tight">{business.business_name}</h1>
            <p className="text-xs text-gray-500">Delivery Booking</p>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="text-white py-10 px-4" style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}dd)` }}>
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-2">{heroText}</h2>
          <p className="text-white/80 text-sm md:text-base">{desc}</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-4 py-6 space-y-6 pb-24">

        {/* Delivery Type Toggle */}
        <div className="flex items-center gap-2 bg-white rounded-xl border p-1">
          <button
            type="button"
            onClick={() => {
              setDeliveryType('single');
              setDropoffs([dropoffs[0]]);
            }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
              deliveryType === 'single'
                ? 'bg-gray-900 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Single Stop
          </button>
          <button
            type="button"
            onClick={() => setDeliveryType('multi')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
              deliveryType === 'multi'
                ? 'bg-gray-900 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Multi-Stop
          </button>
        </div>

        {/* Pickup */}
        <Card>
          <CardContent className="pt-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: brandColor }}>
                <MapPin className="h-3.5 w-3.5" />
              </div>
              <Label className="text-base font-semibold">Pickup</Label>
            </div>
            <div>
              <Label className="text-xs text-gray-500">Address</Label>
              <GooglePlacesAutocomplete
                id="storefront-pickup"
                value={pickup.address}
                onChange={(v) => setPickup({ ...pickup, address: v })}
                onPlaceSelected={(p) => setPickup({ ...pickup, address: p.address, lat: p.lat, lng: p.lng })}
                placeholder="Search pickup address..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-500">Contact Name</Label>
                <Input
                  value={pickup.contactName}
                  onChange={(e) => setPickup({ ...pickup, contactName: e.target.value })}
                  placeholder="Juan Dela Cruz"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Phone</Label>
                <Input
                  value={pickup.contactPhone}
                  onChange={(e) => setPickup({ ...pickup, contactPhone: e.target.value })}
                  placeholder="09171234567"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-500">Instructions (optional)</Label>
              <Input
                value={pickup.instructions}
                onChange={(e) => setPickup({ ...pickup, instructions: e.target.value })}
                placeholder="e.g., Ring doorbell"
              />
            </div>
          </CardContent>
        </Card>

        {/* Dropoffs */}
        {dropoffs.map((stop, idx) => (
          <Card key={stop.id}>
            <CardContent className="pt-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full flex items-center justify-center bg-orange-500 text-white text-xs font-bold">
                    {idx + 1}
                  </div>
                  <Label className="text-base font-semibold">
                    {dropoffs.length === 1 ? 'Delivery' : `Stop ${idx + 1}`}
                  </Label>
                </div>
                {dropoffs.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={() => removeDropoff(stop.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div>
                <Label className="text-xs text-gray-500">Address</Label>
                <GooglePlacesAutocomplete
                  id={`storefront-dropoff-${stop.id}`}
                  value={stop.address}
                  onChange={(v) => updateDropoff(stop.id, 'address', v)}
                  onPlaceSelected={(p) => {
                    setDropoffs(dropoffs.map((d) =>
                      d.id === stop.id ? { ...d, address: p.address, lat: p.lat, lng: p.lng } : d
                    ));
                  }}
                  placeholder="Search delivery address..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-500">Recipient Name</Label>
                  <Input
                    value={stop.contactName}
                    onChange={(e) => updateDropoff(stop.id, 'contactName', e.target.value)}
                    placeholder="Maria Santos"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Recipient Phone</Label>
                  <Input
                    value={stop.contactPhone}
                    onChange={(e) => updateDropoff(stop.id, 'contactPhone', e.target.value)}
                    placeholder="09181234567"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-gray-500">Instructions (optional)</Label>
                <Input
                  value={stop.instructions}
                  onChange={(e) => updateDropoff(stop.id, 'instructions', e.target.value)}
                  placeholder="e.g., Leave with guard"
                />
              </div>
            </CardContent>
          </Card>
        ))}

        {deliveryType === 'multi' && (
          <Button type="button" variant="outline" onClick={addDropoff} className="w-full gap-2">
            <Plus className="h-4 w-4" />
            Add Another Stop
          </Button>
        )}

        {/* Package Details */}
        <Card>
          <CardContent className="pt-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Package className="h-4 w-4 text-gray-500" />
              <Label className="text-base font-semibold">Package Details</Label>
            </div>
            <div>
              <Label className="text-xs text-gray-500">Description</Label>
              <Input
                value={packageDesc}
                onChange={(e) => setPackageDesc(e.target.value)}
                placeholder="e.g., Documents, Electronics, Food"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-500">Weight (kg)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={packageWeight || ''}
                  onChange={(e) => setPackageWeight(parseFloat(e.target.value) || 0)}
                  placeholder="0.5"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Declared Value (₱)</Label>
                <Input
                  type="number"
                  step="1"
                  value={packageValue || ''}
                  onChange={(e) => setPackageValue(parseFloat(e.target.value) || 0)}
                  placeholder="500"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vehicle Selection */}
        {vehicleTypes.length > 0 && (
          <Card>
            <CardContent className="pt-5 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Truck className="h-4 w-4 text-gray-500" />
                <Label className="text-base font-semibold">Vehicle Type</Label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {vehicleTypes.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedVehicle(v.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                      selectedVehicle === v.id
                        ? 'border-current shadow-sm'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    style={selectedVehicle === v.id ? { borderColor: brandColor, color: brandColor } : {}}
                  >
                    <div className="text-2xl">{v.icon_url || '🚗'}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-gray-900">{v.name}</div>
                      <div className="text-xs text-gray-500">
                        Up to {v.max_weight_kg}kg
                      </div>
                      <div className="text-xs font-semibold mt-0.5" style={{ color: brandColor }}>
                        ₱{Number(v.base_price).toFixed(0)} + ₱{Number(v.price_per_km).toFixed(0)}/km
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Price Estimate */}
        {showPriceEstimate && routeDistance > 0 && estimatedPrice !== null && (
          <div className="rounded-xl border-2 p-4 text-center" style={{ borderColor: brandColor, backgroundColor: `${brandColor}08` }}>
            <p className="text-xs text-gray-500 mb-1">Estimated Price</p>
            <p className="text-3xl font-bold" style={{ color: brandColor }}>
              ₱{estimatedPrice.toFixed(0)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {routeDistance.toFixed(1)} km · ~{Math.round(routeDuration / 60)} min
              {deliveryType === 'multi' && dropoffs.length > 1 ? ` · ${dropoffs.length} stops` : ''}
            </p>
          </div>
        )}

        {/* Customer Info */}
        <Card>
          <CardContent className="pt-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <User className="h-4 w-4 text-gray-500" />
              <Label className="text-base font-semibold">Your Information</Label>
            </div>
            <div>
              <Label className="text-xs text-gray-500">Full Name</Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Your full name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-500">Phone Number</Label>
                <Input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="09171234567"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Email (optional)</Label>
                <Input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="you@email.com"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Schedule */}
        <Card>
          <CardContent className="pt-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <Label className="text-base font-semibold">Schedule for Later</Label>
              </div>
              <Switch checked={isScheduled} onCheckedChange={setIsScheduled} />
            </div>
            {isScheduled && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-500">Date</Label>
                  <Input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Time</Label>
                  <Input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Errors */}
        {formErrors.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-1">
            {formErrors.map((err, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-red-600">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{err}</span>
              </div>
            ))}
          </div>
        )}

        {/* Submit */}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-12 text-base font-semibold rounded-xl shadow-lg"
          style={{ backgroundColor: brandColor }}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Creating Delivery...
            </>
          ) : (
            <>
              <Truck className="h-5 w-5 mr-2" />
              Book Delivery
              {estimatedPrice ? ` · ₱${estimatedPrice.toFixed(0)}` : ''}
            </>
          )}
        </Button>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 pt-4 pb-8">
          Powered by{' '}
          <Link href="https://swiftdashdms.com" className="font-medium text-gray-500 hover:underline">
            SwiftDash
          </Link>
        </p>
      </form>
    </div>
  );
}
