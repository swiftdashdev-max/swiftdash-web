'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Package,
  MapPin,
  Navigation,
  Clock,
  User,
  Phone,
  Loader2,
  Filter,
  RefreshCw,
} from 'lucide-react';

interface ActiveDelivery {
  id: string;
  tracking_number: string;
  status: 
    | 'assigned' 
    | 'picked_up' 
    | 'stop_1_in_transit'
    | 'stop_1_delivered'
    | 'stop_2_in_transit'
    | 'stop_2_delivered'
    | 'stop_3_in_transit'
    | 'stop_3_delivered'
    | 'in_transit' 
    | 'delivered'
    | 'completed';
  delivery_type: 'single' | 'multi';
  pickup_address: string;
  dropoff_address: string;
  dropoff_stops?: any[];
  pickup_lat?: number;
  pickup_lng?: number;
  dropoff_lat?: number;
  dropoff_lng?: number;
  package_description: string;
  driver_name?: string;
  driver_phone?: string;
  driver_location?: { lat: number; lng: number };
  estimated_time: number;
  actual_time?: number;
  created_at: string;
  updated_at: string;
}

export default function TrackingPage() {
  const supabase = createClient();
  const [activeDeliveries, setActiveDeliveries] = useState<ActiveDelivery[]>([]);
  const [selectedDelivery, setSelectedDelivery] = useState<ActiveDelivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch active deliveries
  useEffect(() => {
    fetchDeliveries();
    // Set up polling for real-time updates (every 10 seconds)
    const interval = setInterval(fetchDeliveries, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchDeliveries = async () => {
    try {
      setLoading(true);

      // Fetch deliveries that are in progress (not pending_dispatch or completed)
      const { data: deliveries, error } = await supabase
        .from('deliveries')
        .select('*')
        .in('status', [
          'assigned', 'picked_up', 'in_transit', 
          'stop_1_in_transit', 'stop_1_delivered', 
          'stop_2_in_transit', 'stop_2_delivered', 
          'stop_3_in_transit', 'stop_3_delivered', 
          'delivered'
        ]);

      if (error) {
        console.error('❌ Error fetching deliveries:', error);
      } else {
        setActiveDeliveries(deliveries || []);
        console.log('🚗 Active deliveries:', deliveries);
      }
    } catch (error) {
      console.error('❌ Error fetching deliveries:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'assigned':
        return 'bg-blue-500';
      case 'picked_up':
        return 'bg-yellow-500';
      case 'stop_1_in_transit':
      case 'stop_2_in_transit':
      case 'stop_3_in_transit':
      case 'in_transit':
        return 'bg-green-500';
      case 'stop_1_delivered':
      case 'stop_2_delivered':
      case 'stop_3_delivered':
        return 'bg-purple-500';
      case 'delivered':
      case 'completed':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'assigned':
        return 'Assigned';
      case 'picked_up':
        return 'Picked Up';
      case 'stop_1_in_transit':
        return 'To Stop 1';
      case 'stop_1_delivered':
        return 'Stop 1 Delivered';
      case 'stop_2_in_transit':
        return 'To Stop 2';
      case 'stop_2_delivered':
        return 'Stop 2 Delivered';
      case 'stop_3_in_transit':
        return 'To Stop 3';
      case 'stop_3_delivered':
        return 'Stop 3 Delivered';
      case 'in_transit':
        return 'In Transit';
      case 'delivered':
        return 'Delivered';
      case 'completed':
        return 'Completed';
      default:
        return status;
    }
  };

  const filteredDeliveries = statusFilter === 'all'
    ? activeDeliveries
    : activeDeliveries.filter(d => d.status === statusFilter);

  if (loading && activeDeliveries.length === 0) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading tracking data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Order Tracking</h1>
          <p className="text-muted-foreground mt-2">
            Real-time tracking of active deliveries
          </p>
        </div>
        <Button onClick={fetchDeliveries} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Active</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeDeliveries.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assigned</CardTitle>
            <div className={`h-3 w-3 rounded-full ${getStatusColor('assigned')}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activeDeliveries.filter(d => d.status === 'assigned').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Picked Up</CardTitle>
            <div className={`h-3 w-3 rounded-full ${getStatusColor('picked_up')}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activeDeliveries.filter(d => d.status === 'picked_up').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Transit</CardTitle>
            <div className={`h-3 w-3 rounded-full ${getStatusColor('in_transit')}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activeDeliveries.filter(d => d.status === 'in_transit').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Deliveries List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Active Deliveries</CardTitle>
            <Tabs value={statusFilter} onValueChange={setStatusFilter} className="mt-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="assigned">Assigned</TabsTrigger>
                <TabsTrigger value="picked_up">Picked</TabsTrigger>
                <TabsTrigger value="in_transit">Transit</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {filteredDeliveries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No active deliveries</p>
                </div>
              ) : (
                filteredDeliveries.map((delivery) => (
                  <div
                    key={delivery.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedDelivery?.id === delivery.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:border-primary/50'
                    }`}
                    onClick={() => setSelectedDelivery(delivery)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm font-medium">
                            #{delivery.tracking_number}
                          </span>
                        </div>
                        <Badge
                          className={`${getStatusColor(delivery.status)} text-white border-0`}
                        >
                          {getStatusLabel(delivery.status)}
                        </Badge>
                      </div>
                      <div className={`h-2 w-2 rounded-full ${getStatusColor(delivery.status)} animate-pulse`} />
                    </div>
                    <div className="space-y-1.5 mt-3">
                      <div className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Package className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-1">{delivery.package_description}</span>
                      </div>
                      <div className="flex items-start gap-2 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0 text-green-600" />
                        <span className="line-clamp-1">{delivery.pickup_address}</span>
                      </div>
                      <div className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Navigation className="h-3 w-3 mt-0.5 flex-shrink-0 text-red-600" />
                        <span className="line-clamp-1">{delivery.dropoff_address}</span>
                      </div>
                    </div>
                    {delivery.driver_name && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t text-xs">
                        <User className="h-3 w-3" />
                        <span>{delivery.driver_name}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Delivery Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Delivery Details</CardTitle>
            <CardDescription>
              {selectedDelivery
                ? `Tracking #${selectedDelivery.tracking_number}`
                : 'Select a delivery to view details'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedDelivery ? (
              <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                <div className="text-center">
                  <Package className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>Select a delivery from the list to view details</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Status Timeline */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Status Timeline</h3>
                  <div className="space-y-3">
                    {(() => {
                      // Build status array based on delivery type
                      const baseStatuses = ['assigned', 'picked_up'];
                      const endStatuses = ['delivered', 'completed'];
                      
                      let allStatuses: string[];
                      
                      if (selectedDelivery.delivery_type === 'multi' && selectedDelivery.dropoff_stops) {
                        // Multi-stop delivery
                        const stopCount = selectedDelivery.dropoff_stops.length;
                        const stopStatuses: string[] = [];
                        
                        for (let i = 1; i <= Math.min(stopCount, 3); i++) {
                          stopStatuses.push(`stop_${i}_in_transit`);
                          stopStatuses.push(`stop_${i}_delivered`);
                        }
                        
                        allStatuses = [...baseStatuses, ...stopStatuses, ...endStatuses];
                      } else {
                        // Single stop delivery
                        allStatuses = [...baseStatuses, 'in_transit', ...endStatuses];
                      }
                      
                      const currentIndex = allStatuses.indexOf(selectedDelivery.status);
                      
                      return allStatuses.map((status, index) => {
                        const isActive = selectedDelivery.status === status;
                        const isPast = currentIndex > index;
                        const isCurrent = isActive;

                        return (
                          <div key={status} className="flex items-center gap-3">
                            <div className={`flex items-center justify-center h-8 w-8 rounded-full ${
                              isCurrent ? getStatusColor(status) : isPast ? 'bg-green-500' : 'bg-gray-300'
                            } text-white text-sm font-medium`}>
                              {isPast ? '✓' : index + 1}
                            </div>
                            <div className="flex-1">
                              <p className={`text-sm font-medium ${isCurrent ? 'text-primary' : ''}`}>
                                {getStatusLabel(status)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {isCurrent ? 'In progress' : isPast ? 'Completed' : 'Pending'}
                              </p>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Package Information */}
                <div className="space-y-3">
                  <h3 className="font-semibold">Package Information</h3>
                  <div className="grid gap-3">
                    <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                      <Package className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Description</p>
                        <p className="text-sm text-muted-foreground">{selectedDelivery.package_description}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Locations */}
                <div className="space-y-3">
                  <h3 className="font-semibold">Locations</h3>
                  <div className="space-y-2">
                    <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                      <MapPin className="h-5 w-5 text-green-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-green-900 dark:text-green-300">Pickup Location</p>
                        <p className="text-sm text-green-700 dark:text-green-400">{selectedDelivery.pickup_address}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                      <Navigation className="h-5 w-5 text-red-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-900 dark:text-red-300">Dropoff Location</p>
                        <p className="text-sm text-red-700 dark:text-red-400">{selectedDelivery.dropoff_address}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Driver Information */}
                {selectedDelivery.driver_name && (
                  <div className="space-y-3">
                    <h3 className="font-semibold">Driver Information</h3>
                    <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 text-primary font-semibold">
                        {selectedDelivery.driver_name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{selectedDelivery.driver_name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">{selectedDelivery.driver_phone}</p>
                        </div>
                      </div>
                      <Button size="sm" variant="outline">
                        <Phone className="h-4 w-4 mr-2" />
                        Call
                      </Button>
                    </div>
                  </div>
                )}

                {/* ETA */}
                <div className="space-y-3">
                  <h3 className="font-semibold">Estimated Time</h3>
                  <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                    <Clock className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-300">
                        ETA: {selectedDelivery.estimated_time} minutes
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-400">
                        Last updated: {new Date(selectedDelivery.updated_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
