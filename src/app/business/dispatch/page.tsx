'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { pairDriver } from '@/lib/supabase/edge-functions';
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
  }, [userLoading, businessId, currentPage]);

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
      
      const { data: deliveriesData, error: deliveriesError } = await supabase
        .from('deliveries')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .range(from, to);

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

      console.log('✅ Delivery cancelled successfully:', data);

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
      
      alert('Delivery cancelled successfully');
    } catch (error) {
      console.error('❌ Error cancelling delivery:', error);
      alert('Failed to cancel delivery: ' + (error as any).message);
    }
  };

  const handleViewDetails = (delivery: Delivery) => {
    setSelectedDeliveryForView(delivery);
    setEditFormData(delivery);
    setIsEditingDetails(false);
    setShowDetailsPanel(true);
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
          dropoff_address: editFormData.dropoff_address,
          vehicle_type_id: editFormData.vehicle_type_id,
          scheduled_pickup_time: editFormData.scheduled_pickup_time,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedDeliveryForView.id);

      if (error) throw error;

      alert('Delivery details updated successfully');
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
      alert('Failed to update delivery details');
    }
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

  const parseCsvFile = async () => {
    if (!csvFile) return;

    setIsProcessingCsv(true);
    setCsvErrors([]);
    
    try {
      const text = await csvFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        setCsvErrors(['CSV file is empty or has no data rows']);
        setIsProcessingCsv(false);
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
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
        const values = lines[i].split(',').map(v => v.trim());
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
      const parsedData = [];

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
    let successCount = 0;
    const errors: string[] = [];
    
    // Import edge functions
    const { bookDelivery, createMultiStopDelivery } = await import('@/lib/supabase/edge-functions');

    // Helper function to geocode an address
    const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
      try {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
          throw new Error('Google Maps API key not configured');
        }

        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'OK' && data.results && data.results.length > 0) {
          const location = data.results[0].geometry.location;
          return { lat: location.lat, lng: location.lng };
        }
        return null;
      } catch (error) {
        console.error('Geocoding error:', error);
        return null;
      }
    };

    for (let i = 0; i < csvData.length; i++) {
      const order = csvData[i];
      
      try {
        if (order.type === 'single') {
          // Geocode pickup and dropoff addresses
          const pickupCoords = await geocodeAddress(order.pickupAddress);
          const dropoffCoords = await geocodeAddress(order.dropoffAddress);

          if (!pickupCoords || !dropoffCoords) {
            errors.push(`Order ${i + 1}: Failed to geocode addresses`);
            continue;
          }

          // Single delivery
          const deliveryData = {
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
          };

          const result = await bookDelivery(deliveryData);
          successCount++;
        } else if (order.type === 'multi') {
          // Geocode pickup address
          const pickupCoords = await geocodeAddress(order.pickupAddress);
          if (!pickupCoords) {
            errors.push(`Group "${order.orderGroup}": Failed to geocode pickup address`);
            continue;
          }

          // Geocode all dropoff addresses
          const dropoffStopsWithCoords = [];
          let geocodeFailed = false;

          for (const stop of order.stops) {
            const dropoffCoords = await geocodeAddress(stop.dropoffAddress);
            if (!dropoffCoords) {
              errors.push(`Group "${order.orderGroup}": Failed to geocode address "${stop.dropoffAddress}"`);
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

          // Multi-stop delivery
          const firstStop = order.stops[0];
          const deliveryData = {
            vehicleTypeId: selectedVehicleType,
            pickup: {
              address: order.pickupAddress,
              location: pickupCoords,
              contactName: firstStop.contactName,
              contactPhone: firstStop.contactPhone,
              instructions: firstStop.instructions || '',
            },
            dropoffStops: dropoffStopsWithCoords,
          };

          const result = await createMultiStopDelivery(deliveryData);
          successCount++;
        }
      } catch (error: any) {
        const label = order.type === 'multi' ? `Group "${order.orderGroup}"` : `Order ${i + 1}`;
        errors.push(`${label}: ${error.message || 'Unknown error'}`);
      }
    }

    setIsProcessingCsv(false);
    setCsvImportSuccess(successCount);

    if (errors.length > 0) setCsvErrors(errors);

    if (successCount > 0) {
      fetchData(); // Refresh deliveries list
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
        (delivery.dropoff_address?.toLowerCase() || '').includes(debouncedSearchQuery.toLowerCase());

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
                            onClick={() => {
                              const link = `${window.location.origin}/track/${delivery.tracking_number}`;
                              navigator.clipboard.writeText(link);
                            }}
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
                    <p className="font-mono font-semibold text-lg">{selectedDeliveryForView.tracking_number}</p>
                  </div>
                  {getStatusBadge(selectedDeliveryForView.status)}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Delivery Type</Label>
                    <div className="mt-1">
                      <Badge variant="outline">
                        {selectedDeliveryForView.delivery_type === 'multi' ? (
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
                    <p className="mt-1 text-sm">{new Date(selectedDeliveryForView.created_at).toLocaleString()}</p>
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
                        value={editFormData.dropoff_address || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, dropoff_address: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                      <MapPin className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <Label className="text-xs text-green-700 dark:text-green-400">Pickup</Label>
                        <p className="text-sm mt-1">{selectedDeliveryForView.pickup_address}</p>
                      </div>
                    </div>
                    <div className="flex gap-3 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                      <Navigation className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <Label className="text-xs text-red-700 dark:text-red-400">Dropoff</Label>
                        <p className="text-sm mt-1">{selectedDeliveryForView.dropoff_address}</p>
                      </div>
                    </div>
                  </>
                )}

                {selectedDeliveryForView.dropoff_stops && selectedDeliveryForView.dropoff_stops.length > 0 && (
                  <div className="mt-4">
                    <Label className="text-xs text-muted-foreground">Additional Stops</Label>
                    <div className="space-y-2 mt-2">
                      {selectedDeliveryForView.dropoff_stops.map((stop: any, idx: number) => (
                        <div key={idx} className="flex gap-2 p-2 bg-muted rounded text-sm">
                          <span className="font-semibold text-muted-foreground">Stop {idx + 1}:</span>
                          <span>{stop.address || stop}</span>
                        </div>
                      ))}
                    </div>
                  </div>
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
                      {(selectedDeliveryForView.distance_km || selectedDeliveryForView.estimated_distance || 0).toFixed(1)} km
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Total Price</Label>
                    <p className="mt-1 font-semibold text-lg">
                      ₱{selectedDeliveryForView.total_price || selectedDeliveryForView.estimated_cost || 0}
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
                      {vehicleTypes.find(vt => vt.id === selectedDeliveryForView.vehicle_type_id)?.name || 'Not specified'}
                    </p>
                  </div>
                )}

                {selectedDeliveryForView.is_scheduled && (
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
                        {selectedDeliveryForView.scheduled_pickup_time 
                          ? new Date(selectedDeliveryForView.scheduled_pickup_time).toLocaleString()
                          : 'Not scheduled'}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {selectedDeliveryForView.driver_id && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Truck className="h-4 w-4" />
                      Assigned Driver
                    </h3>
                    <div className="p-3 bg-primary/5 rounded-lg">
                      <p className="text-sm text-muted-foreground">Driver ID</p>
                      <p className="font-mono text-sm">{selectedDeliveryForView.driver_id}</p>
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
                {isProcessingCsv ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing {csvData.length} orders...
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
