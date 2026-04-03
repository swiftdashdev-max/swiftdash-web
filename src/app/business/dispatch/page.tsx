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
  Upload,
  FileSpreadsheet,
  Download,
  Link as LinkIcon,
  Copy,
  ExternalLink,
  CreditCard,
  StickyNote,
  RotateCcw,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Ban,
  FileDown,
  ClipboardList,
  Printer,
  Eye,
} from 'lucide-react';
import { GooglePlacesAutocomplete } from '@/components/google-places-autocomplete';
import { GoogleMapsLoader } from '@/components/google-maps-loader';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { formatDuration } from '@/lib/mapbox-routing';
import { format } from 'date-fns';
import jsPDF from 'jspdf';

interface Delivery {
  id: string;
  tracking_number?: string;
  status: string;
  pickup_address: string;
  delivery_address: string;
  pickup_latitude?: number;
  pickup_longitude?: number;
  delivery_latitude?: number;
  delivery_longitude?: number;
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
  estimated_duration?: number;
}

interface DeliveryStop {
  id: string;
  stop_number: number;
  address: string;
  recipient_name?: string;
  recipient_phone?: string;
  delivery_notes?: string;
  status: string;
  completed_at?: string | null;
  tracking_code?: string;
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
  const [viewStops, setViewStops] = useState<DeliveryStop[]>([]);
  const [loadingStops, setLoadingStops] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedStopId, setCopiedStopId] = useState<string | null>(null);
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
  const [selectedDriver, setSelectedDriver] = useState<string>('');
  const [assigning, setAssigning] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'last7' | 'custom' | 'all'>('all');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const itemsPerPage = 50;

  // Sorting
  const [sortColumn, setSortColumn] = useState<string>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Cancel confirmation dialog
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelTargetIds, setCancelTargetIds] = useState<string[]>([]);
  const [isBatchCancelling, setIsBatchCancelling] = useState(false);

  // Server-side status counts
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({
    total: 0, pending: 0, driver_offered: 0, driver_assigned: 0,
    in_transit: 0, delivered: 0, cancelled: 0,
  });
  const [totalRevenue, setTotalRevenue] = useState(0);
  
  // Fleet
  const [fleetVehicles, setFleetVehicles] = useState<FleetVehicle[]>([]);
  
  // Pricing
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [selectedVehicleType, setSelectedVehicleType] = useState<string>('');
  const [pricingDetails, setPricingDetails] = useState<PricingDetails | null>(null);
  
  // Driver search in assign modal
  const [driverSearchQuery, setDriverSearchQuery] = useState('');

  // CSV Import state
  const [showCsvImportModal, setShowCsvImportModal] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [isProcessingCsv, setIsProcessingCsv] = useState(false);
  const [csvImportSuccess, setCsvImportSuccess] = useState(0);
  const [csvProgress, setCsvProgress] = useState<{ current: number; total: number; stage: string } | null>(null);

  // Manifest state
  const [showManifestsPanel, setShowManifestsPanel] = useState(false);
  const [manifests, setManifests] = useState<any[]>([]);
  const [loadingManifests, setLoadingManifests] = useState(false);
  const [selectedManifest, setSelectedManifest] = useState<any | null>(null);
  const [manifestItems, setManifestItems] = useState<any[]>([]);
  const [loadingManifestItems, setLoadingManifestItems] = useState(false);

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
  }, [currentPage, sortColumn, sortDirection, dateFilter, customDateRange]);

  const fetchData = async () => {
    try {
      setLoading(true);

      if (!businessId) {
        console.error('❌ No business_id available');
        setLoading(false);
        return;
      }

      // Build date range helper
      const now = new Date();
      let dateStart: string | null = null;
      let dateEnd: string | null = null;
      if (dateFilter === 'today') {
        dateStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      } else if (dateFilter === 'yesterday') {
        dateStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString();
        dateEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      } else if (dateFilter === 'last7') {
        dateStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      } else if (dateFilter === 'custom' && customDateRange?.from) {
        dateStart = new Date(customDateRange.from.getFullYear(), customDateRange.from.getMonth(), customDateRange.from.getDate()).toISOString();
        if (customDateRange.to) {
          dateEnd = new Date(customDateRange.to.getFullYear(), customDateRange.to.getMonth(), customDateRange.to.getDate() + 1).toISOString();
        } else {
          dateEnd = new Date(customDateRange.from.getFullYear(), customDateRange.from.getMonth(), customDateRange.from.getDate() + 1).toISOString();
        }
      }

      // Fetch total count for pagination (with date filter applied)
      let countQuery = supabase
        .from('deliveries')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId);
      if (dateStart) countQuery = countQuery.gte('created_at', dateStart);
      if (dateEnd) countQuery = countQuery.lt('created_at', dateEnd);
      const { count } = await countQuery;
      
      setTotalCount(count || 0);

      // Fetch server-side status counts (parallel queries)
      const statusesToCount = ['pending', 'driver_offered', 'driver_assigned', 'delivered', 'cancelled'];
      const inTransitStatuses = ['going_to_pickup', 'pickup_arrived', 'package_collected', 'in_transit', 'at_destination'];

      const countPromises = statusesToCount.map(async (status) => {
        let q = supabase.from('deliveries').select('*', { count: 'exact', head: true })
          .eq('business_id', businessId).eq('status', status);
        if (dateStart) q = q.gte('created_at', dateStart);
        if (dateEnd) q = q.lt('created_at', dateEnd);
        const { count: c } = await q;
        return { status, count: c || 0 };
      });

      // In-transit is a group of statuses
      const inTransitPromise = (async () => {
        let q = supabase.from('deliveries').select('*', { count: 'exact', head: true })
          .eq('business_id', businessId).in('status', inTransitStatuses);
        if (dateStart) q = q.gte('created_at', dateStart);
        if (dateEnd) q = q.lt('created_at', dateEnd);
        const { count: c } = await q;
        return c || 0;
      })();

      // Revenue sum — fetch delivered orders' total_price
      const revenuePromise = (async () => {
        let q = supabase.from('deliveries').select('total_price')
          .eq('business_id', businessId).eq('status', 'delivered');
        if (dateStart) q = q.gte('created_at', dateStart);
        if (dateEnd) q = q.lt('created_at', dateEnd);
        const { data: revData } = await q;
        return (revData || []).reduce((sum: number, d: any) => sum + (d.total_price || 0), 0);
      })();

      const [countsResults, inTransitCount, revenue] = await Promise.all([
        Promise.all(countPromises),
        inTransitPromise,
        revenuePromise,
      ]);

      const newCounts: Record<string, number> = { total: count || 0, in_transit: inTransitCount };
      countsResults.forEach(({ status, count: c }) => { newCounts[status] = c; });
      setStatusCounts(newCounts);
      setTotalRevenue(revenue);

      // Fetch deliveries with pagination and sorting
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      
      let deliveriesQuery = supabase
        .from('deliveries')
        .select('id, tracking_number, status, pickup_address, delivery_address, pickup_latitude, pickup_longitude, delivery_latitude, delivery_longitude, vehicle_type_id, distance_km, total_price, is_scheduled, scheduled_pickup_time, created_at, driver_id, pickup_contact_name, pickup_contact_phone, delivery_contact_name, delivery_contact_phone, is_multi_stop, total_stops, business_id, fleet_vehicle_id, payment_status, payment_method, payment_by, delivery_fee, total_amount, package_description, delivery_notes, estimated_duration')
        .eq('business_id', businessId)
        .order(sortColumn, { ascending: sortDirection === 'asc' })
        .range(from, to);

      if (dateStart) deliveriesQuery = deliveriesQuery.gte('created_at', dateStart);
      if (dateEnd) deliveriesQuery = deliveriesQuery.lt('created_at', dateEnd);

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

  // ── Manifest functions ──────────────────────────────────
  const fetchManifests = async () => {
    if (!businessId) return;
    setLoadingManifests(true);
    try {
      const { data, error } = await supabase
        .from('delivery_manifests')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (!error) setManifests(data || []);
    } catch (e) {
      console.error('Error fetching manifests:', e);
    } finally {
      setLoadingManifests(false);
    }
  };

  const fetchManifestItems = async (manifestId: string) => {
    setLoadingManifestItems(true);
    try {
      const { data, error } = await supabase
        .from('manifest_items')
        .select('*')
        .eq('manifest_id', manifestId)
        .order('sort_order', { ascending: true });
      if (!error) setManifestItems(data || []);
    } catch (e) {
      console.error('Error fetching manifest items:', e);
    } finally {
      setLoadingManifestItems(false);
    }
  };

  const handleViewManifest = async (manifest: any) => {
    setSelectedManifest(manifest);
    await fetchManifestItems(manifest.id);
  };

  const handleDownloadManifestCSV = (manifest: any, items: any[]) => {
    const headers = [
      '#', 'Reference #', 'Item Name', 'Qty', 'Weight (kg)',
      'L (cm)', 'W (cm)', 'H (cm)', 'Cargo Type', 'Declared Value (₱)',
      'COD (₱)', 'Recipient', 'Phone', 'Address', 'Notes', 'Status'
    ];
    const rows = items.map((item, i) => [
      i + 1,
      item.reference_number || '',
      `"${(item.item_name || '').replace(/"/g, '""')}"`,
      item.quantity || 1,
      item.weight_kg || '',
      item.length_cm || '',
      item.width_cm || '',
      item.height_cm || '',
      item.cargo_type || 'standard',
      item.declared_value || '',
      item.cod_amount || '',
      `"${(item.recipient_name || '').replace(/"/g, '""')}"`,
      item.recipient_phone || '',
      `"${(item.recipient_address || '').replace(/"/g, '""')}"`,
      `"${(item.delivery_notes || '').replace(/"/g, '""')}"`,
      item.status || 'pending',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = (manifest.name || 'manifest').replace(/[^a-zA-Z0-9_-]/g, '_');
    a.download = `${safeName}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast({ title: '✅ Downloaded', description: `${items.length} items exported to CSV.` });
  };

  const handlePrintManifest = (manifest: any, items: any[]) => {
    const totalWeight = items.reduce((s: number, i: any) => s + (parseFloat(i.weight_kg) || 0), 0);
    const totalCod = items.reduce((s: number, i: any) => s + (parseFloat(i.cod_amount) || 0), 0);
    const totalValue = items.reduce((s: number, i: any) => s + (parseFloat(i.declared_value) || 0), 0);
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>${manifest.name || 'Cargo Manifest'}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; color: #111; font-size: 11px; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; border-bottom: 2px solid #111; padding-bottom: 12px; }
      .header h1 { font-size: 18px; font-weight: 700; }
      .header .meta { text-align: right; font-size: 10px; color: #555; }
      .summary { display: flex; gap: 24px; margin-bottom: 16px; font-size: 11px; }
      .summary .item { background: #f5f5f5; padding: 8px 12px; border-radius: 4px; }
      .summary .item strong { display: block; font-size: 14px; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th { background: #f0f0f0; font-weight: 600; text-align: left; padding: 6px 8px; border: 1px solid #ddd; font-size: 10px; text-transform: uppercase; }
      td { padding: 5px 8px; border: 1px solid #ddd; font-size: 10px; vertical-align: top; }
      tr:nth-child(even) { background: #fafafa; }
      .badge { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 9px; font-weight: 600; }
      .badge-standard { background: #e0e7ff; color: #3730a3; }
      .badge-fragile { background: #fef3c7; color: #92400e; }
      .badge-perishable { background: #d1fae5; color: #065f46; }
      .badge-hazardous { background: #fee2e2; color: #991b1b; }
      .badge-documents { background: #e0e7ff; color: #3730a3; }
      .footer { margin-top: 16px; border-top: 1px solid #ddd; padding-top: 12px; display: flex; justify-content: space-between; font-size: 10px; color: #555; }
      .signatures { margin-top: 32px; display: flex; justify-content: space-between; }
      .sig-block { width: 200px; text-align: center; font-size: 10px; }
      .sig-line { border-top: 1px solid #111; margin-top: 40px; padding-top: 4px; }
      @media print { body { padding: 12px; } }
    </style></head><body>
    <div class="header">
      <div>
        <h1>📦 CARGO MANIFEST</h1>
        <p style="margin-top:4px;font-size:13px;font-weight:600">${manifest.name || 'Untitled Manifest'}</p>
        ${manifest.notes ? `<p style="margin-top:2px;color:#555">${manifest.notes}</p>` : ''}
      </div>
      <div class="meta">
        <p>Date: ${new Date(manifest.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        <p>ID: ${manifest.id.substring(0, 8).toUpperCase()}</p>
        <p>Status: ${manifest.status.toUpperCase()}</p>
      </div>
    </div>
    <div class="summary">
      <div class="item">Items<strong>${items.length}</strong></div>
      <div class="item">Total Weight<strong>${totalWeight.toFixed(1)} kg</strong></div>
      <div class="item">Declared Value<strong>₱${totalValue.toLocaleString()}</strong></div>
      <div class="item">COD to Collect<strong>₱${totalCod.toLocaleString()}</strong></div>
    </div>
    <table>
      <thead><tr>
        <th>#</th><th>Ref</th><th>Item</th><th>Qty</th><th>kg</th><th>Dims</th><th>Type</th><th>Value</th><th>COD</th><th>Recipient</th><th>Phone</th><th>Address</th><th>Notes</th>
      </tr></thead>
      <tbody>
        ${items.map((item: any, i: number) => `<tr>
          <td>${i + 1}</td>
          <td>${item.reference_number || '-'}</td>
          <td><strong>${item.item_name}</strong></td>
          <td style="text-align:center">${item.quantity || 1}</td>
          <td style="text-align:right">${item.weight_kg || '-'}</td>
          <td>${item.length_cm ? `${item.length_cm}×${item.width_cm || ''}×${item.height_cm || ''}` : '-'}</td>
          <td><span class="badge badge-${item.cargo_type || 'standard'}">${item.cargo_type || 'standard'}</span></td>
          <td style="text-align:right">${item.declared_value ? '₱' + parseFloat(item.declared_value).toLocaleString() : '-'}</td>
          <td style="text-align:right;font-weight:${parseFloat(item.cod_amount) > 0 ? '600' : '400'}">${item.cod_amount ? '₱' + parseFloat(item.cod_amount).toLocaleString() : '-'}</td>
          <td>${item.recipient_name}</td>
          <td>${item.recipient_phone}</td>
          <td style="max-width:160px">${item.recipient_address}</td>
          <td style="max-width:100px;color:#555">${item.delivery_notes || ''}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div class="footer">
      <span>Total items: ${items.length} · Weight: ${totalWeight.toFixed(1)} kg</span>
      <span>Declared: ₱${totalValue.toLocaleString()} · COD: ₱${totalCod.toLocaleString()}</span>
    </div>
    <div class="signatures">
      <div class="sig-block"><div class="sig-line">Prepared by</div></div>
      <div class="sig-block"><div class="sig-line">Checked by</div></div>
      <div class="sig-block"><div class="sig-line">Received by (Driver)</div></div>
    </div>
    </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  const handleDownloadManifestPDF = (manifest: any, items: any[]) => {
    const totalWeight = items.reduce((s: number, it: any) => s + (parseFloat(it.weight_kg) || 0), 0);
    const totalCod = items.reduce((s: number, it: any) => s + (parseFloat(it.cod_amount) || 0), 0);
    const totalValue = items.reduce((s: number, it: any) => s + (parseFloat(it.declared_value) || 0), 0);

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const marginL = 10;
    const marginR = 10;
    const usableW = pageW - marginL - marginR;
    let y = 12;

    // ── Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('CARGO MANIFEST', marginL, y);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`Date: ${new Date(manifest.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}`, pageW - marginR, y - 4, { align: 'right' });
    doc.text(`ID: ${manifest.id.substring(0, 8).toUpperCase()}  ·  Status: ${manifest.status.toUpperCase()}`, pageW - marginR, y + 1, { align: 'right' });
    doc.setTextColor(0);
    y += 5;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(manifest.name || 'Untitled Manifest', marginL, y);
    if (manifest.notes) {
      y += 4;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text(manifest.notes, marginL, y);
      doc.setTextColor(0);
    }
    y += 3;
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(marginL, y, pageW - marginR, y);
    y += 5;

    // ── Summary boxes
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const summaryItems = [
      { label: 'Items', value: `${items.length}` },
      { label: 'Total Weight', value: `${totalWeight.toFixed(1)} kg` },
      { label: 'Declared Value', value: `₱${totalValue.toLocaleString()}` },
      { label: 'COD to Collect', value: `₱${totalCod.toLocaleString()}` },
    ];
    const boxW = 45;
    const boxH = 12;
    summaryItems.forEach((s, i) => {
      const bx = marginL + i * (boxW + 4);
      doc.setFillColor(245, 245, 245);
      doc.roundedRect(bx, y, boxW, boxH, 1.5, 1.5, 'F');
      doc.setTextColor(100);
      doc.setFontSize(7);
      doc.text(s.label, bx + 3, y + 4);
      doc.setTextColor(0);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(s.value, bx + 3, y + 9.5);
      doc.setFont('helvetica', 'normal');
    });
    y += boxH + 6;

    // ── Table header
    const cols = [
      { label: '#', w: 7 },
      { label: 'Ref', w: 18 },
      { label: 'Item', w: 38 },
      { label: 'Qty', w: 10 },
      { label: 'kg', w: 12 },
      { label: 'Dims', w: 22 },
      { label: 'Type', w: 18 },
      { label: 'Value', w: 18 },
      { label: 'COD', w: 18 },
      { label: 'Recipient', w: 28 },
      { label: 'Phone', w: 24 },
      { label: 'Address', w: 50 },
      { label: 'Notes', w: 14 },
    ];
    const rowH = 6;
    const headerH = 7;

    const drawTableHeader = (yPos: number) => {
      doc.setFillColor(240, 240, 240);
      doc.rect(marginL, yPos, usableW, headerH, 'F');
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(50);
      let cx = marginL;
      cols.forEach(col => {
        doc.text(col.label.toUpperCase(), cx + 1.5, yPos + 4.8);
        cx += col.w;
      });
      doc.setTextColor(0);
      doc.setFont('helvetica', 'normal');
      return yPos + headerH;
    };

    y = drawTableHeader(y);

    // ── Table rows
    doc.setFontSize(6.5);
    items.forEach((item: any, i: number) => {
      if (y + rowH > pageH - 20) {
        doc.addPage();
        y = 12;
        y = drawTableHeader(y);
        doc.setFontSize(6.5);
      }

      if (i % 2 === 1) {
        doc.setFillColor(250, 250, 250);
        doc.rect(marginL, y, usableW, rowH, 'F');
      }

      // Light grid line
      doc.setDrawColor(220);
      doc.setLineWidth(0.1);
      doc.line(marginL, y + rowH, pageW - marginR, y + rowH);

      let cx = marginL;
      const textY = y + 4;
      const clip = (val: string, maxW: number) => {
        if (doc.getTextWidth(val) <= maxW - 2) return val;
        while (val.length > 0 && doc.getTextWidth(val + '…') > maxW - 2) val = val.slice(0, -1);
        return val + '…';
      };

      doc.setTextColor(120);
      doc.text(`${i + 1}`, cx + 1.5, textY); cx += cols[0].w;
      doc.setTextColor(0);
      doc.text(clip(item.reference_number || '-', cols[1].w), cx + 1.5, textY); cx += cols[1].w;
      doc.setFont('helvetica', 'bold');
      doc.text(clip(item.item_name || '', cols[2].w), cx + 1.5, textY); cx += cols[2].w;
      doc.setFont('helvetica', 'normal');
      doc.text(`${item.quantity || 1}`, cx + 1.5, textY); cx += cols[3].w;
      doc.text(item.weight_kg ? `${item.weight_kg}` : '-', cx + 1.5, textY); cx += cols[4].w;
      doc.text(item.length_cm ? `${item.length_cm}×${item.width_cm || ''}×${item.height_cm || ''}` : '-', cx + 1.5, textY); cx += cols[5].w;
      doc.text(clip(item.cargo_type || 'standard', cols[6].w), cx + 1.5, textY); cx += cols[6].w;
      doc.text(item.declared_value ? `₱${parseFloat(item.declared_value).toLocaleString()}` : '-', cx + 1.5, textY); cx += cols[7].w;
      if (parseFloat(item.cod_amount) > 0) { doc.setFont('helvetica', 'bold'); }
      doc.text(item.cod_amount ? `₱${parseFloat(item.cod_amount).toLocaleString()}` : '-', cx + 1.5, textY); cx += cols[8].w;
      doc.setFont('helvetica', 'normal');
      doc.text(clip(item.recipient_name || '', cols[9].w), cx + 1.5, textY); cx += cols[9].w;
      doc.text(clip(item.recipient_phone || '', cols[10].w), cx + 1.5, textY); cx += cols[10].w;
      doc.text(clip(item.recipient_address || '', cols[11].w), cx + 1.5, textY); cx += cols[11].w;
      doc.setTextColor(120);
      doc.text(clip(item.delivery_notes || '', cols[12].w), cx + 1.5, textY);
      doc.setTextColor(0);

      y += rowH;
    });

    // ── Footer
    y += 4;
    if (y > pageH - 30) { doc.addPage(); y = 12; }
    doc.setDrawColor(200);
    doc.setLineWidth(0.3);
    doc.line(marginL, y, pageW - marginR, y);
    y += 5;
    doc.setFontSize(7);
    doc.setTextColor(100);
    doc.text(`Total items: ${items.length}  ·  Weight: ${totalWeight.toFixed(1)} kg  ·  Declared: ₱${totalValue.toLocaleString()}  ·  COD: ₱${totalCod.toLocaleString()}`, marginL, y);

    // ── Signature blocks
    y += 12;
    if (y > pageH - 25) { doc.addPage(); y = 12; }
    const sigLabels = ['Prepared by', 'Checked by', 'Received by (Driver)'];
    const sigW = 55;
    const sigGap = (usableW - sigW * 3) / 2;
    sigLabels.forEach((label, idx) => {
      const sx = marginL + idx * (sigW + sigGap);
      doc.setDrawColor(0);
      doc.setLineWidth(0.3);
      doc.line(sx, y + 15, sx + sigW, y + 15);
      doc.setFontSize(7);
      doc.setTextColor(80);
      doc.text(label, sx + sigW / 2, y + 19, { align: 'center' });
    });

    // ── Page numbers
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFontSize(6.5);
      doc.setTextColor(150);
      doc.text(`Page ${p} of ${totalPages}`, pageW - marginR, pageH - 5, { align: 'right' });
      doc.text('SwiftDash · Cargo Manifest', marginL, pageH - 5);
    }

    const safeName = (manifest.name || 'manifest').replace(/[^a-zA-Z0-9_-]/g, '_');
    doc.save(`${safeName}_${new Date().toISOString().split('T')[0]}.pdf`);
    toast({ title: '✅ PDF Downloaded', description: `Manifest with ${items.length} items saved as PDF.` });
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

  const handleAssign = () => {
    if (selectedDeliveries.length === 0) {
      alert('Please select at least one delivery to assign');
      return;
    }
    // Reset assignment state
    setSelectedDriver('');
    setSelectedVehicleType('');
    setPricingDetails(null);
    setDriverSearchQuery('');
    setShowAssignModal(true);
  };

  // Helper: send tracking SMS + email, with multi-stop stop-specific links when applicable
  const sendTrackingNotifications = async (deliveryId: string) => {
    try {
      const delivery = deliveries.find(d => d.id === deliveryId);
      if (delivery?.is_multi_stop) {
        // Fetch stop tracking codes so each recipient gets their own private link
        const { data: stops } = await supabase
          .from('delivery_stops')
          .select('stop_number, tracking_code, recipient_name, recipient_phone, address')
          .eq('delivery_id', deliveryId)
          .gt('stop_number', 0)
          .order('stop_number');

        if (stops && stops.length > 0) {
          const stopTrackingCodes = stops
            .filter((s: any) => s.recipient_phone && s.tracking_code)
            .map((s: any) => ({
              trackingCode: s.tracking_code,
              recipientPhone: s.recipient_phone,
              recipientName: s.recipient_name || 'Customer',
              stopNumber: s.stop_number,
              address: s.address,
            }));

          sendTrackingSms({ deliveryId, isMultiStop: true, stopTrackingCodes }).catch(() => {});
          // Email: stop recipients don't have email addresses in delivery_stops,
          // so send the parent tracking email to the main delivery contact only
          sendTrackingEmail({ deliveryId }).catch(() => {});
          return;
        }
      }
      // Fallback: single-stop or no stops found
      sendTrackingSms({ deliveryId }).catch(() => {});
      sendTrackingEmail({ deliveryId }).catch(() => {});
    } catch {
      // Non-fatal — at least try plain send
      sendTrackingSms({ deliveryId }).catch(() => {});
      sendTrackingEmail({ deliveryId }).catch(() => {});
    }
  };

  const handleAutoAssign = async () => {
    try {
      setAssigning(true);

      let successCount = 0;
      let failCount = 0;
      let noDriverCount = 0;

      // Use Edge Function for auto-assignment
      for (const deliveryId of selectedDeliveries) {
        try {
          const result = await pairDriver(deliveryId);
          
          // Check if no driver was available (edge function returns ok:false, no_driver:true)
          if (result && !result.ok && result.no_driver) {
            noDriverCount++;
            console.warn(`⚠️ No fleet driver available for ${deliveryId}: ${result.message}`);
          } else if (result && result.ok) {
            successCount++;
            console.log(`✅ Successfully assigned driver to delivery ${deliveryId}:`, result);
            // Send tracking notifications — each multi-stop recipient gets their own link
            sendTrackingNotifications(deliveryId);
          } else {
            failCount++;
            console.warn(`⚠️ Assignment returned unexpected result for ${deliveryId}:`, result);
          }
        } catch (err) {
          failCount++;
          console.error(`❌ Error calling pair-driver for ${deliveryId}:`, err);
        }
      }

      // Refresh data and close modal
      await fetchData();
      setShowAssignModal(false);
      setSelectedDeliveries([]);

      // Show appropriate toast based on results
      if (noDriverCount > 0 && successCount === 0) {
        toast({ 
          title: '⚠️ No Fleet Drivers Available', 
          description: `${noDriverCount} delivery(ies) could not be assigned. Ensure drivers are online and within range.`,
          variant: 'destructive'
        });
      } else if (noDriverCount > 0 && successCount > 0) {
        toast({ 
          title: '⚠️ Partial Assignment', 
          description: `${successCount} assigned, ${noDriverCount} had no available driver. Check fleet status.`,
        });
      } else if (failCount > 0) {
        toast({ 
          title: '⚠️ Some Assignments Failed', 
          description: `${successCount} assigned, ${failCount} failed.`,
          variant: 'destructive'
        });
      } else {
        toast({ title: '✅ Assigned', description: `${successCount} delivery(ies) assigned successfully.` });
      }
    } catch (error) {
      console.error('❌ Error auto-assigning:', error);
      toast({ title: 'Assignment failed', description: String(error), variant: 'destructive' });
    } finally {
      setAssigning(false);
    }
  };

  const handleManualAssign = async () => {
    if (!selectedDriver) {
      toast({ title: 'No driver selected', description: 'Please select a driver to assign.', variant: 'destructive' });
      return;
    }
    if (selectedDeliveries.length === 0) {
      toast({ title: 'No deliveries selected', description: 'Please select at least one delivery.', variant: 'destructive' });
      return;
    }

    try {
      setAssigning(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const driver = drivers.find(d => d.id === selectedDriver);
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      for (const deliveryId of selectedDeliveries) {
        const delivery = deliveries.find(d => d.id === deliveryId);
        if (!delivery) continue;

        // Find if this driver has an associated fleet vehicle
        const fleetVehicle = fleetVehicles.find(v => v.assigned_driver_id === selectedDriver);
        const pricing = driver?.vehicle_type_id
          ? calculatePricing(driver.vehicle_type_id, delivery.distance_km || 0)
          : null;

        const assignParams = {
          delivery_id: deliveryId,
          driver_id: selectedDriver,
          assigned_by: user.id,
          assignment_type: 'manual',
          driver_source: 'fleet',
          vehicle_type_id: driver?.vehicle_type_id || null,
          fleet_vehicle_id: fleetVehicle?.id || null,
          total_price: pricing?.total || 0,
          delivery_fee: pricing?.total || 0,
          payment_by: null,
          payment_method: null,
        };

        console.log('🚛 Assigning driver:', assignParams);

        const response = await fetch(`${supabaseUrl}/functions/v1/assign-business-driver`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'apikey': supabaseAnonKey || '',
          },
          body: JSON.stringify(assignParams),
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || `Assignment failed for delivery ${deliveryId}`);
        }

        sendTrackingNotifications(deliveryId);
      }

      await fetchData();
      setShowAssignModal(false);
      setSelectedDeliveries([]);
      setSelectedDriver('');
      setDriverSearchQuery('');
      toast({ title: '✅ Driver assigned', description: `${selectedDeliveries.length} delivery(ies) assigned to ${driver?.full_name || 'driver'}.` });
    } catch (error) {
      console.error('❌ Error assigning:', error);
      toast({ title: 'Assignment failed', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setAssigning(false);
    }
  };

  const handleCancelDelivery = async (id: string) => {
    setCancelTargetIds([id]);
    setShowCancelDialog(true);
  };

  const handleBatchCancel = () => {
    if (selectedDeliveries.length === 0) return;
    // Filter out delivered/cancelled orders from batch cancel
    const cancellable = selectedDeliveries.filter(id => {
      const d = deliveries.find(del => del.id === id);
      return d && !['delivered', 'cancelled'].includes(d.status);
    });
    if (cancellable.length === 0) {
      toast({ title: 'Cannot cancel', description: 'All selected deliveries are already delivered or cancelled.', variant: 'destructive' });
      return;
    }
    if (cancellable.length < selectedDeliveries.length) {
      toast({ title: 'Note', description: `${selectedDeliveries.length - cancellable.length} delivered/cancelled order(s) were excluded.` });
    }
    setCancelTargetIds(cancellable);
    setShowCancelDialog(true);
  };

  const confirmCancelDeliveries = async () => {
    if (cancelTargetIds.length === 0) return;
    setIsBatchCancelling(true);

    try {
      const results = await Promise.allSettled(
        cancelTargetIds.map(async (id) => {
          const { error } = await supabase
            .from('deliveries')
            .update({ status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('id', id);
          if (error) throw error;
          return id;
        })
      );

      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      // Update local state
      const cancelledIds = results
        .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
        .map(r => r.value);

      setDeliveries(prev =>
        prev.map(d =>
          cancelledIds.includes(d.id)
            ? { ...d, status: 'cancelled', updated_at: new Date().toISOString() }
            : d
        )
      );

      if (selectedDeliveryForView && cancelledIds.includes(selectedDeliveryForView.id)) {
        setShowDetailsPanel(false);
        setSelectedDeliveryForView(null);
      }

      setSelectedDeliveries(prev => prev.filter(id => !cancelledIds.includes(id)));

      if (failed > 0) {
        toast({ title: `Cancelled ${succeeded} of ${cancelTargetIds.length}`, description: `${failed} failed to cancel.`, variant: 'destructive' });
      } else {
        toast({ title: '🚫 Cancelled', description: `${succeeded} delivery(ies) cancelled successfully.` });
      }
    } catch (error) {
      console.error('❌ Error cancelling deliveries:', error);
      toast({ title: 'Cancel failed', description: (error as any).message, variant: 'destructive' });
    } finally {
      setIsBatchCancelling(false);
      setShowCancelDialog(false);
      setCancelTargetIds([]);
    }
  };

  const handleViewDetails = async (delivery: Delivery) => {
    setSelectedDeliveryForView(delivery);
    setEditFormData(delivery);
    setIsEditingDetails(false);
    setDriverDetails(null);
    setViewStops([]);
    setShowDetailsPanel(true);

    // Fetch stops for multi-stop deliveries
    if (delivery.is_multi_stop) {
      setLoadingStops(true);
      try {
        const { data: stops } = await supabase
          .from('delivery_stops')
          .select('id,stop_number,address,recipient_name,recipient_phone,delivery_notes,status,completed_at,tracking_code')
          .eq('delivery_id', delivery.id)
          .gt('stop_number', 0)
          .order('stop_number');
        setViewStops(stops || []);
      } finally {
        setLoadingStops(false);
      }
    }

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
          pickup_latitude: editFormData.pickup_latitude,
          pickup_longitude: editFormData.pickup_longitude,
          delivery_address: editFormData.delivery_address,
          delivery_latitude: editFormData.delivery_latitude,
          delivery_longitude: editFormData.delivery_longitude,
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

  const handleCopyStopLink = (stop: DeliveryStop) => {
    if (!stop.tracking_code) return;
    const link = `${window.location.origin}/track/${stop.tracking_code}`;
    navigator.clipboard.writeText(link);
    setCopiedStopId(stop.id);
    toast({
      title: '📋 Stop Link Copied!',
      description: `Private tracking link for Stop ${stop.stop_number}${stop.recipient_name ? ` (${stop.recipient_name})` : ''} copied.`,
    });
    setTimeout(() => setCopiedStopId(null), 2000);
  };

  const handleReassign = (delivery: Delivery) => {
    setSelectedDeliveries([delivery.id]);
    setShowDetailsPanel(false);
    setSelectedDriver('');
    setDriverSearchQuery('');
    setPricingDetails(null);
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

  // CSV Export — export current filtered view
  const handleExportCsv = async () => {
    try {
      // Fetch ALL deliveries matching current filters (no pagination limit)
      let q = supabase
        .from('deliveries')
        .select('tracking_number, status, pickup_address, delivery_address, pickup_contact_name, pickup_contact_phone, delivery_contact_name, delivery_contact_phone, distance_km, total_price, payment_status, payment_method, is_multi_stop, total_stops, package_description, delivery_notes, created_at')
        .eq('business_id', businessId!)
        .order(sortColumn, { ascending: sortDirection === 'asc' });

      const now = new Date();
      if (dateFilter === 'today') {
        q = q.gte('created_at', new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString());
      } else if (dateFilter === 'yesterday') {
        q = q.gte('created_at', new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString())
             .lt('created_at', new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString());
      } else if (dateFilter === 'last7') {
        q = q.gte('created_at', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString());
      }

      // Apply status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'in_transit') {
          q = q.in('status', ['going_to_pickup', 'pickup_arrived', 'package_collected', 'in_transit', 'at_destination']);
        } else if (statusFilter === 'delivered') {
          q = q.in('status', ['delivered', 'cancelled']);
        } else {
          q = q.eq('status', statusFilter);
        }
      }

      const { data, error } = await q;
      if (error) throw error;
      if (!data || data.length === 0) {
        toast({ title: 'Nothing to export', description: 'No deliveries match the current filters.' });
        return;
      }

      const headers = ['Tracking #', 'Status', 'Pickup Address', 'Dropoff Address', 'Sender Name', 'Sender Phone', 'Recipient Name', 'Recipient Phone', 'Distance (km)', 'Total (₱)', 'Payment Status', 'Payment Method', 'Type', 'Stops', 'Package', 'Notes', 'Created'];
      const rows = data.map(d => [
        d.tracking_number || '',
        d.status || '',
        `"${(d.pickup_address || '').replace(/"/g, '""')}"`,
        `"${(d.delivery_address || '').replace(/"/g, '""')}"`,
        d.pickup_contact_name || '',
        d.pickup_contact_phone || '',
        d.delivery_contact_name || '',
        d.delivery_contact_phone || '',
        (d.distance_km || 0).toFixed(1),
        d.total_price || 0,
        d.payment_status || '',
        d.payment_method || '',
        d.is_multi_stop ? 'Multi-Stop' : 'Single',
        d.total_stops || 1,
        `"${(d.package_description || '').replace(/"/g, '""')}"`,
        `"${(d.delivery_notes || '').replace(/"/g, '""')}"`,
        new Date(d.created_at).toLocaleString(),
      ]);

      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dispatch_export_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({ title: '✅ Exported', description: `${data.length} deliveries exported to CSV.` });
    } catch (error) {
      console.error('❌ Export error:', error);
      toast({ title: 'Export failed', description: (error as any).message, variant: 'destructive' });
    }
  };

  // Column sorting handler
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection(column === 'created_at' ? 'desc' : 'asc');
    }
    setCurrentPage(1);
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDirection === 'asc'
      ? <ChevronUp className="h-3 w-3 ml-1 text-primary" />
      : <ChevronDown className="h-3 w-3 ml-1 text-primary" />;
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

  // Use server-side counts (updated by fetchData)
  const pendingCount = statusCounts.pending || 0;
  const offeredCount = statusCounts.driver_offered || 0;
  const assignedCount = statusCounts.driver_assigned || 0;
  const inTransitCount = statusCounts.in_transit || 0;
  const deliveredCount = statusCounts.delivered || 0;

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
      {/* Load Google Maps API for address autocomplete */}
      <GoogleMapsLoader />

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
          <Button variant="outline" onClick={() => { setShowManifestsPanel(true); fetchManifests(); }}>
            <ClipboardList className="h-4 w-4 mr-2" />
            Manifests
          </Button>
          <Button variant="outline" onClick={handleExportCsv}>
            <FileDown className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
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
            <div className="text-2xl font-bold">{statusCounts.total || totalCount}</div>
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
            <div className="text-2xl font-bold">{statusCounts.delivered || 0}</div>
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
              <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={handleBatchCancel}>
                <Ban className="h-4 w-4 mr-2" />
                Cancel Selected
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
            <Select value={dateFilter} onValueChange={(v) => {
              if (v === 'custom') {
                setDateFilter('custom');
                setShowDatePicker(true);
              } else {
                setDateFilter(v as any);
                setCustomDateRange(undefined);
                setCurrentPage(1);
              }
            }}>
              <SelectTrigger className="w-44">
                <Calendar className="h-4 w-4 mr-2" />
                {dateFilter === 'custom' && customDateRange?.from
                  ? <span className="text-xs truncate">
                      {format(customDateRange.from, 'MMM d')}
                      {customDateRange.to ? ` – ${format(customDateRange.to, 'MMM d')}` : ''}
                    </span>
                  : <SelectValue />
                }
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="last7">Last 7 Days</SelectItem>
                <SelectItem value="custom">Custom Range…</SelectItem>
              </SelectContent>
            </Select>
            <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
              <PopoverTrigger asChild>
                <span />
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarPicker
                  mode="range"
                  selected={customDateRange}
                  onSelect={(range) => {
                    setCustomDateRange(range);
                    if (range?.from && range?.to) {
                      setShowDatePicker(false);
                      setCurrentPage(1);
                    }
                  }}
                  numberOfMonths={2}
                  disabled={{ after: new Date() }}
                />
              </PopoverContent>
            </Popover>
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
                <TableHead>
                  <button onClick={() => handleSort('tracking_number')} className="flex items-center hover:text-foreground transition-colors">
                    Tracking # <SortIcon column="tracking_number" />
                  </button>
                </TableHead>
                <TableHead>
                  <button onClick={() => handleSort('status')} className="flex items-center hover:text-foreground transition-colors">
                    Status <SortIcon column="status" />
                  </button>
                </TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Pickup</TableHead>
                <TableHead>Dropoff</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>
                  <button onClick={() => handleSort('distance_km')} className="flex items-center hover:text-foreground transition-colors">
                    Distance <SortIcon column="distance_km" />
                  </button>
                </TableHead>
                <TableHead>
                  <button onClick={() => handleSort('total_price')} className="flex items-center hover:text-foreground transition-colors">
                    Cost <SortIcon column="total_price" />
                  </button>
                </TableHead>
                <TableHead>ETA</TableHead>
                <TableHead>
                  <button onClick={() => handleSort('created_at')} className="flex items-center hover:text-foreground transition-colors">
                    Created <SortIcon column="created_at" />
                  </button>
                </TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDeliveries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
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
                        {delivery.is_multi_stop
                          ? <span className="text-indigo-600 font-medium">{delivery.total_stops ?? '?'} stops</span>
                          : delivery.delivery_address}
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
                      {delivery.estimated_duration
                        ? <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDuration(delivery.estimated_duration)}</span>
                        : '—'}
                    </TableCell>
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
                            {delivery.is_multi_stop ? 'Copy Sender Link' : 'Copy Tracking Link'}
                          </DropdownMenuItem>
                          {delivery.is_multi_stop && (
                            <DropdownMenuItem
                              onClick={() => handleViewDetails(delivery)}
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              Copy Per-Stop Links…
                            </DropdownMenuItem>
                          )}
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
                          {!['delivered', 'cancelled'].includes(delivery.status) && (
                            <DropdownMenuItem onClick={() => {
                              handleViewDetails(delivery);
                              setTimeout(() => handleStartEdit(), 100);
                            }}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Details
                            </DropdownMenuItem>
                          )}
                          {!['delivered', 'cancelled'].includes(delivery.status) && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleCancelDelivery(delivery.id)}
                              >
                                <X className="h-4 w-4 mr-2" />
                                Cancel Delivery
                              </DropdownMenuItem>
                            </>
                          )}
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
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Assign Driver
            </DialogTitle>
            <DialogDescription>
              {selectedDeliveries.length === 1
                ? `Assigning 1 delivery — select a driver from your fleet.`
                : `Assigning ${selectedDeliveries.length} deliveries — select a driver from your fleet.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Auto-assign option */}
            <Card
              className="cursor-pointer transition-all border-2 hover:border-primary/50 hover:bg-muted/30"
              onClick={handleAutoAssign}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary flex-shrink-0">
                  <Zap className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold">Auto Assign</h4>
                  <p className="text-sm text-muted-foreground">Let the system pick the best available driver automatically</p>
                </div>
                {assigning && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </CardContent>
            </Card>

            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground font-medium">OR PICK A DRIVER</span>
              <Separator className="flex-1" />
            </div>

            {/* Driver search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, or vehicle..."
                value={driverSearchQuery}
                onChange={(e) => setDriverSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Driver list */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {(() => {
                const fleetDriverIds = new Set(fleetVehicles.map(v => v.assigned_driver_id).filter(Boolean));
                const filteredDrivers = drivers.filter(d => {
                  const isFleet = fleetDriverIds.has(d.id) || d.managed_by_business_id === businessId;
                  const q = driverSearchQuery.toLowerCase();
                  const matchesSearch = !q ||
                    (d.full_name || '').toLowerCase().includes(q) ||
                    (d.phone || '').toLowerCase().includes(q) ||
                    (d.vehicle_model || '').toLowerCase().includes(q) ||
                    (d.plate_number || '').toLowerCase().includes(q);
                  return matchesSearch;
                });

                if (filteredDrivers.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                      <Users className="h-10 w-10 mb-3 opacity-30" />
                      <p className="font-medium text-sm">No drivers found</p>
                      <p className="text-xs mt-1">
                        {driverSearchQuery ? 'Try a different search term' : 'No drivers are currently online'}
                      </p>
                    </div>
                  );
                }

                return filteredDrivers.map((driver) => {
                  const isSelected = selectedDriver === driver.id;
                  const vehicleType = vehicleTypes.find(vt => vt.id === driver.vehicle_type_id);
                  const fleetVehicle = fleetVehicles.find(v => v.assigned_driver_id === driver.id);
                  const isFleet = fleetDriverIds.has(driver.id) || driver.managed_by_business_id === businessId;

                  return (
                    <div
                      key={driver.id}
                      onClick={() => setSelectedDriver(isSelected ? '' : driver.id)}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/40 hover:bg-muted/30'
                      }`}
                    >
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center font-semibold text-sm">
                          {(driver.full_name || 'D').charAt(0).toUpperCase()}
                        </div>
                        <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${driver.is_online ? 'bg-green-500' : 'bg-gray-400'}`} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{driver.full_name || `Driver ${driver.id.slice(0, 6)}`}</p>
                          {isFleet && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-blue-300 text-blue-600 flex-shrink-0">Fleet</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{driver.phone || '—'}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {fleetVehicle ? (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Truck className="h-3 w-3" />
                              {fleetVehicle.vehicle_model} · {fleetVehicle.plate_number}
                            </span>
                          ) : driver.vehicle_model ? (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Truck className="h-3 w-3" />
                              {driver.vehicle_model}
                              {driver.plate_number ? ` · ${driver.plate_number}` : ''}
                            </span>
                          ) : null}
                          {vehicleType && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{vehicleType.name}</Badge>
                          )}
                        </div>
                      </div>

                      {/* Rating + selected check */}
                      <div className="flex-shrink-0 flex flex-col items-end gap-1">
                        {driver.rating != null && (
                          <span className="text-xs text-muted-foreground">⭐ {driver.rating.toFixed(1)}</span>
                        )}
                        {isSelected && <CheckCircle2 className="h-5 w-5 text-primary" />}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Selected driver summary */}
            {selectedDriver && (() => {
              const driver = drivers.find(d => d.id === selectedDriver);
              const delivery = selectedDeliveries.length === 1 ? deliveries.find(d => d.id === selectedDeliveries[0]) : null;
              const pricing = driver?.vehicle_type_id && delivery?.distance_km
                ? calculatePricing(driver.vehicle_type_id, delivery.distance_km)
                : null;
              return pricing ? (
                <div className="flex items-center justify-between px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg text-sm">
                  <span className="text-muted-foreground">Estimated cost</span>
                  <span className="font-semibold text-primary">₱{pricing.total.toFixed(2)}</span>
                </div>
              ) : null;
            })()}

            {/* Online count footer */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-2 w-2 bg-green-500 rounded-full" />
              {drivers.filter(d => d.is_online).length} drivers online
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignModal(false)} disabled={assigning}>
              Cancel
            </Button>
            <Button
              onClick={handleManualAssign}
              disabled={assigning || !selectedDriver}
            >
              {assigning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4 mr-2" />
                  Assign Driver
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
                    <Label className="text-xs text-muted-foreground">
                      {selectedDeliveryForView!.is_multi_stop ? 'Sender Tracking Number' : 'Tracking Number'}
                    </Label>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="font-mono font-semibold text-lg">{selectedDeliveryForView!.tracking_number}</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleCopyTrackingLink(selectedDeliveryForView!.tracking_number)}
                        title={selectedDeliveryForView!.is_multi_stop ? 'Copy sender tracking link (shows all stops)' : 'Copy tracking link'}
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
                    {selectedDeliveryForView!.is_multi_stop && (
                      <p className="text-xs text-muted-foreground mt-1">
                        This link shows all stops — use per-stop links below to share with individual recipients.
                      </p>
                    )}
                  </div>
                  {getStatusBadge(selectedDeliveryForView!.status)}
                </div>

                {/* Per-stop tracking links for multi-stop deliveries */}
                {selectedDeliveryForView!.is_multi_stop && viewStops.length > 0 && (
                  <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      <LinkIcon className="h-3 w-3" />
                      Recipient Tracking Links
                    </Label>
                    {viewStops.map((stop) => (
                      <div key={stop.id} className="flex items-center gap-2 text-sm">
                        <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold
                          ${stop.status === 'completed'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                            : 'bg-muted text-muted-foreground'
                          }`}>
                          {stop.stop_number}
                        </span>
                        <span className="flex-1 truncate text-muted-foreground">
                          {stop.recipient_name || stop.address}
                        </span>
                        <code className="text-xs font-mono text-muted-foreground hidden sm:inline">
                          {stop.tracking_code}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 flex-shrink-0"
                          onClick={() => handleCopyStopLink(stop)}
                          title={`Copy private link for Stop ${stop.stop_number}`}
                          disabled={!stop.tracking_code}
                        >
                          {copiedStopId === stop.id ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <a
                          href={`/track/${stop.tracking_code}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-primary flex-shrink-0"
                          title={`Open Stop ${stop.stop_number} tracking page`}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
                
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
                      <div className="mt-1">
                        <GooglePlacesAutocomplete
                          id="edit-pickup"
                          value={editFormData.pickup_address || ''}
                          onChange={(value) => setEditFormData({ ...editFormData, pickup_address: value })}
                          onPlaceSelected={(place) => {
                            setEditFormData({
                              ...editFormData,
                              pickup_address: place.address,
                              pickup_latitude: place.lat,
                              pickup_longitude: place.lng,
                            });
                          }}
                          placeholder="Search pickup address..."
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="dropoff">Dropoff Address</Label>
                      <div className="mt-1">
                        <GooglePlacesAutocomplete
                          id="edit-dropoff"
                          value={editFormData.delivery_address || ''}
                          onChange={(value) => setEditFormData({ ...editFormData, delivery_address: value })}
                          onPlaceSelected={(place) => {
                            setEditFormData({
                              ...editFormData,
                              delivery_address: place.address,
                              delivery_latitude: place.lat,
                              delivery_longitude: place.lng,
                            });
                          }}
                          placeholder="Search dropoff address..."
                        />
                      </div>
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

                    {selectedDeliveryForView!.is_multi_stop ? (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          {loadingStops ? 'Loading stops…' : `${viewStops.length} Dropoff Stops`}
                        </Label>
                        {loadingStops ? (
                          <div className="flex items-center gap-2 p-3 text-muted-foreground text-sm">
                            <Loader2 className="h-4 w-4 animate-spin" /> Loading stop details…
                          </div>
                        ) : viewStops.length === 0 ? (
                          <div className="p-3 bg-muted/40 rounded-lg text-sm text-muted-foreground">
                            No stops found in delivery_stops table.
                          </div>
                        ) : (
                          viewStops.map((stop) => (
                            <div key={stop.id} className="flex gap-3 p-3 rounded-lg border bg-muted/30">
                              <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5
                                ${
                                  stop.status === 'completed'
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                    : stop.status === 'in_progress'
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                                    : 'bg-muted text-muted-foreground'
                                }`}>
                                {stop.stop_number}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{stop.address}</p>
                                {stop.recipient_name && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {stop.recipient_name}{stop.recipient_phone ? ` · ${stop.recipient_phone}` : ''}
                                  </p>
                                )}
                                {stop.delivery_notes && (
                                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">📌 {stop.delivery_notes}</p>
                                )}
                                <div className="flex items-center gap-2 mt-1.5">
                                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium
                                    ${
                                      stop.status === 'completed'
                                        ? 'bg-green-100 text-green-700'
                                        : stop.status === 'in_progress'
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-muted text-muted-foreground'
                                    }`}>
                                    {stop.status === 'completed' ? '✅ Delivered' : stop.status === 'in_progress' ? '🚚 En Route' : '⏳ Pending'}
                                  </span>
                                  {stop.completed_at && (
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(stop.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {stop.tracking_code && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 flex-shrink-0 mt-0.5"
                                  onClick={() => handleCopyStopLink(stop)}
                                  title={`Copy private tracking link for this stop`}
                                >
                                  {copiedStopId === stop.id ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                  ) : (
                                    <LinkIcon className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    ) : (
                      <div className="flex gap-3 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                        <Navigation className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <Label className="text-xs text-red-700 dark:text-red-400">Dropoff</Label>
                          <p className="text-sm mt-1">{selectedDeliveryForView!.delivery_address}</p>
                        </div>
                      </div>
                    )}
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
                {selectedDeliveryForView && !['delivered', 'cancelled'].includes(selectedDeliveryForView.status) && (
                  <Button onClick={handleStartEdit} className="w-full sm:w-auto">
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Details
                  </Button>
                )}
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

      {/* ── Manifests Panel (Sheet) ── */}
      <Sheet open={showManifestsPanel} onOpenChange={setShowManifestsPanel}>
        <SheetContent className="sm:max-w-lg w-full overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Cargo Manifests
            </SheetTitle>
            <SheetDescription>
              View, download, or print saved manifests
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-3">
            {loadingManifests ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : manifests.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No manifests yet.</p>
                <p className="text-xs mt-1">Create one from the Orders page.</p>
              </div>
            ) : (
              manifests.map((m) => (
                <Card key={m.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm truncate">{m.name}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(m.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span>{m.total_items} item{m.total_items !== 1 ? 's' : ''}</span>
                          {m.total_weight_kg && <span>{parseFloat(m.total_weight_kg).toFixed(1)} kg</span>}
                          {m.total_cod && parseFloat(m.total_cod) > 0 && <span>COD ₱{parseFloat(m.total_cod).toLocaleString()}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <Badge variant={
                          m.status === 'completed' ? 'default' :
                          m.status === 'partial' ? 'secondary' :
                          m.status === 'booking' ? 'outline' : 'secondary'
                        } className="text-[10px]">
                          {m.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-1.5 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs flex-1"
                        onClick={(e) => { e.stopPropagation(); handleViewManifest(m); }}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs flex-1"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const { data } = await supabase.from('manifest_items').select('*').eq('manifest_id', m.id).order('sort_order');
                          if (data) handleDownloadManifestCSV(m, data);
                        }}
                      >
                        <FileDown className="h-3 w-3 mr-1" />
                        CSV
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs flex-1"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const { data } = await supabase.from('manifest_items').select('*').eq('manifest_id', m.id).order('sort_order');
                          if (data) handleDownloadManifestPDF(m, data);
                        }}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        PDF
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs flex-1"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const { data } = await supabase.from('manifest_items').select('*').eq('manifest_id', m.id).order('sort_order');
                          if (data) handlePrintManifest(m, data);
                        }}
                      >
                        <Printer className="h-3 w-3 mr-1" />
                        Print
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Manifest Detail Dialog ── */}
      <Dialog open={!!selectedManifest} onOpenChange={(open) => { if (!open) { setSelectedManifest(null); setManifestItems([]); } }}>
        <DialogContent className="max-w-[90vw] w-full max-h-[85vh] flex flex-col p-0 gap-0 [&>button]:hidden">
          {selectedManifest && (
            <>
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
                <div>
                  <DialogTitle className="text-lg font-semibold flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-primary" />
                    {selectedManifest.name}
                  </DialogTitle>
                  <DialogDescription className="text-xs mt-0.5">
                    Created {new Date(selectedManifest.created_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {selectedManifest.notes && ` · ${selectedManifest.notes}`}
                  </DialogDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={selectedManifest.status === 'completed' ? 'default' : 'secondary'}>
                    {selectedManifest.status}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={() => handleDownloadManifestCSV(selectedManifest, manifestItems)}>
                    <FileDown className="h-4 w-4 mr-1.5" />
                    CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDownloadManifestPDF(selectedManifest, manifestItems)}>
                    <Download className="h-4 w-4 mr-1.5" />
                    PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handlePrintManifest(selectedManifest, manifestItems)}>
                    <Printer className="h-4 w-4 mr-1.5" />
                    Print
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { setSelectedManifest(null); setManifestItems([]); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Summary row */}
              <div className="px-6 py-3 border-b bg-muted/30 flex items-center gap-6 text-sm flex-shrink-0">
                <div><span className="text-muted-foreground">Items:</span> <strong>{selectedManifest.total_items}</strong></div>
                {selectedManifest.total_weight_kg && (
                  <div><span className="text-muted-foreground">Weight:</span> <strong>{parseFloat(selectedManifest.total_weight_kg).toFixed(1)} kg</strong></div>
                )}
                {selectedManifest.total_declared_value && parseFloat(selectedManifest.total_declared_value) > 0 && (
                  <div><span className="text-muted-foreground">Declared:</span> <strong>₱{parseFloat(selectedManifest.total_declared_value).toLocaleString()}</strong></div>
                )}
                {selectedManifest.total_cod && parseFloat(selectedManifest.total_cod) > 0 && (
                  <div><span className="text-muted-foreground">COD:</span> <strong className="text-orange-600">₱{parseFloat(selectedManifest.total_cod).toLocaleString()}</strong></div>
                )}
              </div>

              {/* Items table */}
              <div className="flex-1 overflow-y-auto">
                {loadingManifestItems ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : manifestItems.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No items in this manifest.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-[11px]">
                          <TableHead className="w-8 px-2">#</TableHead>
                          <TableHead className="px-2">Ref</TableHead>
                          <TableHead className="px-2">Item Name</TableHead>
                          <TableHead className="px-2 text-center">Qty</TableHead>
                          <TableHead className="px-2 text-right">kg</TableHead>
                          <TableHead className="px-2">Dims (cm)</TableHead>
                          <TableHead className="px-2">Type</TableHead>
                          <TableHead className="px-2 text-right">Value</TableHead>
                          <TableHead className="px-2 text-right">COD</TableHead>
                          <TableHead className="px-2">Recipient</TableHead>
                          <TableHead className="px-2">Phone</TableHead>
                          <TableHead className="px-2">Address</TableHead>
                          <TableHead className="px-2">Notes</TableHead>
                          <TableHead className="px-2">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {manifestItems.map((item, i) => (
                          <TableRow key={item.id}>
                            <TableCell className="text-muted-foreground text-[11px] px-2">{i + 1}</TableCell>
                            <TableCell className="text-xs px-2 font-mono">{item.reference_number || '-'}</TableCell>
                            <TableCell className="text-xs px-2 font-medium">{item.item_name}</TableCell>
                            <TableCell className="text-xs px-2 text-center">{item.quantity}</TableCell>
                            <TableCell className="text-xs px-2 text-right">{item.weight_kg || '-'}</TableCell>
                            <TableCell className="text-xs px-2">
                              {item.length_cm ? `${item.length_cm}×${item.width_cm || ''}×${item.height_cm || ''}` : '-'}
                            </TableCell>
                            <TableCell className="px-2">
                              <Badge variant="outline" className="text-[10px] capitalize">{item.cargo_type}</Badge>
                            </TableCell>
                            <TableCell className="text-xs px-2 text-right">
                              {item.declared_value ? `₱${parseFloat(item.declared_value).toLocaleString()}` : '-'}
                            </TableCell>
                            <TableCell className="text-xs px-2 text-right font-medium">
                              {item.cod_amount && parseFloat(item.cod_amount) > 0
                                ? <span className="text-orange-600">₱{parseFloat(item.cod_amount).toLocaleString()}</span>
                                : '-'}
                            </TableCell>
                            <TableCell className="text-xs px-2">{item.recipient_name}</TableCell>
                            <TableCell className="text-xs px-2 font-mono">{item.recipient_phone}</TableCell>
                            <TableCell className="text-xs px-2 max-w-[200px] truncate" title={item.recipient_address}>{item.recipient_address}</TableCell>
                            <TableCell className="text-xs px-2 text-muted-foreground max-w-[120px] truncate">{item.delivery_notes || '-'}</TableCell>
                            <TableCell className="px-2">
                              <Badge variant={
                                item.status === 'booked' ? 'default' :
                                item.status === 'failed' ? 'destructive' : 'secondary'
                              } className="text-[10px]">
                                {item.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {cancelTargetIds.length === 1 ? 'Cancel Delivery?' : `Cancel ${cancelTargetIds.length} Deliveries?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTargetIds.length === 1
                ? 'This will cancel the delivery. The driver will be unassigned and the customer will be notified. This action cannot be undone.'
                : `This will cancel ${cancelTargetIds.length} selected deliveries. Drivers will be unassigned and customers will be notified. This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBatchCancelling}>Keep</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCancelDeliveries}
              disabled={isBatchCancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isBatchCancelling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                <>
                  <Ban className="h-4 w-4 mr-2" />
                  {cancelTargetIds.length === 1 ? 'Cancel Delivery' : `Cancel ${cancelTargetIds.length} Deliveries`}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
