'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { pairDriver, sendTrackingSms, sendTrackingEmail, bookDelivery, createMultiStopDelivery } from '@/lib/supabase/edge-functions';
import { useUserContext } from '@/lib/supabase/user-context';
import { useDebounce } from '@/hooks/useDebounce';
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
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
import { useToast } from '@/hooks/use-toast';
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
  Upload,
  FileSpreadsheet,
  Download,
  Link as LinkIcon,
  Copy,
  ExternalLink,
  CreditCard,
  StickyNote,
  RotateCcw,
} from 'lucide-react';

interface Delivery {
  id: string;
  tracking_number?: string;
  status: string;
  pickup_address: string;
  delivery_address: string;
  vehicle_type_id?: string;
  distance_km?: number;
  total_price?: number;
  is_scheduled?: boolean;
  scheduled_pickup_time?: string;
  created_at: string;
  driver_id?: string;
  pickup_contact_name?: string;
  pickup_contact_phone?: string;
  delivery_contact_name?: string;
  delivery_contact_phone?: string;
  is_multi_stop?: boolean;
  total_stops?: number;
  business_id?: string;
  fleet_vehicle_id?: string;
  payment_status?: string;
  payment_method?: string;
  payment_by?: string;
  delivery_fee?: number;
  total_amount?: number;
  package_description?: string;
  delivery_notes?: string;
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
  const { toast } = useToast();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driverDetails, setDriverDetails] = useState<Driver | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [loading, setLoading] = useState(true);
  const [realtimeUpdates, setRealtimeUpdates] = useState(0); // Track real-time updates
  const [selectedDeliveries, setSelectedDeliveries] = useState<string[]>([]);
  const [selectedDeliveryForView, setSelectedDeliveryForView] = useState<Delivery | null>(null);
  const [showDetailsPanel, setShowDetailsPanel] = useState(false);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<Delivery>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignmentMode, setAssignmentMode] = useState<'auto' | 'manual'>('auto');
  const [selectedDriver, setSelectedDriver] = useState<string>('');
  const [assigning, setAssigning] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'last7' | 'all'>('all');
  const itemsPerPage = 50;
  
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

  // CSV Import state
  const [showCsvImportModal, setShowCsvImportModal] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [isProcessingCsv, setIsProcessingCsv] = useState(false);
  const [csvImportSuccess, setCsvImportSuccess] = useState(0);
  const [csvProgress, setCsvProgress] = useState<{ current: number; total: number; stage: string } | null>(null);

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
            
            // Update local state based on event type
            if (payload.eventType === 'INSERT') {
              // Only add to current page if we're on page 1 (newest deliveries)
              if (currentPage === 1) {
                setDeliveries(prev => [payload.new as Delivery, ...prev].slice(0, itemsPerPage));
              }
              // Update total count
              setTotalCount(prev => prev + 1);
            } else if (payload.eventType === 'UPDATE') {
              setDeliveries(prev =>
                prev.map(d => d.id === payload.new.id ? { ...d, ...payload.new } as Delivery : d)
              );
            } else if (payload.eventType === 'DELETE') {
              setDeliveries(prev => prev.filter(d => d.id !== payload.old.id));
              setTotalCount(prev => Math.max(0, prev - 1));
            }
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

  // Re-fetch when page changes
  useEffect(() => {
    if (!userLoading && businessId) {
      fetchData();
    }
  }, [currentPage]);

  const fetchData = async () => {
    try {
      setLoading(true);

      if (!businessId) {
        console.error('❌ No business_id available');
        setLoading(false);
        return;
      }

      // Fetch total count for pagination
      const { count } = await supabase
        .from('deliveries')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId);
      
      setTotalCount(count || 0);

      // Fetch deliveries with pagination (50 per page)
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      
      // Build date range filter
      let deliveriesQuery = supabase
        .from('deliveries')
        .select('id, tracking_number, status, pickup_address, delivery_address, vehicle_type_id, distance_km, total_price, is_scheduled, scheduled_pickup_time, created_at, driver_id, pickup_contact_name, pickup_contact_phone, delivery_contact_name, delivery_contact_phone, is_multi_stop, total_stops, business_id, fleet_vehicle_id, payment_status, payment_method, payment_by, delivery_fee, total_amount, package_description, delivery_notes')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .range(from, to);

      const now = new Date();
      if (dateFilter === 'today') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        deliveriesQuery = deliveriesQuery.gte('created_at', start);
      } else if (dateFilter === 'yesterday') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString();
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        deliveriesQuery = deliveriesQuery.gte('created_at', start).lt('created_at', end);
      } else if (dateFilter === 'last7') {
        const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        deliveriesQuery = deliveriesQuery.gte('created_at', start);
      }

      const { data: deliveriesData, error: deliveriesError } = await deliveriesQuery;

      if (deliveriesError) {
        console.error('❌ Error fetching deliveries:', deliveriesError);
      } else {
        setDeliveries(deliveriesData || []);
        const totalPages = Math.ceil((count || 0) / itemsPerPage);
        console.log(`📦 Deliveries: Page ${currentPage}/${totalPages} (${deliveriesData?.length || 0}/${count || 0} total)`);
      }

      // Fetch available drivers - limited to top 100 by rating for performance
      const startTime = Date.now();
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
        .eq('is_online', true)
        .order('rating', { ascending: false })
        .limit(100);
      
      const driverLoadTime = Date.now() - startTime;
      console.log(`⚡ Loaded ${driversData?.length || 0} drivers in ${driverLoadTime}ms`);

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
          // Send tracking SMS + email now that driver is assigned (non-fatal)
          sendTrackingSms({ deliveryId }).catch(() => {});
          sendTrackingEmail({ deliveryId }).catch(() => {});
        } catch (err) {
          console.error(`❌ Error calling pair-driver for ${deliveryId}:`, err);
        }
      }

      // Refresh data and close modal
      await fetchData();
      setShowAssignModal(false);
      setSelectedDeliveries([]);
      toast({ title: '✅ Assigned', description: `${selectedDeliveries.length} delivery(ies) assigned successfully.` });
    } catch (error) {
      console.error('❌ Error auto-assigning:', error);
      toast({ title: 'Assignment failed', description: String(error), variant: 'destructive' });
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

      // Send tracking SMS + email now that driver is assigned (non-fatal)
      sendTrackingSms({ deliveryId }).catch(() => {});
      sendTrackingEmail({ deliveryId }).catch(() => {});

      // Refresh data and close modal
      await fetchData();
      setShowAssignModal(false);
      setSelectedDeliveries([]);
      setSelectedDriver('');
      setSelectedFleetVehicle('');
      setSelectedVehicleType('');
      toast({ title: '✅ Driver assigned', description: `Delivery assigned via ${driverSource}.` });
    } catch (error) {
      console.error('❌ Error manually assigning:', error);
      toast({ title: 'Assignment failed', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setAssigning(false);
    }
  };

  const handleCancelDelivery = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this delivery?')) return;

    try {
      console.log('🔄 Attempting to cancel delivery:', id);
      
      const { data, error } = await supabase
        .from('deliveries')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select();

      if (error) {
        console.error('❌ Supabase error:', error);
        throw error;
      }

      // Update local state immediately instead of refetching
      setDeliveries(prevDeliveries =>
        prevDeliveries.map(d =>
          d.id === id
            ? { ...d, status: 'cancelled', updated_at: new Date().toISOString() }
            : d
        )
      );

      if (selectedDeliveryForView?.id === id) {
        setShowDetailsPanel(false);
        setSelectedDeliveryForView(null);
      }
      
      toast({ title: '🚫 Delivery cancelled', description: `Delivery has been cancelled.` });
    } catch (error) {
      console.error('❌ Error cancelling delivery:', error);
      toast({ title: 'Cancel failed', description: (error as any).message, variant: 'destructive' });
    }
  };

  const handleViewDetails = async (delivery: Delivery) => {
    setSelectedDeliveryForView(delivery);
    setEditFormData(delivery);
    setIsEditingDetails(false);
    setDriverDetails(null);
    setShowDetailsPanel(true);

    // Fetch driver info if assigned and not already in drivers list
    if (delivery.driver_id) {
      const existing = drivers.find(d => d.id === delivery.driver_id);
      if (existing) {
        setDriverDetails(existing);
      } else {
        try {
          const { data: dp } = await supabase
            .from('driver_profiles')
            .select('id, vehicle_type_id, is_online, rating, vehicle_model, plate_number, employment_type')
            .eq('id', delivery.driver_id)
            .single();
          if (dp) {
            const { data: up } = await supabase
              .from('user_profiles')
              .select('first_name, last_name, phone_number')
              .eq('id', delivery.driver_id)
              .single();
            setDriverDetails({
              ...dp,
              full_name: up ? `${up.first_name} ${up.last_name}`.trim() : `Driver ${dp.id.slice(0, 8)}`,
              phone: up?.phone_number || 'N/A',
            });
          }
        } catch (e) {
          console.warn('Could not fetch driver details', e);
        }
      }
    }
  };

  const handleStartEdit = () => {
    setIsEditingDetails(true);
  };

  const handleCancelEdit = () => {
    setIsEditingDetails(false);
    setEditFormData(selectedDeliveryForView || {});
  };

  const handleSaveEdit = async () => {
    if (!selectedDeliveryForView) return;

    try {
      const { error } = await supabase
        .from('deliveries')
        .update({
          pickup_address: editFormData.pickup_address,
          delivery_address: editFormData.delivery_address,
          vehicle_type_id: editFormData.vehicle_type_id,
          scheduled_pickup_time: editFormData.scheduled_pickup_time,
          pickup_contact_name: editFormData.pickup_contact_name,
          pickup_contact_phone: editFormData.pickup_contact_phone,
          delivery_contact_name: editFormData.delivery_contact_name,
          delivery_contact_phone: editFormData.delivery_contact_phone,
          package_description: editFormData.package_description,
          delivery_notes: editFormData.delivery_notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedDeliveryForView.id);

      if (error) throw error;

      toast({ title: '✅ Saved', description: 'Delivery details updated successfully.' });
      setIsEditingDetails(false);
      await fetchData();
      
      // Update the selected delivery view
      const updated = deliveries.find(d => d.id === selectedDeliveryForView.id);
      if (updated) {
        setSelectedDeliveryForView(updated);
        setEditFormData(updated);
      }
    } catch (error) {
      console.error('❌ Error updating delivery:', error);
      toast({ title: 'Save failed', description: 'Failed to update delivery details.', variant: 'destructive' });
    }
  };

  const handleCopyTrackingLink = (trackingNumber?: string) => {
    if (!trackingNumber) return;
    const link = `${window.location.origin}/track/${trackingNumber}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    toast({ title: '📋 Copied!', description: 'Tracking link copied to clipboard.' });
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleReassign = (delivery: Delivery) => {
    setSelectedDeliveries([delivery.id]);
    setShowDetailsPanel(false);
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

  // CSV Import Functions
  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'text/csv') {
      setCsvFile(file);
      setCsvErrors([]);
    } else {
      setCsvErrors(['Please select a valid CSV file']);
    }
  };

  // Parses a CSV line correctly, handling quoted fields that contain commas
  const parseCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        // Handle escaped quote ("")
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const parseCsvFile = async () => {
    if (!csvFile) return;

    setIsProcessingCsv(true);
    setCsvErrors([]);

    // Yield to the main thread so the spinner renders before heavy parsing starts
    await new Promise(resolve => setTimeout(resolve, 0));
    
    try {
      const text = await csvFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        setCsvErrors(['CSV file is empty or has no data rows']);
        setIsProcessingCsv(false);
        return;
      }

      const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase());
      const requiredHeaders = ['pickup_address', 'dropoff_address', 'contact_name', 'contact_phone'];
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
      
      if (missingHeaders.length > 0) {
        setCsvErrors([`Missing required columns: ${missingHeaders.join(', ')}`]);
        setIsProcessingCsv(false);
        return;
      }

      const rowsData = [];
      const errors: string[] = [];

      // Parse all rows first
      for (let i = 1; i < lines.length; i++) {
        const values = parseCsvLine(lines[i]);
        const row: any = {};
        
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });

        if (!row.pickup_address || !row.dropoff_address || !row.contact_name || !row.contact_phone) {
          errors.push(`Row ${i}: Missing required fields`);
          continue;
        }

        if (!/^\d{10,}$/.test(row.contact_phone.replace(/[\s\-\(\)]/g, ''))) {
          errors.push(`Row ${i}: Invalid phone number format`);
          continue;
        }

        rowsData.push({
          rowNumber: i,
          orderGroup: row.order_group || '',
          pickupAddress: row.pickup_address,
          dropoffAddress: row.dropoff_address,
          contactName: row.contact_name,
          contactPhone: row.contact_phone,
          instructions: row.instructions || '',
          packageDescription: row.package_description || '',
          packageWeight: parseFloat(row.package_weight) || 0,
          packageValue: parseFloat(row.package_value) || 0,
        });
      }

      // Group rows by order_group
      const groupedOrders: any = {};
      const singleOrders: any[] = [];

      rowsData.forEach((row) => {
        if (!row.orderGroup) {
          // Single delivery
          singleOrders.push(row);
        } else {
          // Multi-stop delivery
          if (!groupedOrders[row.orderGroup]) {
            groupedOrders[row.orderGroup] = [];
          }
          groupedOrders[row.orderGroup].push(row);
        }
      });

      // Validate multi-stop groups have same pickup
      Object.entries(groupedOrders).forEach(([groupId, stops]: [string, any]) => {
        const pickups = new Set(stops.map((s: any) => s.pickupAddress));
        if (pickups.size > 1) {
          const rowNumbers = stops.map((s: any) => s.rowNumber).join(', ');
          errors.push(`Group "${groupId}" (rows ${rowNumbers}): All stops must have the same pickup address`);
          // Remove this group from processing
          delete groupedOrders[groupId];
        }
      });

      // Build final parsed data with type info
      const parsedData: any[] = [];

      // Add single orders
      singleOrders.forEach((order) => {
        parsedData.push({
          type: 'single',
          pickupAddress: order.pickupAddress,
          dropoffAddress: order.dropoffAddress,
          contactName: order.contactName,
          contactPhone: order.contactPhone,
          instructions: order.instructions,
          packageDescription: order.packageDescription,
          packageWeight: order.packageWeight,
          packageValue: order.packageValue,
        });
      });

      // Add multi-stop orders
      Object.entries(groupedOrders).forEach(([groupId, stops]: [string, any]) => {
        const firstStop = stops[0];
        parsedData.push({
          type: 'multi',
          orderGroup: groupId,
          pickupAddress: firstStop.pickupAddress,
          stops: stops.map((stop: any) => ({
            dropoffAddress: stop.dropoffAddress,
            contactName: stop.contactName,
            contactPhone: stop.contactPhone,
            instructions: stop.instructions,
            packageDescription: stop.packageDescription,
            packageWeight: stop.packageWeight,
            packageValue: stop.packageValue,
          })),
        });
      });

      if (errors.length > 0) setCsvErrors(errors);
      if (parsedData.length > 0) {
        setCsvData(parsedData);
      } else {
        setCsvErrors(['No valid rows found in CSV file']);
      }
    } catch (error) {
      console.error('Error parsing CSV:', error);
      setCsvErrors(['Failed to parse CSV file. Please check the format.']);
    } finally {
      setIsProcessingCsv(false);
    }
  };

  const importCsvOrders = async () => {
    if (csvData.length === 0 || !businessId || !selectedVehicleType) {
      setCsvErrors(['Please select a vehicle type and ensure data is valid']);
      return;
    }

    setIsProcessingCsv(true);
    setCsvErrors([]);
    setCsvProgress({ current: 0, total: csvData.length, stage: 'geocoding' });

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    // --- Step 1: Collect all unique addresses across all orders ---
    const addressSet = new Set<string>();
    for (const order of csvData) {
      addressSet.add(order.pickupAddress);
      if (order.type === 'single') {
        addressSet.add(order.dropoffAddress);
      } else {
        for (const stop of order.stops) addressSet.add(stop.dropoffAddress);
      }
    }
    const uniqueAddresses = Array.from(addressSet);

    // --- Step 2: Geocode all unique addresses in parallel ---
    const geocodeOne = async (address: string): Promise<[string, { lat: number; lng: number } | null]> => {
      try {
        if (!apiKey) return [address, null];
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === 'OK' && data.results?.[0]) {
          const { lat, lng } = data.results[0].geometry.location;
          return [address, { lat, lng }];
        }
        return [address, null];
      } catch {
        return [address, null];
      }
    };

    setCsvProgress({ current: 0, total: uniqueAddresses.length, stage: 'geocoding' });
    const geocodeResults = await Promise.all(uniqueAddresses.map(geocodeOne));
    const coordsCache = new Map<string, { lat: number; lng: number } | null>(geocodeResults);

    // --- Step 3: Build all order payloads (no async needed, cache is ready) ---
    const errors: string[] = [];
    type OrderJob = { label: string; run: () => Promise<void> };
    const jobs: OrderJob[] = [];

    for (let i = 0; i < csvData.length; i++) {
      const order = csvData[i];

      if (order.type === 'single') {
        const pickupCoords = coordsCache.get(order.pickupAddress);
        const dropoffCoords = coordsCache.get(order.dropoffAddress);
        if (!pickupCoords || !dropoffCoords) {
          errors.push(`Order ${i + 1}: Failed to geocode address(es)`);
          continue;
        }
        jobs.push({
          label: `Order ${i + 1}`,
          run: () => bookDelivery({
            vehicleTypeId: selectedVehicleType,
            pickup: {
              address: order.pickupAddress,
              location: pickupCoords,
              contactName: order.contactName,
              contactPhone: order.contactPhone,
              instructions: order.instructions || '',
            },
            dropoff: {
              address: order.dropoffAddress,
              location: dropoffCoords,
              contactName: order.contactName,
              contactPhone: order.contactPhone,
              instructions: order.instructions || '',
            },
            package: {
              description: order.packageDescription || '',
              weightKg: order.packageWeight || 0,
              value: order.packageValue || 0,
            },
          }),
        });
      } else if (order.type === 'multi') {
        const pickupCoords = coordsCache.get(order.pickupAddress);
        if (!pickupCoords) {
          errors.push(`Group "${order.orderGroup}": Failed to geocode pickup address`);
          continue;
        }
        const dropoffStopsWithCoords: any[] = [];
        let geocodeFailed = false;
        for (const stop of order.stops) {
          const dropoffCoords = coordsCache.get(stop.dropoffAddress);
          if (!dropoffCoords) {
            errors.push(`Group "${order.orderGroup}": Failed to geocode "${stop.dropoffAddress}"`);
            geocodeFailed = true;
            break;
          }
          dropoffStopsWithCoords.push({
            address: stop.dropoffAddress,
            location: dropoffCoords,
            contactName: stop.contactName,
            contactPhone: stop.contactPhone,
            instructions: stop.instructions || '',
            packageDescription: stop.packageDescription || '',
            packageWeight: stop.packageWeight || 0,
          });
        }
        if (geocodeFailed) continue;
        const firstStop = order.stops[0];
        jobs.push({
          label: `Group "${order.orderGroup}"`,
          run: () => createMultiStopDelivery({
            vehicleTypeId: selectedVehicleType,
            pickup: {
              address: order.pickupAddress,
              location: pickupCoords,
              contactName: firstStop.contactName,
              contactPhone: firstStop.contactPhone,
              instructions: firstStop.instructions || '',
            },
            dropoffStops: dropoffStopsWithCoords,
          }),
        });
      }
    }

    // --- Step 4: Run all bookings in parallel, track progress ---
    let completed = 0;
    setCsvProgress({ current: 0, total: jobs.length, stage: 'importing' });

    const results = await Promise.allSettled(
      jobs.map(job =>
        job.run().then(() => {
          completed++;
          setCsvProgress({ current: completed, total: jobs.length, stage: 'importing' });
        }).catch((err: any) => {
          completed++;
          setCsvProgress({ current: completed, total: jobs.length, stage: 'importing' });
          throw err;
        })
      )
    );

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    results.forEach((r, idx) => {
      if (r.status === 'rejected') {
        errors.push(`${jobs[idx].label}: ${r.reason?.message || 'Unknown error'}`);
      }
    });

    setIsProcessingCsv(false);
    setCsvProgress(null);
    setCsvImportSuccess(successCount);
    if (errors.length > 0) setCsvErrors(errors);

    if (successCount > 0) {
      fetchData();
      setTimeout(() => {
        setShowCsvImportModal(false);
        setCsvFile(null);
        setCsvData([]);
        setCsvErrors([]);
        setCsvImportSuccess(0);
      }, 3000);
    }
  };

  const downloadCsvTemplate = () => {
    const template = [
      'order_group,pickup_address,dropoff_address,contact_name,contact_phone,instructions,package_description,package_weight,package_value',
      ',Makati City Metro Manila,BGC Taguig Metro Manila,John Doe,09171234567,Ring doorbell,Electronics,2.5,5000',
      'GROUP001,Quezon City Metro Manila,Pasig City Metro Manila,Jane Smith,09181234567,Stop 1 - Call first,Documents,1.0,2000',
      'GROUP001,Quezon City Metro Manila,Makati City Metro Manila,Bob Lee,09191234567,Stop 2 - Leave at desk,Parcels,1.5,3000',
      'GROUP001,Quezon City Metro Manila,BGC Taguig Metro Manila,Alice Wong,09201234567,Stop 3 - Ring bell,Supplies,2.0,4000',
      ',Ortigas Center Metro Manila,Manila City Metro Manila,Carlos Ray,09211234567,,Books,0.5,500',
    ].join('\n');

    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'orders_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
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
      going_to_pickup: {
        variant: 'default',
        label: 'Going to Pickup',
        icon: Truck,
      },
      pickup_arrived: {
        variant: 'default',
        label: 'At Pickup',
        icon: MapPin,
      },
      package_collected: {
        variant: 'default',
        label: 'Package Collected',
        icon: Package,
      },
      in_transit: {
        variant: 'default',
        label: 'In Transit',
        icon: Truck,
      },
      at_destination: {
        variant: 'default',
        label: 'At Destination',
        icon: MapPin,
      },
      delivered: {
        variant: 'default',
        label: 'Delivered',
        icon: CheckCircle2,
      },
      cancelled: {
        variant: 'destructive',
        label: 'Cancelled',
        icon: AlertCircle,
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

  const filteredDeliveries = useMemo(() => {
    return deliveries.filter(delivery => {
      const matchesSearch =
        (delivery.tracking_number?.toLowerCase() || '').includes(debouncedSearchQuery.toLowerCase()) ||
        (delivery.pickup_address?.toLowerCase() || '').includes(debouncedSearchQuery.toLowerCase()) ||
        (delivery.delivery_address?.toLowerCase() || '').includes(debouncedSearchQuery.toLowerCase());

      let matchesStatus = false;
      if (statusFilter === 'all') {
        matchesStatus = true;
      } else if (statusFilter === 'in_transit') {
        matchesStatus = ['going_to_pickup', 'pickup_arrived', 'package_collected', 'in_transit', 'at_destination'].includes(delivery.status);
      } else if (statusFilter === 'delivered') {
        matchesStatus = ['delivered', 'cancelled'].includes(delivery.status);
      } else {
        matchesStatus = delivery.status === statusFilter;
      }

      return matchesSearch && matchesStatus;
    });
  }, [deliveries, debouncedSearchQuery, statusFilter]);

  const pendingCount = deliveries.filter(d => d.status === 'pending').length;
  const offeredCount = deliveries.filter(d => d.status === 'driver_offered').length;
  const assignedCount = deliveries.filter(d => d.status === 'driver_assigned').length;
  const inTransitCount = deliveries.filter(d => ['going_to_pickup', 'pickup_arrived', 'package_collected', 'in_transit', 'at_destination'].includes(d.status)).length;
  const deliveredCount = deliveries.filter(d => ['delivered', 'cancelled'].includes(d.status)).length;
  const totalRevenue = deliveries
    .filter(d => d.status === 'delivered')
    .reduce((sum, d) => sum + (d.total_price || 0), 0);

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
          <Button variant="outline" onClick={() => setShowCsvImportModal(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Button onClick={() => router.push('/business/orders')}>
            <Package className="h-4 w-4 mr-2" />
            Create Delivery
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
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
            <CardTitle className="text-sm font-medium">In Transit</CardTitle>
            <Truck className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inTransitCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Currently active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivered</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deliveries.filter(d => d.status === 'delivered').length}</div>
            <p className="text-xs text-muted-foreground mt-1">Completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₱{totalRevenue.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
            <p className="text-xs text-muted-foreground mt-1">From delivered orders</p>
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
            <Select value={dateFilter} onValueChange={(v) => { setDateFilter(v as any); setCurrentPage(1); }}>
              <SelectTrigger className="w-36">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="last7">Last 7 Days</SelectItem>
              </SelectContent>
            </Select>
            <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-auto">
              <TabsList>
                <TabsTrigger value="all">All ({deliveries.length})</TabsTrigger>
                <TabsTrigger value="pending">Pending ({pendingCount})</TabsTrigger>
                <TabsTrigger value="driver_offered">Offered ({offeredCount})</TabsTrigger>
                <TabsTrigger value="driver_assigned">Assigned ({assignedCount})</TabsTrigger>
                <TabsTrigger value="in_transit">In Transit ({inTransitCount})</TabsTrigger>
                <TabsTrigger value="delivered">Completed ({deliveredCount})</TabsTrigger>
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
                <TableHead>Payment</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Pickup</TableHead>
                <TableHead>Dropoff</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Distance</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDeliveries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No deliveries found</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredDeliveries.map((delivery) => (
                  <TableRow
                    key={delivery.id}
                    className={`cursor-pointer hover:bg-muted/50 transition-colors ${selectedDeliveries.includes(delivery.id) ? 'bg-muted/50' : ''}`}
                    onClick={(e) => {
                      // Don't trigger if clicking on checkbox or action menu
                      if ((e.target as HTMLElement).closest('button, input[type="checkbox"]')) {
                        return;
                      }
                      handleViewDetails(delivery);
                    }}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedDeliveries.includes(delivery.id)}
                        onCheckedChange={() => handleSelectDelivery(delivery.id)}
                      />
                    </TableCell>
                    <TableCell className="font-mono font-medium">
                      <div className="flex items-center gap-1.5">
                        {delivery.tracking_number}
                        {delivery.is_scheduled && (
                          <span title="Scheduled delivery">
                            <Calendar className="h-3.5 w-3.5 text-blue-500" />
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(delivery.status)}</TableCell>
                    <TableCell>
                      {delivery.payment_status ? (
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            delivery.payment_status === 'paid'
                              ? 'border-green-500 text-green-700 bg-green-50 dark:bg-green-950/30'
                              : delivery.payment_status === 'pending'
                              ? 'border-yellow-500 text-yellow-700 bg-yellow-50 dark:bg-yellow-950/30'
                              : delivery.payment_status === 'failed'
                              ? 'border-red-500 text-red-700 bg-red-50 dark:bg-red-950/30'
                              : 'border-gray-300 text-gray-500'
                          }`}
                        >
                          {delivery.payment_status === 'paid' ? '✅ Paid' :
                           delivery.payment_status === 'pending' ? '⏳ Pending' :
                           delivery.payment_status === 'failed' ? '❌ Failed' :
                           delivery.payment_status}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {delivery.is_multi_stop ? (
                          <>
                            <Package className="h-3 w-3 mr-1" />
                            Multi-Stop
                          </>
                        ) : (
                          'Single'
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate text-sm">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-green-600 flex-shrink-0" />
                        {delivery.pickup_address}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate text-sm">
                      <div className="flex items-center gap-1">
                        <Navigation className="h-3 w-3 text-red-600 flex-shrink-0" />
                        {delivery.delivery_address}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {delivery.delivery_contact_name ? (
                        <div>
                          <p className="font-medium leading-tight">{delivery.delivery_contact_name}</p>
                          <p className="text-xs text-muted-foreground">{delivery.delivery_contact_phone || '—'}</p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>{(delivery.distance_km || 0).toFixed(1)} km</TableCell>
                    <TableCell className="font-semibold">₱{delivery.total_price || 0}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(delivery.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
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
                            onClick={() => handleViewDetails(delivery)}
                          >
                            <Package className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleCopyTrackingLink(delivery.tracking_number)}
                          >
                            <LinkIcon className="h-4 w-4 mr-2" />
                            Copy Tracking Link
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedDeliveries([delivery.id]);
                              handleAssign();
                            }}
                          >
                            <UserCheck className="h-4 w-4 mr-2" />
                            Assign Driver
                          </DropdownMenuItem>
                          {delivery.driver_id && (
                            <DropdownMenuItem
                              onClick={() => handleReassign(delivery)}
                            >
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Reassign Driver
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => {
                            handleViewDetails(delivery);
                            setTimeout(() => handleStartEdit(), 100);
                          }}>
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
          
          {/* Pagination Controls */}
          {totalCount > itemsPerPage && (
            <div className="flex items-center justify-between px-4 py-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} deliveries
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <div className="text-sm font-medium">
                  Page {currentPage} of {Math.ceil(totalCount / itemsPerPage)}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalCount / itemsPerPage), prev + 1))}
                  disabled={currentPage >= Math.ceil(totalCount / itemsPerPage)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
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
                        <span className="font-medium">{pricingDetails!.vehicle_type}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Base Price:</span>
                        <span>₱{pricingDetails!.base_price.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Distance Charge:</span>
                        <span>₱{pricingDetails!.distance_price.toFixed(2)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between">
                        <span className="font-semibold">Total:</span>
                        <span className="text-lg font-bold text-primary">
                          ₱{pricingDetails!.total.toFixed(2)}
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

      {/* Delivery Details Panel */}
      <Sheet open={showDetailsPanel} onOpenChange={setShowDetailsPanel}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Delivery Details</SheetTitle>
            <SheetDescription>
              {isEditingDetails ? 'Edit delivery information' : 'View complete delivery information'}
            </SheetDescription>
          </SheetHeader>

          {selectedDeliveryForView && (
            <div className="space-y-6 py-6">
              {/* Header Info */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs text-muted-foreground">Tracking Number</Label>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="font-mono font-semibold text-lg">{selectedDeliveryForView!.tracking_number}</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleCopyTrackingLink(selectedDeliveryForView!.tracking_number)}
                        title="Copy tracking link"
                      >
                        {copiedLink ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                      <a
                        href={`/track/${selectedDeliveryForView!.tracking_number}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary"
                        title="Open tracking page"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                  {getStatusBadge(selectedDeliveryForView!.status)}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Delivery Type</Label>
                    <div className="mt-1">
                      <Badge variant="outline">
                        {selectedDeliveryForView!.is_multi_stop ? (
                          <>
                            <Package className="h-3 w-3 mr-1" />
                            Multi-Stop
                          </>
                        ) : (
                          'Single Delivery'
                        )}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Created</Label>
                    <p className="mt-1 text-sm">{new Date(selectedDeliveryForView!.created_at).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Addresses */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Addresses
                </h3>
                
                {isEditingDetails ? (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="pickup">Pickup Address</Label>
                      <Input
                        id="pickup"
                        value={editFormData.pickup_address || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, pickup_address: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="dropoff">Dropoff Address</Label>
                      <Input
                        id="dropoff"
                        value={editFormData.delivery_address || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, delivery_address: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="pickup-contact-name">Sender Name</Label>
                        <Input
                          id="pickup-contact-name"
                          value={editFormData.pickup_contact_name || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, pickup_contact_name: e.target.value })}
                          className="mt-1"
                          placeholder="Sender name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="pickup-contact-phone">Sender Phone</Label>
                        <Input
                          id="pickup-contact-phone"
                          value={editFormData.pickup_contact_phone || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, pickup_contact_phone: e.target.value })}
                          className="mt-1"
                          placeholder="+639..."
                        />
                      </div>
                      <div>
                        <Label htmlFor="delivery-contact-name">Recipient Name</Label>
                        <Input
                          id="delivery-contact-name"
                          value={editFormData.delivery_contact_name || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, delivery_contact_name: e.target.value })}
                          className="mt-1"
                          placeholder="Recipient name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="delivery-contact-phone">Recipient Phone</Label>
                        <Input
                          id="delivery-contact-phone"
                          value={editFormData.delivery_contact_phone || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, delivery_contact_phone: e.target.value })}
                          className="mt-1"
                          placeholder="+639..."
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="package-description">Package Description</Label>
                      <Input
                        id="package-description"
                        value={editFormData.package_description || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, package_description: e.target.value })}
                        className="mt-1"
                        placeholder="What's in the package?"
                      />
                    </div>
                    <div>
                      <Label htmlFor="delivery-notes">Delivery Notes</Label>
                      <Input
                        id="delivery-notes"
                        value={editFormData.delivery_notes || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, delivery_notes: e.target.value })}
                        className="mt-1"
                        placeholder="e.g. Leave at door, ring bell..."
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                      <MapPin className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <Label className="text-xs text-green-700 dark:text-green-400">Pickup</Label>
                        <p className="text-sm mt-1">{selectedDeliveryForView!.pickup_address}</p>
                      </div>
                    </div>
                    <div className="flex gap-3 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                      <Navigation className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <Label className="text-xs text-red-700 dark:text-red-400">Dropoff</Label>
                        <p className="text-sm mt-1">{selectedDeliveryForView!.delivery_address}</p>
                      </div>
                    </div>
                  </>
                )}

              </div>

              <Separator />

              {/* Delivery Details */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Delivery Information
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Distance</Label>
                    <p className="mt-1 font-semibold">
                      {(selectedDeliveryForView!.distance_km || 0).toFixed(1)} km
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Total Price</Label>
                    <p className="mt-1 font-semibold text-lg">
                      ₱{selectedDeliveryForView!.total_price || 0}
                    </p>
                  </div>
                </div>

                {isEditingDetails ? (
                  <div>
                    <Label htmlFor="vehicle-type">Vehicle Type</Label>
                    <Select
                      value={editFormData.vehicle_type_id || ''}
                      onValueChange={(value) => setEditFormData({ ...editFormData, vehicle_type_id: value })}
                    >
                      <SelectTrigger id="vehicle-type" className="mt-1">
                        <SelectValue placeholder="Select vehicle type" />
                      </SelectTrigger>
                      <SelectContent>
                        {vehicleTypes.map((vt) => (
                          <SelectItem key={vt.id} value={vt.id}>
                            {vt.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div>
                    <Label className="text-xs text-muted-foreground">Vehicle Type</Label>
                    <p className="mt-1">
                      {vehicleTypes.find(vt => vt.id === selectedDeliveryForView!.vehicle_type_id)?.name || 'Not specified'}
                    </p>
                  </div>
                )}

                {selectedDeliveryForView!.is_scheduled && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Scheduled Pickup</Label>
                    {isEditingDetails ? (
                      <Input
                        type="datetime-local"
                        value={editFormData.scheduled_pickup_time?.slice(0, 16) || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, scheduled_pickup_time: e.target.value })}
                        className="mt-1"
                      />
                    ) : (
                      <p className="mt-1">
                        {selectedDeliveryForView!.scheduled_pickup_time 
                          ? new Date(selectedDeliveryForView!.scheduled_pickup_time!).toLocaleString()
                          : 'Not scheduled'}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {selectedDeliveryForView!.driver_id && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Truck className="h-4 w-4" />
                      Assigned Driver
                    </h3>
                    <div className="p-3 bg-primary/5 rounded-lg">
                      {driverDetails ? (
                        <div className="space-y-1">
                          <p className="font-medium text-sm">{driverDetails!.full_name || 'Driver'}</p>
                          <p className="text-xs text-muted-foreground">{driverDetails!.phone || '—'}</p>
                          {driverDetails!.plate_number && (
                            <p className="text-xs text-muted-foreground">Plate: {driverDetails!.plate_number}</p>
                          )}
                          {driverDetails!.vehicle_model && (
                            <p className="text-xs text-muted-foreground">Vehicle: {driverDetails!.vehicle_model}</p>
                          )}
                          {driverDetails!.rating != null && (
                            <p className="text-xs text-muted-foreground">⭐ {driverDetails!.rating!.toFixed(1)}</p>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Loading driver info...</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {(selectedDeliveryForView!.delivery_contact_name || selectedDeliveryForView!.pickup_contact_name) && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Contact Information
                    </h3>
                    {selectedDeliveryForView!.delivery_contact_name && (
                      <div className="flex gap-3 p-3 bg-muted/50 rounded-lg">
                        <Navigation className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Recipient</p>
                          <p className="text-sm font-medium">{selectedDeliveryForView!.delivery_contact_name}</p>
                          {selectedDeliveryForView!.delivery_contact_phone && (
                            <a href={`tel:${selectedDeliveryForView!.delivery_contact_phone}`} className="text-xs text-blue-500 hover:underline">{selectedDeliveryForView!.delivery_contact_phone}</a>
                          )}
                        </div>
                      </div>
                    )}
                    {selectedDeliveryForView!.pickup_contact_name && (
                      <div className="flex gap-3 p-3 bg-muted/50 rounded-lg">
                        <MapPin className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Sender / Pickup</p>
                          <p className="text-sm font-medium">{selectedDeliveryForView!.pickup_contact_name}</p>
                          {selectedDeliveryForView!.pickup_contact_phone && (
                            <a href={`tel:${selectedDeliveryForView!.pickup_contact_phone}`} className="text-xs text-blue-500 hover:underline">{selectedDeliveryForView!.pickup_contact_phone}</a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {(selectedDeliveryForView.package_description || selectedDeliveryForView.delivery_notes) && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <StickyNote className="h-4 w-4" />
                      Package &amp; Notes
                    </h3>
                    {selectedDeliveryForView.package_description && (
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Package Description</p>
                        <p className="text-sm">{selectedDeliveryForView.package_description}</p>
                      </div>
                    )}
                    {selectedDeliveryForView.delivery_notes && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                        <p className="text-xs text-amber-700 dark:text-amber-400 mb-1 font-medium">📌 Delivery Notes</p>
                        <p className="text-sm text-amber-900 dark:text-amber-200">{selectedDeliveryForView.delivery_notes}</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {(selectedDeliveryForView.payment_status || selectedDeliveryForView.total_amount) && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Payment
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {selectedDeliveryForView.payment_status && (
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Status</p>
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              selectedDeliveryForView.payment_status === 'paid'
                                ? 'border-green-500 text-green-700 bg-green-50'
                                : selectedDeliveryForView.payment_status === 'pending'
                                ? 'border-yellow-500 text-yellow-700 bg-yellow-50'
                                : 'border-red-500 text-red-700 bg-red-50'
                            }`}
                          >
                            {selectedDeliveryForView.payment_status === 'paid' ? '✅ Paid' :
                             selectedDeliveryForView.payment_status === 'pending' ? '⏳ Pending' :
                             selectedDeliveryForView.payment_status}
                          </Badge>
                        </div>
                      )}
                      {selectedDeliveryForView.payment_method && (
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Method</p>
                          <p className="text-sm font-medium capitalize">{selectedDeliveryForView.payment_method}</p>
                        </div>
                      )}
                      {selectedDeliveryForView.payment_by && (
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Paid By</p>
                          <p className="text-sm font-medium capitalize">{selectedDeliveryForView.payment_by}</p>
                        </div>
                      )}
                      {selectedDeliveryForView.total_amount != null && (
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Total Amount</p>
                          <p className="text-sm font-bold text-green-700 dark:text-green-400">₱{selectedDeliveryForView.total_amount.toFixed(2)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <SheetFooter className="flex-col sm:flex-row gap-2 mt-6">
            {isEditingDetails ? (
              <>
                <Button variant="outline" onClick={handleCancelEdit} className="w-full sm:w-auto">
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit} className="w-full sm:w-auto">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setShowDetailsPanel(false)} className="w-full sm:w-auto">
                  Close
                </Button>
                <Button onClick={handleStartEdit} className="w-full sm:w-auto">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Details
                </Button>
                {selectedDeliveryForView?.driver_id ? (
                  <Button
                    variant="outline"
                    onClick={() => handleReassign(selectedDeliveryForView!)}
                    className="w-full sm:w-auto border-orange-400 text-orange-600 hover:bg-orange-50"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reassign Driver
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      setSelectedDeliveries([selectedDeliveryForView!.id]);
                      setShowDetailsPanel(false);
                      handleAssign();
                    }}
                    className="w-full sm:w-auto"
                  >
                    <UserCheck className="h-4 w-4 mr-2" />
                    Assign Driver
                  </Button>
                )}
              </>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* CSV Import Modal */}
      <Dialog open={showCsvImportModal} onOpenChange={setShowCsvImportModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Import Orders from CSV
            </DialogTitle>
            <DialogDescription>
              Upload a CSV file to bulk create delivery orders
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Download Template */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Need a template?</CardTitle>
              </CardHeader>
              <CardContent>
                <Button variant="outline" size="sm" onClick={downloadCsvTemplate} className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Download CSV Template
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Required columns: order_group (optional), pickup_address, dropoff_address, contact_name, contact_phone<br />
                  <span className="text-xs italic">Leave order_group empty for single deliveries. Use same group ID for multi-stop orders.</span>
                </p>
              </CardContent>
            </Card>

            {/* Vehicle Type Selection */}
            <div className="space-y-2">
              <Label>Select Vehicle Type for All Orders</Label>
              <Select value={selectedVehicleType} onValueChange={setSelectedVehicleType}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose vehicle type..." />
                </SelectTrigger>
                <SelectContent>
                  {vehicleTypes.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicle.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <Label htmlFor="csv-file">Upload CSV File</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleCsvFileChange}
                disabled={isProcessingCsv}
              />
            </div>

            {/* Parse Button */}
            {csvFile && !csvData.length && (
              <Button onClick={parseCsvFile} disabled={isProcessingCsv} className="w-full">
                {isProcessingCsv ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Parsing CSV...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Parse CSV File
                  </>
                )}
              </Button>
            )}

            {/* Parsed Data Preview */}
            {csvData.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Parsed Orders ({csvData.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-48 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Pickup</TableHead>
                          <TableHead>Dropoff</TableHead>
                          <TableHead>Stops</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {csvData.slice(0, 10).map((order, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-xs">
                              <Badge variant={order.type === 'multi' ? 'default' : 'outline'} className="text-xs">
                                {order.type === 'multi' ? 'Multi' : 'Single'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">{order.pickupAddress.substring(0, 25)}...</TableCell>
                            <TableCell className="text-xs">
                              {order.type === 'multi' ? `${order.stops.length} stops` : order.dropoffAddress.substring(0, 25) + '...'}
                            </TableCell>
                            <TableCell className="text-xs">
                              {order.type === 'multi' ? order.stops.length : '1'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {csvData.length > 10 && (
                      <p className="text-xs text-muted-foreground text-center mt-2">
                        ...and {csvData.length - 10} more orders
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Errors */}
            {csvErrors.length > 0 && (
              <Card className="border-destructive">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-destructive flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Errors ({csvErrors.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {csvErrors.slice(0, 10).map((error, idx) => (
                      <p key={idx} className="text-xs text-destructive">{error}</p>
                    ))}
                    {csvErrors.length > 10 && (
                      <p className="text-xs text-muted-foreground">...and {csvErrors.length - 10} more errors</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Progress Bar */}
            {isProcessingCsv && csvProgress && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {csvProgress.stage === 'geocoding' ? 'Geocoding addresses…' : 'Creating orders…'}
                  </span>
                  <span className="font-medium tabular-nums">{csvProgress.current} / {csvProgress.total}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 rounded-full transition-all duration-300"
                    style={{
                      width: csvProgress.total > 0 ? `${Math.round((csvProgress.current / csvProgress.total) * 100)}%` : '0%',
                      backgroundColor: csvProgress.stage === 'geocoding' ? '#f59e0b' : '#3b82f6',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Success Message */}
            {csvImportSuccess > 0 && (
              <Card className="border-green-500 bg-green-50 dark:bg-green-950">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle2 className="h-5 w-5" />
                    <p className="font-semibold">Successfully imported {csvImportSuccess} orders!</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCsvImportModal(false)} disabled={isProcessingCsv}>
              Cancel
            </Button>
            {csvData.length > 0 && csvImportSuccess === 0 && (
              <Button onClick={importCsvOrders} disabled={isProcessingCsv || !selectedVehicleType}>
                {isProcessingCsv && csvProgress ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {csvProgress.stage === 'geocoding'
                      ? `Geocoding addresses (${csvProgress.current}/${csvProgress.total})…`
                      : `Importing ${csvProgress.current}/${csvProgress.total} orders…`}
                  </>
                ) : isProcessingCsv ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Preparing…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Import {csvData.length} Orders
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
