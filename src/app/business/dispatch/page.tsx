'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { pairDriver } from '@/lib/supabase/edge-functions';
import { useUserContext } from '@/lib/supabase/user-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Package,
  MapPin,
  Navigation,
  Clock,
  Truck,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  MoreVertical,
  UserCheck,
  Users,
  Zap,
  Calendar,
  Edit,
  X,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  Building2,
  Store,
} from 'lucide-react';

interface Delivery {
  id: string;
  tracking_number: string;
  status: string;
  delivery_type: 'single' | 'multi';
  pickup_address: string;
  dropoff_address: string;
  dropoff_stops?: any[];
  vehicle_type_id: string;
  distance_km: number;
  estimated_distance?: number;
  total_price: number;
  estimated_cost?: number;
  is_scheduled: boolean;
  scheduled_pickup_time?: string;
  created_at: string;
  driver_id?: string;
}

interface Driver {
  id: string;
  vehicle_type_id: string;
  is_online: boolean;
  rating?: number;
  vehicle_model?: string;
  plate_number?: string;
  employment_type?: string;
  managed_by_business_id?: string;
  full_name?: string;
  phone?: string;
}

interface FleetVehicle {
  id: string;
  vehicle_type_id: string;
  vehicle_model: string;
  plate_number: string;
  assigned_driver_id?: string;
  driver_name?: string;
}

interface VehicleType {
  id: string;
  name: string;
  base_price: number;
  price_per_km: number;
  max_weight_kg: number;
  description?: string;
}

interface PricingDetails {
  base_price: number;
  distance_price: number;
  total: number;
  vehicle_type: string;
}

export default function DispatchPage() {
  const router = useRouter();
  const supabase = createClient();
  const { businessId, loading: userLoading } = useUserContext();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [realtimeUpdates, setRealtimeUpdates] = useState(0); // Track real-time updates
  const [selectedDeliveries, setSelectedDeliveries] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignmentMode, setAssignmentMode] = useState<'auto' | 'manual'>('auto');
  const [selectedDriver, setSelectedDriver] = useState<string>('');
  const [assigning, setAssigning] = useState(false);
  
  // Fleet vs Marketplace
  const [driverSource, setDriverSource] = useState<'fleet' | 'marketplace'>('fleet');
  const [fleetVehicles, setFleetVehicles] = useState<FleetVehicle[]>([]);
  const [selectedFleetVehicle, setSelectedFleetVehicle] = useState<string>('');
  
  // Pricing
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [selectedVehicleType, setSelectedVehicleType] = useState<string>('');
  const [pricingDetails, setPricingDetails] = useState<PricingDetails | null>(null);
  
  // Payment (for marketplace only)
  const [paymentBy, setPaymentBy] = useState<'sender' | 'recipient'>('sender');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'creditCard' | 'debitCard' | 'maya'>('cash');

  useEffect(() => {
    if (!userLoading && businessId) {
      fetchData();
      
      // Set up real-time subscriptions
      const deliveriesChannel = supabase
        .channel('deliveries-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'deliveries',
            filter: `business_id=eq.${businessId}`,
          },
          (payload) => {
            console.log('🔄 Deliveries real-time update:', payload);
            setRealtimeUpdates(prev => prev + 1);
            // Refetch data when deliveries change
            fetchData();
          }
        )
        .subscribe();

      const driversChannel = supabase
        .channel('drivers-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'driver_profiles',
          },
          (payload) => {
            console.log('🔄 Drivers real-time update:', payload);
            setRealtimeUpdates(prev => prev + 1);
            // Update drivers list in real-time
            if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
              const updatedDriverId = payload.new.id;
              const updatedIsOnline = payload.new.is_online;
              
              if (updatedIsOnline === true) {
                // Fetch the complete driver data
                supabase
                  .from('driver_profiles')
                  .select(`
                    id,
                    vehicle_type_id,
                    is_online,
                    rating,
                    vehicle_model,
                    plate_number,
                    employment_type,
                    managed_by_business_id
                  `)
                  .eq('id', updatedDriverId)
                  .eq('is_online', true)
                  .single()
                  .then(async ({ data, error }) => {
                    if (!error && data) {
                      // Fetch user profile for this driver
                      const { data: userProfile } = await supabase
                        .from('user_profiles')
                        .select('first_name, last_name, phone_number')
                        .eq('id', data.id)
                        .single();
                        
                      const driverWithProfile: Driver = {
                        ...data,
                        full_name: userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : `Driver ${data.id.substring(0, 8)}`,
                        phone: userProfile?.phone_number || 'N/A'
                      };
                      
                      setDrivers(prev => {
                        const filtered = prev.filter(d => d.id !== updatedDriverId);
                        return [...filtered, driverWithProfile];
                      });
                    }
                  });
              } else {
                // Remove driver from list if not online
                setDrivers(prev => prev.filter(d => d.id !== updatedDriverId));
              }
            } else if (payload.eventType === 'DELETE') {
              setDrivers(prev => prev.filter(d => d.id !== payload.old.id));
            }
          }
        )
        .subscribe();

      // Cleanup subscriptions on unmount
      return () => {
        supabase.removeChannel(deliveriesChannel);
        supabase.removeChannel(driversChannel);
      };
    }
  }, [userLoading, businessId]);

  const fetchData = async () => {
    try {
      setLoading(true);

      if (!businessId) {
        console.error('❌ No business_id available');
        setLoading(false);
        return;
      }

      // Fetch deliveries (pending and in-progress)
      // Include all active delivery statuses so they don't disappear when driver updates status
      const { data: deliveriesData, error: deliveriesError } = await supabase
        .from('deliveries')
        .select('*')
        .eq('business_id', businessId)
        .in('status', [
          'pending',
          'driver_offered',
          'driver_assigned',
          'going_to_pickup',
          'arrived_at_pickup',
          'pickup_arrived',
          'picked_up',
          'going_to_dropoff',
          'arrived_at_dropoff',
          'dropoff_arrived'
        ])
        .order('created_at', { ascending: false });

      if (deliveriesError) {
        console.error('❌ Error fetching deliveries:', deliveriesError);
      } else {
        setDeliveries(deliveriesData || []);
        console.log('📦 Deliveries loaded:', deliveriesData);
      }

      // Fetch available drivers - just driver_profiles data for now
      const { data: driversData, error: driversError } = await supabase
        .from('driver_profiles')
        .select(`
          id,
          vehicle_type_id,
          is_online,
          rating,
          vehicle_model,
          plate_number,
          employment_type,
          managed_by_business_id
        `)
        .eq('is_online', true);

      if (driversError) {
        console.error('❌ Error fetching drivers:', driversError);
        console.error('❌ Driver error details:', JSON.stringify(driversError, null, 2));
      } else {
        console.log('🚗 Drivers loaded:', driversData);
        console.log('🚗 Number of online drivers:', driversData?.length || 0);
        
        // Fetch user profile data for each driver
        const driversWithProfiles: Driver[] = [];
        if (driversData && driversData.length > 0) {
          for (const driver of driversData) {
            try {
              // Try user_profiles with correct column names
              const { data: userProfile } = await supabase
                .from('user_profiles')
                .select('first_name, last_name, phone_number')
                .eq('id', driver.id)
                .single();
                
              driversWithProfiles.push({
                ...driver,
                full_name: userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : `Driver ${driver.id.substring(0, 8)}`,
                phone: userProfile?.phone_number || 'N/A'
              });
            } catch (profileError) {
              console.warn(`Could not fetch profile for driver ${driver.id}`);
              driversWithProfiles.push({
                ...driver,
                full_name: `Driver ${driver.id.substring(0, 8)}`,
                phone: 'N/A'
              });
            }
          }
        }
        
        setDrivers(driversWithProfiles);
      }

      // Fetch vehicle types for pricing
      const { data: vehicleTypesData, error: vehicleTypesError } = await supabase
        .from('vehicle_types')
        .select('id, name, base_price, price_per_km, max_weight_kg, description')
        .order('base_price', { ascending: true });

      if (vehicleTypesError) {
        console.error('❌ Error fetching vehicle types:', vehicleTypesError);
      } else {
        setVehicleTypes(vehicleTypesData || []);
        console.log('🚚 Vehicle types loaded:', vehicleTypesData);
      }

      // Fetch business fleet vehicles
      const { data: fleetData, error: fleetError } = await supabase
        .from('business_fleet')
        .select('id, vehicle_type_id, vehicle_model, plate_number, assigned_driver_id')
        .eq('business_id', businessId);

      if (fleetError) {
        console.error('❌ Error fetching fleet:', fleetError);
      } else {
        // Fetch driver names for assigned drivers
        const fleetWithDrivers: FleetVehicle[] = [];
        if (fleetData) {
          for (const vehicle of fleetData) {
            let driverName = 'Unassigned';
            if (vehicle.assigned_driver_id) {
              const { data: driverProfile } = await supabase
                .from('user_profiles')
                .select('first_name, last_name')
                .eq('id', vehicle.assigned_driver_id)
                .single();
              if (driverProfile) {
                driverName = `${driverProfile.first_name} ${driverProfile.last_name}`;
              }
            }
            fleetWithDrivers.push({
              ...vehicle,
              driver_name: driverName
            });
          }
        }
        setFleetVehicles(fleetWithDrivers);
        console.log('🚗 Fleet vehicles loaded:', fleetWithDrivers);
      }

    } catch (error) {
      console.error('❌ Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDelivery = (id: string) => {
    setSelectedDeliveries(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const visibleIds = filteredDeliveries.map(d => d.id);
      setSelectedDeliveries(visibleIds);
    } else {
      setSelectedDeliveries([]);
    }
  };

  // Calculate pricing based on vehicle type and distance
  const calculatePricing = (vehicleTypeId: string, distanceKm: number): PricingDetails | null => {
    const vehicleType = vehicleTypes.find(vt => vt.id === vehicleTypeId);
    if (!vehicleType) return null;

    const base = vehicleType.base_price;
    const distancePrice = distanceKm * vehicleType.price_per_km;
    const total = base + distancePrice;

    return {
      base_price: base,
      distance_price: distancePrice,
      total: total,
      vehicle_type: vehicleType.name
    };
  };

  // Update pricing when vehicle type changes
  useEffect(() => {
    if (selectedVehicleType && selectedDeliveries.length === 1) {
      const delivery = deliveries.find(d => d.id === selectedDeliveries[0]);
      if (delivery && delivery.distance_km) {
        const pricing = calculatePricing(selectedVehicleType, delivery.distance_km);
        setPricingDetails(pricing);
      }
    } else {
      setPricingDetails(null);
    }
  }, [selectedVehicleType, selectedDeliveries, deliveries]);

  // Update vehicle type when fleet vehicle changes
  useEffect(() => {
    if (selectedFleetVehicle) {
      const vehicle = fleetVehicles.find(v => v.id === selectedFleetVehicle);
      if (vehicle) {
        setSelectedVehicleType(vehicle.vehicle_type_id);
      }
    }
  }, [selectedFleetVehicle, fleetVehicles]);

  const handleAssign = () => {
    if (selectedDeliveries.length === 0) {
      alert('Please select at least one delivery to assign');
      return;
    }
    // Reset assignment state
    setSelectedDriver('');
    setDriverSource('fleet');
    setSelectedFleetVehicle('');
    setSelectedVehicleType('');
    setPricingDetails(null);
    setPaymentBy('sender');
    setPaymentMethod('cash');
    setShowAssignModal(true);
  };

  const handleAutoAssign = async () => {
    try {
      setAssigning(true);

      // Use Edge Function for auto-assignment
      for (const deliveryId of selectedDeliveries) {
        try {
          const result = await pairDriver(deliveryId);
          console.log(`✅ Successfully assigned driver to delivery ${deliveryId}:`, result);
        } catch (err) {
          console.error(`❌ Error calling pair-driver for ${deliveryId}:`, err);
        }
      }

      // Refresh data and close modal
      await fetchData();
      setShowAssignModal(false);
      setSelectedDeliveries([]);
      alert(`Successfully assigned ${selectedDeliveries.length} delivery(ies)`);
    } catch (error) {
      console.error('❌ Error auto-assigning:', error);
      alert('Failed to auto-assign deliveries');
    } finally {
      setAssigning(false);
    }
  };

  const handleManualAssign = async () => {
    // Validation
    if (driverSource === 'fleet') {
      if (!selectedFleetVehicle) {
        alert('Please select a fleet vehicle');
        return;
      }
    } else {
      if (!selectedDriver) {
        alert('Please select a marketplace driver');
        return;
      }
      if (!selectedVehicleType) {
        alert('Please select a vehicle type for pricing');
        return;
      }
    }

    // Only allow single delivery assignment with this modal (bulk assignment can be added later)
    if (selectedDeliveries.length !== 1) {
      alert('Please select exactly one delivery for manual assignment');
      return;
    }

    try {
      setAssigning(true);
      const deliveryId = selectedDeliveries[0];
      const delivery = deliveries.find(d => d.id === deliveryId);
      
      if (!delivery) {
        throw new Error('Delivery not found');
      }

      // Get current user ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Prepare parameters based on driver source
      let assignParams: any = {
        delivery_id: deliveryId,
        assigned_by: user.id,
        assignment_type: 'manual',
        driver_source: driverSource,
      };

      if (driverSource === 'fleet') {
        // Fleet assignment
        const fleetVehicle = fleetVehicles.find(v => v.id === selectedFleetVehicle);
        if (!fleetVehicle) {
          throw new Error('Fleet vehicle not found');
        }

        if (!fleetVehicle.assigned_driver_id) {
          throw new Error('Fleet vehicle has no assigned driver');
        }

        // Calculate pricing for internal tracking
        const pricing = calculatePricing(fleetVehicle.vehicle_type_id, delivery.distance_km || 0);

        assignParams = {
          ...assignParams,
          driver_id: fleetVehicle.assigned_driver_id,
          vehicle_type_id: fleetVehicle.vehicle_type_id,
          fleet_vehicle_id: fleetVehicle.id,
          total_price: pricing?.total || 0,
          delivery_fee: pricing?.total || 0,
          payment_by: null,
          payment_method: null,
        };

        console.log('🚛 Assigning fleet vehicle:', assignParams);
      } else {
        // Marketplace assignment
        const pricing = calculatePricing(selectedVehicleType, delivery.distance_km || 0);
        
        if (!pricing) {
          throw new Error('Could not calculate pricing');
        }

        assignParams = {
          ...assignParams,
          driver_id: selectedDriver,
          vehicle_type_id: selectedVehicleType,
          fleet_vehicle_id: null,
          total_price: pricing.total,
          delivery_fee: pricing.total,
          payment_by: paymentBy,
          payment_method: paymentMethod,
        };

        console.log('🏪 Assigning marketplace driver:', assignParams);
      }

      // Call edge function to assign driver
      console.log('📤 Sending assignment request:', assignParams);
      
      // Use fetch directly to get better error messages
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/assign-business-driver`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'apikey': supabaseAnonKey || '',
        },
        body: JSON.stringify(assignParams)
      });

      const data = await response.json();
      console.log('📥 Edge function response:', { status: response.status, data });

      if (!response.ok) {
        console.error('❌ Edge function error:', data);
        throw new Error(data.error || `Edge function returned ${response.status}`);
      }

      if (!data.success) {
        console.error('❌ Assignment failed:', data);
        throw new Error(data.error || 'Assignment failed');
      }

      console.log('✅ Successfully assigned delivery:', data);

      // Refresh data and close modal
      await fetchData();
      setShowAssignModal(false);
      setSelectedDeliveries([]);
      setSelectedDriver('');
      setSelectedFleetVehicle('');
      setSelectedVehicleType('');
      alert(`Successfully assigned delivery (${driverSource})`);
    } catch (error) {
      console.error('❌ Error manually assigning:', error);
      alert(`Failed to assign delivery: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setAssigning(false);
    }
  };

  const handleCancelDelivery = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this delivery?')) return;

    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/deliveries?id=eq.${id}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'cancelled',
            updated_at: new Date().toISOString(),
          }),
        }
      );

      fetchData();
    } catch (error) {
      console.error('❌ Error cancelling delivery:', error);
      alert('Failed to cancel delivery');
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string; icon: any }> = {
      pending: {
        variant: 'secondary',
        label: 'Pending',
        icon: AlertCircle,
      },
      driver_offered: {
        variant: 'outline',
        label: 'Driver Offered',
        icon: Clock,
      },
      driver_assigned: {
        variant: 'default',
        label: 'Driver Assigned',
        icon: CheckCircle2,
      },
    };

    const config = variants[status] || variants.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const filteredDeliveries = deliveries.filter(delivery => {
    const matchesSearch =
      (delivery.tracking_number?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (delivery.pickup_address?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (delivery.dropoff_address?.toLowerCase() || '').includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || delivery.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const pendingCount = deliveries.filter(d => d.status === 'pending').length;
  const offeredCount = deliveries.filter(d => d.status === 'driver_offered').length;
  const assignedCount = deliveries.filter(d => d.status === 'driver_assigned').length;

  if (loading || userLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading dispatch data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dispatch Center</h1>
          <p className="text-muted-foreground mt-2">
            Manage and assign deliveries to your fleet
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-muted text-sm">
            <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
            Live Updates {realtimeUpdates > 0 && `(${realtimeUpdates})`}
          </div>
          <Button onClick={() => router.push('/business/orders')}>
            <Package className="h-4 w-4 mr-2" />
            Create Delivery
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deliveries.length}</div>
            <p className="text-xs text-muted-foreground mt-1">All deliveries</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Dispatch</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Needs assignment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Driver Offered</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{offeredCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting acceptance</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Driver Assigned</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assignedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Ready to start</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions Bar */}
      {selectedDeliveries.length > 0 && (
        <Card className="border-primary">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary font-semibold">
                {selectedDeliveries.length}
              </div>
              <div>
                <h3 className="font-semibold">
                  {selectedDeliveries.length} delivery(ies) selected
                </h3>
                <p className="text-sm text-muted-foreground">
                  Choose an action to perform
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSelectedDeliveries([])}>
                Clear Selection
              </Button>
              <Button onClick={handleAssign}>
                <UserCheck className="h-4 w-4 mr-2" />
                Assign Drivers
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Deliveries</CardTitle>
              <CardDescription>
                View and manage all deliveries awaiting dispatch
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by tracking number or address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-auto">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="driver_offered">Offered</TabsTrigger>
                <TabsTrigger value="driver_assigned">Assigned</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={
                      filteredDeliveries.length > 0 &&
                      selectedDeliveries.length === filteredDeliveries.length
                    }
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Tracking #</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Pickup</TableHead>
                <TableHead>Dropoff</TableHead>
                <TableHead>Distance</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDeliveries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No deliveries found</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredDeliveries.map((delivery) => (
                  <TableRow
                    key={delivery.id}
                    className={selectedDeliveries.includes(delivery.id) ? 'bg-muted/50' : ''}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedDeliveries.includes(delivery.id)}
                        onCheckedChange={() => handleSelectDelivery(delivery.id)}
                      />
                    </TableCell>
                    <TableCell className="font-mono font-medium">
                      {delivery.tracking_number}
                    </TableCell>
                    <TableCell>{getStatusBadge(delivery.status)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {delivery.delivery_type === 'multi' ? (
                          <>
                            <Package className="h-3 w-3 mr-1" />
                            Multi-Stop
                          </>
                        ) : (
                          'Single'
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-green-600 flex-shrink-0" />
                        {delivery.pickup_address}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">
                      <div className="flex items-center gap-1">
                        <Navigation className="h-3 w-3 text-red-600 flex-shrink-0" />
                        {delivery.dropoff_address}
                      </div>
                    </TableCell>
                    <TableCell>{(delivery.distance_km || delivery.estimated_distance || 0).toFixed(1)} km</TableCell>
                    <TableCell className="font-semibold">₱{delivery.total_price || delivery.estimated_cost || 0}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(delivery.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedDeliveries([delivery.id]);
                              handleAssign();
                            }}
                          >
                            <UserCheck className="h-4 w-4 mr-2" />
                            Assign Driver
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Details
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleCancelDelivery(delivery.id)}
                          >
                            <X className="h-4 w-4 mr-2" />
                            Cancel Delivery
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Assignment Modal */}
      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign Delivery</DialogTitle>
            <DialogDescription>
              {selectedDeliveries.length} delivery selected. Configure assignment details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Assignment Mode */}
            <div className="grid gap-3">
              <Card
                className={`cursor-pointer transition-all ${
                  assignmentMode === 'auto'
                    ? 'border-primary bg-primary/5'
                    : 'hover:border-primary/50'
                }`}
                onClick={() => setAssignmentMode('auto')}
              >
                <CardContent className="flex items-start gap-3 p-4">
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary">
                    <Zap className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold mb-1">Auto Assign</h4>
                    <p className="text-sm text-muted-foreground">
                      System automatically assigns best available drivers
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card
                className={`cursor-pointer transition-all ${
                  assignmentMode === 'manual'
                    ? 'border-primary bg-primary/5'
                    : 'hover:border-primary/50'
                }`}
                onClick={() => setAssignmentMode('manual')}
              >
                <CardContent className="flex items-start gap-3 p-4">
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary">
                    <Users className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold mb-1">Manual Assign</h4>
                    <p className="text-sm text-muted-foreground">
                      Manually configure vehicle, driver, and pricing
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Manual Assignment Configuration */}
            {assignmentMode === 'manual' && (
              <div className="space-y-4">
                {/* Driver Source Selection */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Driver Source</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Card
                      className={`cursor-pointer transition-all ${
                        driverSource === 'fleet'
                          ? 'border-primary bg-primary/5'
                          : 'hover:border-primary/50'
                      }`}
                      onClick={() => setDriverSource('fleet')}
                    >
                      <CardContent className="p-4 text-center">
                        <Building2 className="h-8 w-8 mx-auto mb-2 text-primary" />
                        <h4 className="font-semibold mb-1">Internal Fleet</h4>
                        <p className="text-xs text-muted-foreground">
                          Use your own vehicles
                        </p>
                      </CardContent>
                    </Card>
                    <Card
                      className={`cursor-pointer transition-all ${
                        driverSource === 'marketplace'
                          ? 'border-primary bg-primary/5'
                          : 'hover:border-primary/50'
                      }`}
                      onClick={() => setDriverSource('marketplace')}
                    >
                      <CardContent className="p-4 text-center">
                        <Store className="h-8 w-8 mx-auto mb-2 text-primary" />
                        <h4 className="font-semibold mb-1">Marketplace</h4>
                        <p className="text-xs text-muted-foreground">
                          External drivers
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Fleet Vehicle Selection */}
                {driverSource === 'fleet' && (
                  <div className="space-y-2">
                    <Label htmlFor="fleet-vehicle">Select Fleet Vehicle</Label>
                    <Select value={selectedFleetVehicle} onValueChange={setSelectedFleetVehicle}>
                      <SelectTrigger id="fleet-vehicle">
                        <SelectValue placeholder="Choose a vehicle from your fleet..." />
                      </SelectTrigger>
                      <SelectContent>
                        {fleetVehicles.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground text-center">
                            No fleet vehicles available
                          </div>
                        ) : (
                          fleetVehicles.map((vehicle) => (
                            <SelectItem key={vehicle.id} value={vehicle.id}>
                              <div className="flex items-center gap-2">
                                <Truck className="h-4 w-4" />
                                {vehicle.vehicle_model} - {vehicle.plate_number}
                                <span className="text-xs text-muted-foreground ml-2">
                                  ({vehicle.driver_name})
                                </span>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Internal fleet deliveries do not require payment processing
                    </p>
                  </div>
                )}

                {/* Marketplace Driver Selection */}
                {driverSource === 'marketplace' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="vehicle-type">Vehicle Type</Label>
                      <Select value={selectedVehicleType} onValueChange={setSelectedVehicleType}>
                        <SelectTrigger id="vehicle-type">
                          <SelectValue placeholder="Choose vehicle type..." />
                        </SelectTrigger>
                        <SelectContent>
                          {vehicleTypes.map((vt) => (
                            <SelectItem key={vt.id} value={vt.id}>
                              {vt.name} - ₱{vt.base_price} base + ₱{vt.price_per_km}/km
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="marketplace-driver">Select Driver</Label>
                      <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                        <SelectTrigger id="marketplace-driver">
                          <SelectValue placeholder="Choose an available driver..." />
                        </SelectTrigger>
                        <SelectContent>
                          {drivers.filter(d => d.is_online === true && d.vehicle_type_id === selectedVehicleType).length === 0 ? (
                            <div className="p-2 text-sm text-muted-foreground text-center">
                              No drivers available for this vehicle type
                            </div>
                          ) : (
                            drivers
                              .filter(d => d.is_online === true && d.vehicle_type_id === selectedVehicleType)
                              .map((driver) => (
                                <SelectItem key={driver.id} value={driver.id}>
                                  <div className="flex items-center gap-2">
                                    <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                                    {driver.full_name} - {driver.phone}
                                  </div>
                                </SelectItem>
                              ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {/* Pricing Calculator */}
                {pricingDetails && (
                  <Card className="border-primary/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Pricing Breakdown
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Vehicle:</span>
                        <span className="font-medium">{pricingDetails.vehicle_type}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Base Price:</span>
                        <span>₱{pricingDetails.base_price.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Distance Charge:</span>
                        <span>₱{pricingDetails.distance_price.toFixed(2)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between">
                        <span className="font-semibold">Total:</span>
                        <span className="text-lg font-bold text-primary">
                          ₱{pricingDetails.total.toFixed(2)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Payment Fields (Marketplace Only) */}
                {driverSource === 'marketplace' && (
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Payment Details</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="payment-by">Who Pays?</Label>
                        <Select value={paymentBy} onValueChange={(v) => setPaymentBy(v as any)}>
                          <SelectTrigger id="payment-by">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sender">Sender</SelectItem>
                            <SelectItem value="recipient">Recipient</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="payment-method">Method</Label>
                        <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
                          <SelectTrigger id="payment-method">
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
                )}
              </div>
            )}

            {/* Status Info */}
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {drivers.filter(d => d.is_online === true).length} marketplace drivers available
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={assignmentMode === 'auto' ? handleAutoAssign : handleManualAssign}
              disabled={assigning}
            >
              {assigning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4 mr-2" />
                  {assignmentMode === 'auto' ? 'Auto Assign' : 'Assign Delivery'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
