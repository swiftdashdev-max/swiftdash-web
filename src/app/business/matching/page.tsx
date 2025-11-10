'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users,
  MapPin,
  Package,
  Clock,
  Truck,
  Search,
  Filter,
  UserCheck,
  Navigation,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PendingDelivery {
  id: string;
  pickup_address: string;
  dropoff_address: string;
  package_description: string;
  package_weight_kg: number;
  vehicle_type: string;
  estimated_distance: number;
  estimated_cost: number;
  created_at: string;
  priority: 'high' | 'normal' | 'low';
}

interface AvailableDriver {
  id: string;
  full_name: string;
  phone: string;
  vehicle_type: string;
  current_location?: { lat: number; lng: number };
  rating: number;
  total_deliveries: number;
  status: 'available' | 'busy' | 'offline';
  distance_from_pickup?: number;
}

export default function MatchingPage() {
  const [pendingDeliveries, setPendingDeliveries] = useState<PendingDelivery[]>([]);
  const [availableDrivers, setAvailableDrivers] = useState<AvailableDriver[]>([]);
  const [selectedDelivery, setSelectedDelivery] = useState<string | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const { toast } = useToast();
  const supabase = createClient();

  // Fetch pending deliveries and available drivers
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Get current user and their business_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No authenticated user');
        return;
      }

      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('business_id')
        .eq('id', user.id)
        .single();

      if (!userProfile?.business_id) {
        console.error('No business_id found');
        return;
      }

      // Fetch pending deliveries (status = 'pending', belonging to this business)
      const { data: deliveries, error: deliveriesError } = await supabase
        .from('deliveries')
        .select('*')
        .eq('business_id', userProfile.business_id)
        .eq('status', 'pending')
        .is('driver_id', null)
        .order('created_at', { ascending: false });

      if (deliveriesError) {
        console.error('Error fetching deliveries:', deliveriesError);
      } else {
        setPendingDeliveries(deliveries || []);
        console.log('📦 Pending deliveries:', deliveries);
      }

      // Fetch available drivers (current_status = 'online')
      const { data: driverProfiles, error: driversError } = await supabase
        .from('driver_profiles')
        .select(`
          id,
          current_status,
          rating,
          total_deliveries,
          vehicle_type_id,
          current_latitude,
          current_longitude
        `)
        .eq('current_status', 'online');

      if (driversError) {
        console.error('Error fetching driver profiles:', driversError);
      } else {
        // Get user profiles for drivers (names, phone)
        const driverIds = (driverProfiles || []).map(d => d.id);
        
        if (driverIds.length > 0) {
          const { data: userProfiles } = await supabase
            .from('user_profiles')
            .select('id, first_name, last_name, phone_number')
            .in('id', driverIds);

          // Get vehicle types
          const vehicleTypeIds = [...new Set((driverProfiles || [])
            .map(d => d.vehicle_type_id)
            .filter(Boolean))];

          const { data: vehicleTypes } = await supabase
            .from('vehicle_types')
            .select('id, name')
            .in('id', vehicleTypeIds);

          const vehicleTypeMap = (vehicleTypes || []).reduce((acc, vt) => {
            acc[vt.id] = vt.name;
            return acc;
          }, {} as Record<string, string>);

          // Combine data
          const drivers: AvailableDriver[] = (driverProfiles || []).map(driver => {
            const userProfile = (userProfiles || []).find(up => up.id === driver.id);
            return {
              id: driver.id,
              full_name: userProfile 
                ? `${userProfile.first_name} ${userProfile.last_name}` 
                : 'Unknown Driver',
              phone: userProfile?.phone_number || 'N/A',
              vehicle_type: vehicleTypeMap[driver.vehicle_type_id] || 'Unknown',
              current_location: driver.current_latitude && driver.current_longitude
                ? { lat: Number(driver.current_latitude), lng: Number(driver.current_longitude) }
                : undefined,
              rating: Number(driver.rating) || 0,
              total_deliveries: driver.total_deliveries || 0,
              status: driver.current_status as 'available' | 'busy' | 'offline',
            };
          });

          setAvailableDrivers(drivers);
          console.log('🚗 Available drivers:', drivers);
        } else {
          setAvailableDrivers([]);
        }
      }
    } catch (error) {
      console.error('❌ Error fetching data:', error);
      toast({
        title: "Error Loading Data",
        description: "Failed to load deliveries and drivers.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAssignDriver = async () => {
    if (!selectedDelivery || !selectedDriver) return;

    try {
      setAssigning(true);

      // Get current user for assigned_by field
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        toast({
          title: "Authentication Error",
          description: "Please log in to assign drivers.",
          variant: "destructive",
        });
        return;
      }

      // Call edge function to assign driver
      const { data, error } = await supabase.functions.invoke('assign-business-driver', {
        body: {
          delivery_id: selectedDelivery,
          driver_id: selectedDriver,
          assigned_by: user.id,
          assignment_type: 'manual'
        }
      });

      if (error) {
        console.error('❌ Error assigning driver:', error);
        toast({
          title: "Assignment Failed",
          description: error.message || "Failed to assign driver. Please try again.",
          variant: "destructive",
        });
        return;
      }

      // Check response from edge function
      if (!data.success) {
        toast({
          title: "Assignment Failed",
          description: data.error || "Driver assignment failed.",
          variant: "destructive",
        });
        return;
      }

      // Success!
      console.log('✅ Driver assigned successfully:', data);
      toast({
        title: "Driver Assigned",
        description: "The driver has been notified and will start the delivery.",
      });

      // Refresh data and clear selections
      await fetchData();
      setSelectedDelivery(null);
      setSelectedDriver(null);

    } catch (error) {
      console.error('❌ Unexpected error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setAssigning(false);
    }
  };

  const autoMatchDriver = (delivery: PendingDelivery) => {
    // Simple auto-matching algorithm based on vehicle type and availability
    const compatibleDrivers = availableDrivers.filter(
      driver => driver.vehicle_type === delivery.vehicle_type && driver.status === 'available'
    );

    if (compatibleDrivers.length > 0) {
      // Sort by rating and select the best one
      const bestDriver = compatibleDrivers.sort((a, b) => b.rating - a.rating)[0];
      setSelectedDriver(bestDriver.id);
      setSelectedDelivery(delivery.id);
    }
  };

  const filteredDrivers = availableDrivers.filter(driver => {
    const matchesSearch = driver.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.phone.includes(searchQuery);
    const matchesFilter = filterStatus === 'all' || driver.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading matching data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Driver Matching</h1>
        <p className="text-muted-foreground mt-2">
          Assign available drivers to pending deliveries
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Deliveries</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingDeliveries.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Awaiting driver assignment
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Drivers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {availableDrivers.filter(d => d.status === 'available').length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Ready for assignment
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Match Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pendingDeliveries.length > 0
                ? Math.round((availableDrivers.filter(d => d.status === 'available').length / pendingDeliveries.length) * 100)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Drivers per delivery
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pending Deliveries */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Deliveries</CardTitle>
            <CardDescription>
              Select a delivery to assign a driver
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingDeliveries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No pending deliveries</p>
                </div>
              ) : (
                pendingDeliveries.map((delivery) => (
                  <div
                    key={delivery.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedDelivery === delivery.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:border-primary/50'
                    }`}
                    onClick={() => setSelectedDelivery(delivery.id)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm">
                            {delivery.package_description}
                          </span>
                        </div>
                        <div className="flex items-start gap-2 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-1">{delivery.pickup_address}</span>
                        </div>
                        <div className="flex items-start gap-2 text-xs text-muted-foreground mt-1">
                          <Navigation className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-1">{delivery.dropoff_address}</span>
                        </div>
                      </div>
                      <Badge variant={delivery.priority === 'high' ? 'destructive' : 'secondary'}>
                        {delivery.priority}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t">
                      <div className="flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1">
                          <Truck className="h-3 w-3" />
                          {delivery.vehicle_type}
                        </span>
                        <span className="flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          {delivery.package_weight_kg}kg
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {delivery.estimated_distance}km
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          autoMatchDriver(delivery);
                        }}
                      >
                        Auto Match
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Available Drivers */}
        <Card>
          <CardHeader>
            <CardTitle>Available Drivers</CardTitle>
            <CardDescription>
              Select a driver to assign to the delivery
            </CardDescription>
            <div className="flex gap-2 mt-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search drivers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="busy">Busy</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredDrivers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No drivers found</p>
                </div>
              ) : (
                filteredDrivers.map((driver) => (
                  <div
                    key={driver.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedDriver === driver.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:border-primary/50'
                    } ${driver.status !== 'available' ? 'opacity-50' : ''}`}
                    onClick={() => driver.status === 'available' && setSelectedDriver(driver.id)}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar>
                        <AvatarImage src={`/avatars/${driver.id}.png`} />
                        <AvatarFallback>{driver.full_name.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-medium text-sm">{driver.full_name}</h4>
                          <Badge
                            variant={
                              driver.status === 'available'
                                ? 'default'
                                : driver.status === 'busy'
                                ? 'secondary'
                                : 'outline'
                            }
                            className="ml-2"
                          >
                            {driver.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{driver.phone}</p>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="flex items-center gap-1">
                            <Truck className="h-3 w-3" />
                            {driver.vehicle_type}
                          </span>
                          <span className="flex items-center gap-1">
                            ⭐ {driver.rating.toFixed(1)}
                          </span>
                          <span className="text-muted-foreground">
                            {driver.total_deliveries} deliveries
                          </span>
                        </div>
                        {driver.distance_from_pickup && (
                          <p className="text-xs text-muted-foreground mt-2">
                            <MapPin className="h-3 w-3 inline mr-1" />
                            {driver.distance_from_pickup.toFixed(1)}km from pickup
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Assignment Action */}
      {selectedDelivery && selectedDriver && (
        <Card className="border-primary">
          <CardContent className="flex items-center justify-between p-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">Ready to Assign</h3>
                <p className="text-sm text-muted-foreground">
                  Assign the selected driver to the selected delivery
                </p>
              </div>
            </div>
            <Button
              size="lg"
              onClick={handleAssignDriver}
              disabled={assigning}
              className="min-w-[120px]"
            >
              {assigning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  Assign Driver
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
