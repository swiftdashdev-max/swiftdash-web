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

      // Fetch deliveries (pending, driver_offered, driver_assigned - not yet active)
      // Status 'pending' = awaiting driver assignment
      // Status 'driver_offered' = driver has been offered the job
      // Status 'driver_assigned' = driver accepted but hasn't started pickup
      const { data: deliveriesData, error: deliveriesError } = await supabase
        .from('deliveries')
        .select('*')
        .eq('business_id', businessId)
        .in('status', ['pending', 'driver_offered', 'driver_assigned'])
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

  const handleAssign = () => {
    if (selectedDeliveries.length === 0) {
      alert('Please select at least one delivery to assign');
      return;
    }
    setSelectedDriver(''); // Reset driver selection
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
    if (!selectedDriver) {
      alert('Please select a driver');
      return;
    }

    try {
      setAssigning(true);

      // Use Edge Function for manual assignment
      for (const deliveryId of selectedDeliveries) {
        try {
          const result = await supabase.functions.invoke('pair-business-driver', {
            body: { 
              deliveryId,
              mode: 'manual',
              driverId: selectedDriver
            }
          });

          if (result.error) {
            throw new Error(result.error.message);
          }

          console.log(`✅ Successfully manually assigned driver to delivery ${deliveryId}:`, result.data);
        } catch (err) {
          console.error(`❌ Error manually assigning driver to ${deliveryId}:`, err);
          throw err;
        }
      }

      // Refresh data and close modal
      await fetchData();
      setShowAssignModal(false);
      setSelectedDeliveries([]);
      setSelectedDriver('');
      alert(`Successfully assigned driver to ${selectedDeliveries.length} delivery(ies)`);
    } catch (error) {
      console.error('❌ Error manually assigning:', error);
      alert('Failed to manually assign deliveries');
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Drivers</DialogTitle>
            <DialogDescription>
              {selectedDeliveries.length} delivery(ies) selected. Choose how to assign drivers.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
                      System automatically assigns best available drivers based on vehicle type
                      and availability
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
                      Choose a specific driver for the selected deliveries
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Driver Selection for Manual Mode */}
            {assignmentMode === 'manual' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Select Driver</span>
                </div>
                <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an available driver..." />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers.filter(d => d.is_online === true).length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        <Users className="h-4 w-4 mx-auto mb-1 opacity-50" />
                        No drivers currently online
                        <div className="text-xs mt-1">Drivers will appear here automatically when they come online</div>
                      </div>
                    ) : (
                      drivers
                        .filter(d => d.is_online === true)
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
            )}

            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {drivers.filter(d => d.is_online === true).length} drivers available
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={assignmentMode === 'auto' ? handleAutoAssign : handleManualAssign}
              disabled={assigning || (assignmentMode === 'manual' && !selectedDriver)}
            >
              {assigning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4 mr-2" />
                  {assignmentMode === 'auto' ? 'Auto Assign' : 'Assign to Driver'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
