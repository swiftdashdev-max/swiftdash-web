'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { pairDriver } from '@/lib/supabase/edge-functions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
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
  estimated_distance: number;
  estimated_cost: number;
  is_scheduled: boolean;
  scheduled_pickup_time?: string;
  created_at: string;
  driver_id?: string;
}

interface Driver {
  id: string;
  full_name: string;
  phone: string;
  vehicle_type: string;
  status: 'available' | 'busy' | 'offline';
  rating: number;
}

export default function DispatchPage() {
  const router = useRouter();
  const supabase = createClient();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeliveries, setSelectedDeliveries] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignmentMode, setAssignmentMode] = useState<'auto' | 'manual'>('auto');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch deliveries (pending, scheduled, assigned but not active)
      // Backend creates deliveries with status 'pending' by default
      const { data: deliveriesData, error: deliveriesError } = await supabase
        .from('deliveries')
        .select('*')
        .in('status', ['pending', 'scheduled', 'assigned'])
        .order('created_at', { ascending: false });

      if (deliveriesError) {
        console.error('❌ Error fetching deliveries:', deliveriesError);
      } else {
        setDeliveries(deliveriesData || []);
        console.log('📦 Deliveries loaded:', deliveriesData);
      }

      // Fetch available drivers
      const { data: driversData, error: driversError } = await supabase
        .from('drivers')
        .select('*')
        .eq('status', 'available');

      if (driversError) {
        console.error('❌ Error fetching drivers:', driversError);
      } else {
        setDrivers(driversData || []);
        console.log('🚗 Drivers loaded:', driversData);
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
      pending_dispatch: {
        variant: 'secondary',
        label: 'Pending Dispatch',
        icon: AlertCircle,
      },
      scheduled: {
        variant: 'outline',
        label: 'Scheduled',
        icon: Calendar,
      },
      assigned: {
        variant: 'default',
        label: 'Assigned',
        icon: CheckCircle2,
      },
    };

    const config = variants[status] || variants.pending_dispatch;
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
      delivery.tracking_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      delivery.pickup_address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      delivery.dropoff_address.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || delivery.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const pendingCount = deliveries.filter(d => d.status === 'pending_dispatch').length;
  const scheduledCount = deliveries.filter(d => d.status === 'scheduled').length;
  const assignedCount = deliveries.filter(d => d.status === 'assigned').length;

  if (loading) {
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
            <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
            <Calendar className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{scheduledCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Future deliveries</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assigned</CardTitle>
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
                <TabsTrigger value="pending_dispatch">Pending</TabsTrigger>
                <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
                <TabsTrigger value="assigned">Assigned</TabsTrigger>
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
                    <TableCell>{delivery.estimated_distance.toFixed(1)} km</TableCell>
                    <TableCell className="font-semibold">₱{delivery.estimated_cost}</TableCell>
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
                      Choose drivers manually for each delivery (coming soon)
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {drivers.filter(d => d.status === 'available').length} drivers available
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={assignmentMode === 'auto' ? handleAutoAssign : () => {}}
              disabled={assigning || (assignmentMode === 'manual')}
            >
              {assigning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4 mr-2" />
                  {assignmentMode === 'auto' ? 'Auto Assign' : 'Manual Assign'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
