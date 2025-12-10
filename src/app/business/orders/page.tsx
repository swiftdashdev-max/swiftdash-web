'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { bookDelivery, createMultiStopDelivery } from '@/lib/supabase/edge-functions';
import { useVehicleTypes } from '@/hooks/use-vehicle-types';
import { useDeliveryPerformance, useNetworkOptimization } from '@/hooks/use-delivery-performance';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  Receipt,
  Trash2,
  ChevronDown,
  ChevronUp,
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

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export default function OrdersPage() {
  const router = useRouter();
  const supabase = createClient();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [deliveryType, setDeliveryType] = useState<'single' | 'multi'>('single');
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledTime, setScheduledTime] = useState<string>('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isOrderDetailsExpanded, setIsOrderDetailsExpanded] = useState(false);
  const [showOrderDetailsModal, setShowOrderDetailsModal] = useState(false);
  const [routeDistance, setRouteDistance] = useState<number>(0);
  const [routeDuration, setRouteDuration] = useState<number>(0);
  
  // Package details state
  const [packageDetails, setPackageDetails] = useState({
    description: '',
    weight: 0,
    value: 0
  });
  
  // Order items state (Shipday-style)
  const [orderItems, setOrderItems] = useState<OrderItem[]>([
    { id: '1', name: '', quantity: 1, unitPrice: 0 }
  ]);
  const [taxPercentage, setTaxPercentage] = useState<number>(0);
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [tipAmount, setTipAmount] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  
  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [createdDeliveryId, setCreatedDeliveryId] = useState<string | null>(null);
  
  // Use cached vehicle types hook
  const { vehicleTypes, loading: loadingVehicles, error: vehicleError } = useVehicleTypes();
  
  // Initialize performance optimizations
  const { clearCaches, getCacheStats, logPerformance } = useDeliveryPerformance({
    preloadCommonRoutes: true,
    enablePerformanceLogging: process.env.NODE_ENV === 'development',
  });
  
  // Network optimization
  const { getOptimizedSettings, isSlowConnection } = useNetworkOptimization();
  
  // Get optimized settings based on network
  const optimizedSettings = useMemo(() => getOptimizedSettings(), [getOptimizedSettings]);
  
  // Initialize user and business data
  useEffect(() => {
    const initializeUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/business/login');
          return;
        }

        setUserId(user.id);

        // Get user's business_id from user_profiles
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('business_id')
          .eq('id', user.id)
          .single();

        if (userProfile?.business_id) {
          setBusinessId(userProfile.business_id);
        }
      } catch (error) {
        console.error('Error initializing user:', error);
      }
    };

    initializeUser();
  }, [router]);
  
  // No vehicle selection on orders page - assignment happens in dispatch
  
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
  }, [dropoffStops.map(s => `${s.lat},${s.lng},${s.address}`).join('|')]);

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

  // Order Items Management
  const addOrderItem = () => {
    const newItem: OrderItem = {
      id: Date.now().toString(),
      name: '',
      quantity: 1,
      unitPrice: 0
    };
    setOrderItems([...orderItems, newItem]);
  };

  const removeOrderItem = (id: string) => {
    if (orderItems.length > 1) {
      setOrderItems(orderItems.filter(item => item.id !== id));
    }
  };

  const updateOrderItem = (id: string, field: keyof OrderItem, value: string | number) => {
    setOrderItems(orderItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  // Calculate Order Totals
  const calculateOrderTotals = () => {
    const subtotal = orderItems.reduce((sum, item) => {
      return sum + (item.quantity * item.unitPrice);
    }, 0);
    
    const tax = subtotal * (taxPercentage / 100);
    const grandTotal = subtotal + tax + deliveryFee + tipAmount - discountAmount;
    
    return {
      subtotal,
      tax,
      grandTotal: Math.max(0, grandTotal)
    };
  };

  const orderTotals = calculateOrderTotals();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsSubmitting(true);

      // Validation - vehicle assignment will happen in dispatch page
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

      console.log('📦 Creating delivery via direct database insert');

      // Direct database insert - orders created without vehicle assignment
      const deliveryData = {
        business_id: businessId,
        customer_id: userId,
        status: 'pending',
        
        // Pickup
        pickup_address: pickupLocation.address,
        pickup_latitude: pickupLocation.lat,
        pickup_longitude: pickupLocation.lng,
        pickup_contact_name: pickupLocation.contactName,
        pickup_contact_phone: pickupLocation.contactPhone,
        pickup_instructions: pickupLocation.instructions || null,
        
        // Dropoff (first stop)
        delivery_address: dropoffStops[0].address,
        delivery_latitude: dropoffStops[0].lat,
        delivery_longitude: dropoffStops[0].lng,
        delivery_contact_name: dropoffStops[0].contactName,
        delivery_contact_phone: dropoffStops[0].contactPhone,
        delivery_instructions: dropoffStops[0].instructions || null,
        
        // Package
        package_description: packageDetails.description || 'Package delivery',
        package_weight: packageDetails.weight || null,
        package_value: packageDetails.value || null,
        
        // Payment - will be set during dispatch
        payment_by: null,
        payment_method: null,
        payment_status: 'pending',
        
        // Route (estimated)
        distance_km: routeDistance || null,
        estimated_duration: routeDuration || null,
        
        // Vehicle assignment - null until dispatch assigns
        vehicle_type_id: null,
        driver_id: null,
        fleet_vehicle_id: null,
        
        // Pricing - will be calculated during dispatch
        total_price: null,
        delivery_fee: null,
        total_amount: null,
        
        // Scheduling
        is_scheduled: isScheduled || false,
        scheduled_pickup_time: isScheduled ? scheduledTime : null,
      };

      const { data: createdDelivery, error: insertError } = await supabase
        .from('deliveries')
        .insert(deliveryData)
        .select()
        .single();

      if (insertError) {
        console.error('❌ Database insert error:', insertError);
        throw new Error(insertError.message || 'Failed to create delivery');
      }
      
      console.log('✅ Delivery created:', createdDelivery);

      // Extract delivery ID from response (structure may vary)
      const deliveryId = createdDelivery?.delivery?.id || createdDelivery?.id;
      
      // Redirect to dispatch page for vehicle/driver assignment
      router.push('/business/dispatch');

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
    // Pricing will be calculated in dispatch page based on vehicle selection
  }, []);

  // Trigger map resize when sidebar state changes
  React.useEffect(() => {
    // Small delay to ensure CSS transition completes before resize
    const timer = setTimeout(() => {
      // Trigger a custom event that the map can listen to
      window.dispatchEvent(new Event('resize'));
    }, 350); // Slightly longer than the 300ms transition

    return () => clearTimeout(timer);
  }, [isSidebarCollapsed, isOrderDetailsExpanded]);

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
      
      <div className="flex h-screen w-screen fixed inset-0 overflow-hidden">
        {/* Sidebar - Order Creation Form */}
      <div 
        className={`${
          isSidebarCollapsed 
            ? 'w-0' 
            : isOrderDetailsExpanded 
              ? 'w-[65%] min-w-[800px]' 
              : 'w-[30%] min-w-[360px] max-w-[450px]'
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

              {/* Order Details - Expandable */}
              <Collapsible
                open={isOrderDetailsExpanded}
                onOpenChange={setIsOrderDetailsExpanded}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-base font-semibold flex items-center gap-2">
                      <Receipt className="h-4 w-4" />
                      Order Details (Optional)
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Add items, prices, tax, and fees like Shipday
                    </p>
                  </div>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm">
                      {isOrderDetailsExpanded ? (
                        <>
                          <ChevronUp className="h-4 w-4 mr-2" />
                          Collapse
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4 mr-2" />
                          Expand
                        </>
                      )}
                    </Button>
                  </CollapsibleTrigger>
                </div>

                <CollapsibleContent className="space-y-4">
                  {/* Order Items Table */}
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[40%]">Item Name</TableHead>
                          <TableHead className="w-[15%]">Qty</TableHead>
                          <TableHead className="w-[20%]">Unit Price (₱)</TableHead>
                          <TableHead className="w-[20%] text-right">Total (₱)</TableHead>
                          <TableHead className="w-[5%]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orderItems.map((item, index) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <Input
                                placeholder="e.g., Chicken Adobo"
                                value={item.name}
                                onChange={(e) => updateOrderItem(item.id, 'name', e.target.value)}
                                className="h-9"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => updateOrderItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                                className="h-9"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.unitPrice}
                                onChange={(e) => updateOrderItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                className="h-9"
                              />
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              ₱{(item.quantity * item.unitPrice).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              {orderItems.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeOrderItem(item.id)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addOrderItem}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>

                  <Separator />

                  {/* Order Summary Calculations */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="tax-percentage">Tax (%)</Label>
                        <Input
                          id="tax-percentage"
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          placeholder="0"
                          value={taxPercentage || ''}
                          onChange={(e) => setTaxPercentage(parseFloat(e.target.value) || 0)}
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <Label htmlFor="delivery-fee-override">Delivery Fee (₱)</Label>
                        <Input
                          id="delivery-fee-override"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Auto-calculated"
                          value={deliveryFee || ''}
                          onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
                          className="mt-1.5"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="tip-amount">Tip (₱)</Label>
                        <Input
                          id="tip-amount"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0"
                          value={tipAmount || ''}
                          onChange={(e) => setTipAmount(parseFloat(e.target.value) || 0)}
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <Label htmlFor="discount-amount">Discount (₱)</Label>
                        <Input
                          id="discount-amount"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0"
                          value={discountAmount || ''}
                          onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                          className="mt-1.5"
                        />
                      </div>
                    </div>

                    <Separator />

                    {/* Order Total Summary */}
                    <Card className="bg-muted/30">
                      <CardContent className="pt-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span className="font-medium">₱{orderTotals.subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Tax ({taxPercentage}%)</span>
                          <span className="font-medium">₱{orderTotals.tax.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Delivery Fee</span>
                          <span className="font-medium">₱{deliveryFee.toFixed(2)}</span>
                        </div>
                        {tipAmount > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Tip</span>
                            <span className="font-medium">₱{tipAmount.toFixed(2)}</span>
                          </div>
                        )}
                        {discountAmount > 0 && (
                          <div className="flex justify-between text-sm text-green-600">
                            <span>Discount</span>
                            <span className="font-medium">-₱{discountAmount.toFixed(2)}</span>
                          </div>
                        )}
                        <Separator />
                        <div className="flex justify-between">
                          <span className="font-semibold">Grand Total</span>
                          <span className="text-xl font-bold text-primary">
                            ₱{orderTotals.grandTotal.toFixed(2)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </CollapsibleContent>
              </Collapsible>

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
                        value={scheduledTime.split('T')[0] || ''}
                        onChange={(e) => {
                          const date = e.target.value;
                          const time = scheduledTime.split('T')[1] || '00:00';
                          setScheduledTime(`${date}T${time}`);
                        }}
                      />
                    </div>
                    <div>
                      <Label htmlFor="schedule-time">Time</Label>
                      <Input
                        id="schedule-time"
                        type="time"
                        className="mt-1.5"
                        value={scheduledTime.split('T')[1] || ''}
                        onChange={(e) => {
                          const date = scheduledTime.split('T')[0] || new Date().toISOString().split('T')[0];
                          const time = e.target.value;
                          setScheduledTime(`${date}T${time}`);
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Submit Button - Pricing calculated after vehicle assignment in dispatch */}
              <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating Order...
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Create Order & Go to Dispatch
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
          isSidebarCollapsed 
            ? 'left-0' 
            : isOrderDetailsExpanded
              ? 'left-[min(65vw,800px)]'
              : 'left-[min(30vw,450px)] xl:left-[420px]'
        } top-1/2 -translate-y-1/2 z-20 bg-background border border-l-0 rounded-r-md p-2 hover:bg-muted transition-all duration-300 shadow-lg`}
        aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isSidebarCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
      </button>

      {/* Map Container - Dominant Right Side */}
      <div className="flex-1 relative overflow-hidden" style={{ touchAction: 'none' }}>
        {/* Optimized DeliveryMap - persistent map instance */}
        <DeliveryMap 
          pickup={demoPickup}
          dropoffs={demoDropoffs}
          className="absolute inset-0 w-full h-full"
          onRouteCalculated={handleRouteCalculated}
        />
        
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
          {/* Performance indicator for slow connections */}
          {isSlowConnection() && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
              <span>Optimizing for slow connection</span>
            </div>
          )}
        </div>

        {/* Quick Stats Overlay - No pricing shown, calculated in dispatch */}
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
                setIsScheduled(false);
                setPackageDetails({ description: '', weight: 0, value: 0 });
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
