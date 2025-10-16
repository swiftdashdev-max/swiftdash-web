'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { bookDelivery } from '@/lib/supabase/edge-functions';
import { useVehicleTypes } from '@/hooks/use-vehicle-types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DeliveryMap } from '@/components/delivery-map';
import { GooglePlacesAutocomplete } from '@/components/google-places-autocomplete';
import { GoogleMapsLoader } from '@/components/google-maps-loader';
import {
  Package,
  MapPin,
  Plus,
  X,
  Calendar,
  Clock,
  Truck,
  DollarSign,
  Navigation,
  Phone,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';

// Vehicle type interface matching database schema
interface VehicleType {
  id: string;
  name: string;
  base_price: number;
  price_per_km: number;
  max_weight_kg: number;
  description?: string;
  icon_emoji?: string;
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

interface PickupLocation {
  address: string;
  lat?: number;
  lng?: number;
  contactName: string;
  contactPhone: string;
  instructions: string;
}

export default function OrdersPage() {
  const router = useRouter();
  const [deliveryType, setDeliveryType] = useState<'single' | 'multi'>('single');
  const [isScheduled, setIsScheduled] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [routeDistance, setRouteDistance] = useState<number>(0);
  const [routeDuration, setRouteDuration] = useState<number>(0);
  const [estimatedCost, setEstimatedCost] = useState<number>(0);
  
  // Package details state
  const [packageDetails, setPackageDetails] = useState({
    description: '',
    weight: 0,
    value: 0
  });
  
  // Payment details state
  const [paymentDetails, setPaymentDetails] = useState({
    paymentBy: 'sender' as 'sender' | 'recipient',
    paymentMethod: 'cash' as 'cash' | 'creditCard' | 'debitCard' | 'maya'
  });
  
  // Supabase client
  const supabase = createClient();
  
  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [createdDeliveryId, setCreatedDeliveryId] = useState<string | null>(null);
  
  // Use cached vehicle types hook
  const { vehicleTypes, loading: loadingVehicles, error: vehicleError } = useVehicleTypes();
  
  const [pickupLocation, setPickupLocation] = useState<PickupLocation>({
    address: '',
    contactName: '',
    contactPhone: '',
    instructions: '',
  });
  const [dropoffStops, setDropoffStops] = useState<DropoffStop[]>([
    { id: '1', address: '', contactName: '', contactPhone: '', instructions: '' },
  ]);

  // Memoize map locations to prevent unnecessary re-renders
  const demoPickup = useMemo(() => {
    if (pickupLocation.lat && pickupLocation.lng) {
      return {
        lat: pickupLocation.lat,
        lng: pickupLocation.lng,
        label: pickupLocation.address,
        type: 'pickup' as const,
      };
    }
    return undefined;
  }, [pickupLocation.lat, pickupLocation.lng, pickupLocation.address]);

  const demoDropoffs = useMemo(() => {
    return dropoffStops
      .filter(stop => stop.lat && stop.lng)
      .map(stop => ({
        lat: stop.lat!,
        lng: stop.lng!,
        label: stop.address,
        type: 'dropoff' as const,
      }));
  }, [dropoffStops]);

  const addDropoffStop = () => {
    const newStop: DropoffStop = {
      id: Date.now().toString(),
      address: '',
      contactName: '',
      contactPhone: '',
      instructions: '',
    };
    setDropoffStops([...dropoffStops, newStop]);
  };

  const removeDropoffStop = (id: string) => {
    if (dropoffStops.length > 1) {
      setDropoffStops(dropoffStops.filter(stop => stop.id !== id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsSubmitting(true);

      // Validation
      if (!selectedVehicle) {
        throw new Error('Please select a vehicle type');
      }
      if (!pickupLocation.address || !pickupLocation.lat || !pickupLocation.lng) {
        throw new Error('Please select a pickup location');
      }
      if (!dropoffStops[0].address || !dropoffStops[0].lat || !dropoffStops[0].lng) {
        throw new Error('Please select a dropoff location');
      }
      if (!pickupLocation.contactName || !pickupLocation.contactPhone) {
        throw new Error('Please enter pickup contact information');
      }
      if (!dropoffStops[0].contactName || !dropoffStops[0].contactPhone) {
        throw new Error('Please enter dropoff contact information');
      }

      // Generate temporary tracking number (will be auto-generated by DB later)
      const trackingNumber = `SD${Date.now().toString().slice(-8)}`;

      // Prepare delivery data
      const deliveryData = {
        tracking_number: trackingNumber,
        status: isScheduled ? 'scheduled' : 'pending_dispatch',
        delivery_type: deliveryType,
        
        // Pickup information
        pickup_address: pickupLocation.address,
        pickup_lat: pickupLocation.lat,
        pickup_lng: pickupLocation.lng,
        pickup_contact_name: pickupLocation.contactName,
        pickup_contact_phone: pickupLocation.contactPhone,
        pickup_instructions: pickupLocation.instructions,
        
        // Dropoff information (for single stop)
        dropoff_address: dropoffStops[0].address,
        dropoff_lat: dropoffStops[0].lat,
        dropoff_lng: dropoffStops[0].lng,
        dropoff_contact_name: dropoffStops[0].contactName,
        dropoff_contact_phone: dropoffStops[0].contactPhone,
        dropoff_instructions: dropoffStops[0].instructions,
        
        // Multi-stop data (if applicable)
        dropoff_stops: deliveryType === 'multi' ? dropoffStops : null,
        
        // Route and pricing
        estimated_distance: routeDistance,
        estimated_duration: routeDuration,
        estimated_cost: estimatedCost,
        
        // Vehicle
        vehicle_type_id: selectedVehicle,
        
        // Scheduling
        is_scheduled: isScheduled,
        // scheduled_pickup_time: scheduledTime, // TODO: Add date/time picker value
        
        // Metadata
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Transform data for Edge Function
      const edgeFunctionPayload = {
        vehicleTypeId: selectedVehicle,
        pickup: {
          address: pickupLocation.address,
          location: { lat: pickupLocation.lat!, lng: pickupLocation.lng! },
          contactName: pickupLocation.contactName,
          contactPhone: pickupLocation.contactPhone,
          instructions: pickupLocation.instructions
        },
        dropoff: {
          address: dropoffStops[0].address,
          location: { lat: dropoffStops[0].lat!, lng: dropoffStops[0].lng! },
          contactName: dropoffStops[0].contactName,
          contactPhone: dropoffStops[0].contactPhone,
          instructions: dropoffStops[0].instructions
        },
        package: {
          description: packageDetails.description || "Package delivery",
          weightKg: packageDetails.weight || 1,
          value: packageDetails.value || 0
        },
        payment: {
          paymentBy: paymentDetails.paymentBy as 'sender' | 'recipient',
          paymentMethod: paymentDetails.paymentMethod as 'cash' | 'creditCard' | 'debitCard' | 'maya',
          paymentStatus: 'pending' as const
        }
      };

      console.log('📦 Creating delivery via Edge Function:', edgeFunctionPayload);

      // Use Edge Function instead of direct DB insert
      const createdDelivery = await bookDelivery(edgeFunctionPayload);
      console.log('✅ Delivery created:', createdDelivery);

      // Show success dialog
      setCreatedDeliveryId(createdDelivery.id);
      setShowSuccessDialog(true);

    } catch (error) {
      console.error('❌ Error creating delivery:', error);
      alert(error instanceof Error ? error.message : 'Failed to create delivery');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Memoize the route calculation handler to prevent recreation on every render
  const handleRouteCalculated = useCallback((routeInfo: { distance: number; duration: number }) => {
    setRouteDistance(routeInfo.distance);
    setRouteDuration(routeInfo.duration);

    // Calculate cost if vehicle is selected
    if (selectedVehicle) {
      const vehicle = vehicleTypes.find(v => v.id === selectedVehicle);
      if (vehicle) {
        const baseFee = vehicle.base_price;
        const distanceFee = routeInfo.distance * vehicle.price_per_km;
        const multiStopFee = deliveryType === 'multi' && dropoffStops.length > 1 
          ? (dropoffStops.length - 1) * 30 // ₱30 per additional stop
          : 0;
        
        const total = baseFee + distanceFee + multiStopFee;
        setEstimatedCost(Math.round(total));
        
        console.log('💰 Price calculated:', {
          vehicle: vehicle.name,
          baseFee,
          distance: routeInfo.distance,
          distanceFee,
          multiStopFee,
          total: Math.round(total),
        });
      }
    }
  }, [selectedVehicle, vehicleTypes, deliveryType, dropoffStops.length]);

  // Recalculate price when vehicle changes
  React.useEffect(() => {
    if (routeDistance > 0 && selectedVehicle) {
      handleRouteCalculated({ distance: routeDistance, duration: routeDuration });
    }
  }, [selectedVehicle, deliveryType, dropoffStops.length]);

  // Helper function to set demo location (for testing - remove in production)
  const setDemoPickupLocation = () => {
    setPickupLocation({
      ...pickupLocation,
      lat: 14.5995,
      lng: 121.0340,
      address: 'Makati City, Metro Manila',
    });
  };

  const setDemoDropoffLocation = (index: number) => {
    const demoLocations = [
      { lat: 14.6091, lng: 121.0223, address: 'BGC, Taguig' },
      { lat: 14.5547, lng: 121.0244, address: 'Mall of Asia, Pasay' },
      { lat: 14.6760, lng: 121.0437, address: 'Quezon City Circle' },
    ];
    
    const location = demoLocations[index % demoLocations.length];
    const updatedStops = [...dropoffStops];
    updatedStops[index] = {
      ...updatedStops[index],
      lat: location.lat,
      lng: location.lng,
      address: location.address,
    };
    setDropoffStops(updatedStops);
  };

  return (
    <>
      {/* Load Google Maps API */}
      <GoogleMapsLoader />
      
      <div className="flex h-[calc(100vh-4rem)] w-full relative">
        {/* Sidebar - Order Creation Form */}
      <div 
        className={`${
          isSidebarCollapsed ? 'w-0' : 'w-[30%] min-w-[360px] max-w-[450px]'
        } border-r bg-background transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0`}
      >
        <div className="w-full h-full overflow-y-auto">
          <div className="p-5 space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Create Delivery</h2>
                <p className="text-muted-foreground text-sm">
                  Book a new delivery with single or multiple stops
                </p>
              </div>
            </div>

            {/* Delivery Type Tabs */}
            <Tabs value={deliveryType} onValueChange={(v) => setDeliveryType(v as 'single' | 'multi')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="single">Single Stop</TabsTrigger>
                <TabsTrigger value="multi">Multi-Stop</TabsTrigger>
              </TabsList>

              <form onSubmit={handleSubmit} className="space-y-6 mt-6">
                {/* Vehicle Selection */}
                <div className="space-y-3">
                  <Label>Vehicle Type</Label>
                  {loadingVehicles ? (
                    <div className="flex items-center justify-center p-4 border rounded-lg">
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      <span className="text-sm text-muted-foreground">Loading vehicles...</span>
                    </div>
                  ) : vehicleError ? (
                    <div className="p-4 border border-destructive rounded-lg bg-destructive/10">
                      <p className="text-sm text-destructive">{vehicleError}</p>
                    </div>
                  ) : (
                    <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select vehicle type" />
                      </SelectTrigger>
                      <SelectContent>
                        {vehicleTypes.map((vehicle) => (
                          <SelectItem key={vehicle.id} value={vehicle.id}>
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{vehicle.icon_emoji || '🚗'}</span>
                              <div>
                                <div className="font-medium">{vehicle.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  ₱{vehicle.base_price} base + ₱{vehicle.price_per_km}/km • Max {vehicle.max_weight_kg}kg
                                </div>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

              <Separator />

              {/* Pickup Location */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <Label className="text-base font-semibold">Pickup Location</Label>
                </div>

                <div className="space-y-3 pl-10">
                  <div>
                    <Label htmlFor="pickup-address">Address</Label>
                    <div className="mt-1.5">
                      <GooglePlacesAutocomplete
                        id="pickup-address"
                        value={pickupLocation.address}
                        onChange={(value) => setPickupLocation({ ...pickupLocation, address: value })}
                        onPlaceSelected={(place) => {
                          setPickupLocation({
                            ...pickupLocation,
                            address: place.address,
                            lat: place.lat,
                            lng: place.lng,
                          });
                        }}
                        placeholder="Search for pickup location..."
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="pickup-name">Contact Name</Label>
                      <Input
                        id="pickup-name"
                        placeholder="Juan Dela Cruz"
                        className="mt-1.5"
                        value={pickupLocation.contactName}
                        onChange={(e) => setPickupLocation({ ...pickupLocation, contactName: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="pickup-phone">Phone</Label>
                      <Input
                        id="pickup-phone"
                        placeholder="09171234567"
                        className="mt-1.5"
                        value={pickupLocation.contactPhone}
                        onChange={(e) => setPickupLocation({ ...pickupLocation, contactPhone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="pickup-instructions">Instructions (Optional)</Label>
                    <Input
                      id="pickup-instructions"
                      placeholder="e.g., Ring doorbell twice"
                      className="mt-1.5"
                      value={pickupLocation.instructions}
                      onChange={(e) => setPickupLocation({ ...pickupLocation, instructions: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Dropoff Locations */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <Label className="text-base font-semibold">
                    {deliveryType === 'multi' ? 'Dropoff Locations' : 'Dropoff Location'}
                  </Label>
                </div>

                {dropoffStops.map((stop, index) => (
                  <div key={stop.id} className="space-y-3 pl-10 relative">
                    {deliveryType === 'multi' && dropoffStops.length > 1 && (
                      <div className="absolute -left-2 top-0 flex items-center gap-2">
                        <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center">
                          {index + 1}
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => removeDropoffStop(stop.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}

                    <div>
                      <Label htmlFor={`dropoff-address-${stop.id}`}>Address</Label>
                      <div className="mt-1.5">
                        <GooglePlacesAutocomplete
                          id={`dropoff-address-${stop.id}`}
                          value={stop.address}
                          onChange={(value) => {
                            const updatedStops = [...dropoffStops];
                            const idx = updatedStops.findIndex(s => s.id === stop.id);
                            updatedStops[idx] = { ...updatedStops[idx], address: value };
                            setDropoffStops(updatedStops);
                          }}
                          onPlaceSelected={(place) => {
                            const updatedStops = [...dropoffStops];
                            const idx = updatedStops.findIndex(s => s.id === stop.id);
                            updatedStops[idx] = {
                              ...updatedStops[idx],
                              address: place.address,
                              lat: place.lat,
                              lng: place.lng,
                            };
                            setDropoffStops(updatedStops);
                          }}
                          placeholder="Search for dropoff location..."
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor={`dropoff-name-${stop.id}`}>Contact Name</Label>
                        <Input
                          id={`dropoff-name-${stop.id}`}
                          placeholder="Maria Santos"
                          className="mt-1.5"
                          value={stop.contactName}
                          onChange={(e) => {
                            const updatedStops = [...dropoffStops];
                            const idx = updatedStops.findIndex(s => s.id === stop.id);
                            updatedStops[idx] = { ...updatedStops[idx], contactName: e.target.value };
                            setDropoffStops(updatedStops);
                          }}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`dropoff-phone-${stop.id}`}>Phone</Label>
                        <Input
                          id={`dropoff-phone-${stop.id}`}
                          placeholder="09181234567"
                          className="mt-1.5"
                          value={stop.contactPhone}
                          onChange={(e) => {
                            const updatedStops = [...dropoffStops];
                            const idx = updatedStops.findIndex(s => s.id === stop.id);
                            updatedStops[idx] = { ...updatedStops[idx], contactPhone: e.target.value };
                            setDropoffStops(updatedStops);
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor={`dropoff-instructions-${stop.id}`}>Instructions (Optional)</Label>
                      <Input
                        id={`dropoff-instructions-${stop.id}`}
                        placeholder="e.g., Leave at reception"
                        className="mt-1.5"
                        value={stop.instructions}
                        onChange={(e) => {
                          const updatedStops = [...dropoffStops];
                          const idx = updatedStops.findIndex(s => s.id === stop.id);
                          updatedStops[idx] = { ...updatedStops[idx], instructions: e.target.value };
                          setDropoffStops(updatedStops);
                        }}
                      />
                    </div>

                    {index < dropoffStops.length - 1 && <Separator className="my-4" />}
                  </div>
                ))}

                {deliveryType === 'multi' && dropoffStops.length < 10 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="ml-10"
                    onClick={addDropoffStop}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Stop
                  </Button>
                )}
              </div>

              <Separator />

              {/* Package Details */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">Package Details</Label>

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="package-description">Description</Label>
                    <Input
                      id="package-description"
                      placeholder="e.g., Documents, Electronics, Food"
                      className="mt-1.5"
                      value={packageDetails.description}
                      onChange={(e) => setPackageDetails({ ...packageDetails, description: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="package-weight">Weight (kg)</Label>
                      <Input
                        id="package-weight"
                        type="number"
                        step="0.1"
                        placeholder="0.5"
                        className="mt-1.5"
                        value={packageDetails.weight || ''}
                        onChange={(e) => setPackageDetails({ ...packageDetails, weight: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="package-value">Value (₱)</Label>
                      <Input
                        id="package-value"
                        type="number"
                        step="0.01"
                        placeholder="1000.00"
                        className="mt-1.5"
                        value={packageDetails.value || ''}
                        onChange={(e) => setPackageDetails({ ...packageDetails, value: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Payment Options */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">Payment</Label>

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="payment-by">Who Pays?</Label>
                    <Select 
                      value={paymentDetails.paymentBy}
                      onValueChange={(value) => setPaymentDetails({ ...paymentDetails, paymentBy: value as 'sender' | 'recipient' })}
                    >
                      <SelectTrigger id="payment-by" className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sender">Sender</SelectItem>
                        <SelectItem value="recipient">Recipient</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="payment-method">Payment Method</Label>
                    <Select 
                      value={paymentDetails.paymentMethod}
                      onValueChange={(value) => setPaymentDetails({ ...paymentDetails, paymentMethod: value as 'cash' | 'creditCard' | 'debitCard' | 'maya' })}
                    >
                      <SelectTrigger id="payment-method" className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="creditCard">Credit Card</SelectItem>
                        <SelectItem value="debitCard">Debit Card</SelectItem>
                        <SelectItem value="maya">Maya</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Schedule Option */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Schedule for Later</Label>
                    <p className="text-sm text-muted-foreground">
                      Set a future pickup time
                    </p>
                  </div>
                  <Switch checked={isScheduled} onCheckedChange={setIsScheduled} />
                </div>

                {isScheduled && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="schedule-date">Date</Label>
                      <Input
                        id="schedule-date"
                        type="date"
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="schedule-time">Time</Label>
                      <Input
                        id="schedule-time"
                        type="time"
                        className="mt-1.5"
                      />
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Price Estimate */}
              <Card className="bg-muted/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Estimated Cost</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Base Fee</span>
                    <span className="font-medium">
                      {selectedVehicle ? `₱${vehicleTypes.find(v => v.id === selectedVehicle)?.base_price || 0}` : '₱--'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Distance</span>
                    <span className="font-medium">{routeDistance > 0 ? `${routeDistance} km` : '-- km'}</span>
                  </div>
                  {deliveryType === 'multi' && dropoffStops.length > 1 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Additional Stops ({dropoffStops.length - 1})</span>
                      <span className="font-medium">₱{(dropoffStops.length - 1) * 30}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between">
                    <span className="font-semibold">Total</span>
                    <span className="text-xl font-bold text-primary">
                      {estimatedCost > 0 ? `₱${estimatedCost}` : '₱--'}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Submit Button */}
              <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating Delivery...
                  </>
                ) : (
                  <>
                    <Package className="h-4 w-4 mr-2" />
                    Create Delivery
                  </>
                )}
              </Button>
            </form>
          </Tabs>
          </div>
        </div>
      </div>

      {/* Sidebar Toggle Button */}
      <button
        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        className={`fixed ${
          isSidebarCollapsed ? 'left-0' : 'left-[min(30vw,450px)] xl:left-[420px]'
        } top-1/2 -translate-y-1/2 z-20 bg-background border border-l-0 rounded-r-md p-2 hover:bg-muted transition-all duration-300 shadow-lg`}
        aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isSidebarCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
      </button>

      {/* Map Container - Dominant Right Side */}
      <div className="flex-1 relative">
        {/* Memoize DeliveryMap to prevent re-renders on form input changes */}
        {useMemo(() => (
          <DeliveryMap 
            pickup={demoPickup}
            dropoffs={demoDropoffs}
            className="absolute inset-0"
            onRouteCalculated={handleRouteCalculated}
          />
        ), [demoPickup, demoDropoffs, handleRouteCalculated])}
        
        {/* Floating Controls on Map */}
        <div className="absolute top-4 left-4 bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-xs font-medium">Pickup</span>
            </div>
            <div className="w-px h-4 bg-border"></div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-xs font-medium">Dropoff</span>
            </div>
          </div>
        </div>

        {/* Quick Stats Overlay */}
        {(demoPickup || demoDropoffs.length > 0) && (
          <div className="absolute bottom-4 left-4 bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg p-4 min-w-[280px]">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Estimated Distance</span>
                <span className="font-semibold">{routeDistance > 0 ? `${routeDistance} km` : '-- km'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Estimated Time</span>
                <span className="font-semibold">{routeDuration > 0 ? `${routeDuration} min` : '-- min'}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Estimated Cost</span>
                <span className="text-lg font-bold text-primary">
                  {estimatedCost > 0 ? `₱${estimatedCost}` : '₱--'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/20">
              <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <DialogTitle className="text-center">Delivery Created Successfully!</DialogTitle>
            <DialogDescription className="text-center">
              Your delivery has been saved and is ready for dispatch.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Tracking Number</p>
              <p className="text-lg font-mono font-semibold">
                {createdDeliveryId ? `SD${createdDeliveryId.slice(0, 8)}` : 'N/A'}
              </p>
            </div>
            <Separator />
            <p className="text-sm text-center text-muted-foreground">
              What would you like to do next?
            </p>
          </div>
          <DialogFooter className="flex-col sm:flex-col gap-2">
            <Button
              className="w-full"
              onClick={() => {
                setShowSuccessDialog(false);
                router.push('/business/dispatch');
              }}
            >
              <Truck className="h-4 w-4 mr-2" />
              Go to Dispatch
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setShowSuccessDialog(false);
                // Reset form
                setPickupLocation({ address: '', contactName: '', contactPhone: '', instructions: '' });
                setDropoffStops([{ id: '1', address: '', contactName: '', contactPhone: '', instructions: '' }]);
                setSelectedVehicle('');
                setRouteDistance(0);
                setRouteDuration(0);
                setEstimatedCost(0);
                setIsScheduled(false);
                setPackageDetails({ description: '', weight: 0, value: 0 });
                setPaymentDetails({ paymentBy: 'sender', paymentMethod: 'cash' });
              }}
            >
              Create Another Delivery
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
