'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Package, Calendar, DollarSign, Truck, Plus, Map, Download, TrendingUp, Clock, CheckCircle, AlertCircle,
  MapPin, Users, Activity, BarChart3, PieChart, RefreshCw, Navigation, Zap
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

// Dynamically import map to avoid SSR issues
const DynamicMap = dynamic(() => import('@/components/dashboard/FleetMap'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[400px] bg-gray-50 rounded-lg">
      <div className="text-center">
        <Map className="h-8 w-8 animate-pulse mx-auto mb-2 text-gray-400" />
        <p className="text-sm text-gray-500">Loading map...</p>
      </div>
    </div>
  )
});

// Dynamically import charts to avoid SSR issues
const DynamicCharts = dynamic(() => import('@/components/dashboard/DashboardCharts'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[300px] bg-gray-50 rounded-lg">
      <div className="text-center">
        <BarChart3 className="h-8 w-8 animate-pulse mx-auto mb-2 text-gray-400" />
        <p className="text-sm text-gray-500">Loading charts...</p>
      </div>
    </div>
  )
});

interface DeliveryStats {
  deliveriesToday: number;
  deliveriesThisWeek: number;
  monthlySpend: number;
  activeDrivers: number;
  scheduledDeliveries: number;
  activeDeliveries: number;
  completionRate: number;
  avgDeliveryTime: number;
}

interface OnlineDriver {
  id: string;
  full_name: string;
  phone: string;
  current_latitude: number;
  current_longitude: number;
  vehicle_model?: string;
  plate_number?: string;
  rating: number;
  total_deliveries: number;
  location_updated_at: string;
  employment_type: string;
}

interface Delivery {
  id: string;
  status: string;
  pickup_address: string;
  delivery_address: string;
  price?: number;
  total_price?: number;
  total_amount?: number;
  created_at: string;
  driver?: {
    user_profile: {
      first_name: string;
      last_name: string;
    };
  };
}

export default function BusinessDashboard() {
  const [stats, setStats] = useState<DeliveryStats>({
    deliveriesToday: 0,
    deliveriesThisWeek: 0,
    monthlySpend: 0,
    activeDrivers: 0,
    scheduledDeliveries: 0,
    activeDeliveries: 0,
    completionRate: 0,
    avgDeliveryTime: 0,
  });
  const [onlineDrivers, setOnlineDrivers] = useState<OnlineDriver[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [activeDeliveries, setActiveDeliveries] = useState<Delivery[]>([]);
  const [recentDeliveries, setRecentDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [chartData, setChartData] = useState<any>(null);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (businessId) {
      fetchDashboardData();
      setupRealTimeSubscriptions();
    }
  }, [businessId]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/business/signup');
      return;
    }
    setUser(user);

    // Get user's business_id from user_profiles
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('business_id')
      .eq('id', user.id)
      .single();

    if (userProfile?.business_id) {
      setBusinessId(userProfile.business_id);
    }
  };

  const fetchOnlineDrivers = useCallback(async () => {
    if (!businessId) return;

    try {
      const { data: driversData, error } = await supabase
        .from('driver_profiles')
        .select(`
          id,
          current_latitude,
          current_longitude,
          vehicle_model,
          plate_number,
          rating,
          total_deliveries,
          location_updated_at,
          employment_type,
          managed_by_business_id
        `)
        .eq('is_online', true)
        .not('current_latitude', 'is', null)
        .not('current_longitude', 'is', null);

      if (error) throw error;

      // Fetch user profiles for each driver
      const driversWithProfiles: OnlineDriver[] = [];
      for (const driver of driversData || []) {
        try {
          const { data: userProfile } = await supabase
            .from('user_profiles')
            .select('first_name, last_name, phone_number')
            .eq('id', driver.id)
            .single();

          // Only include fleet drivers from this business and independent drivers
          const shouldInclude = 
            driver.employment_type === 'independent' ||
            (driver.employment_type === 'fleet_driver' && driver.managed_by_business_id === businessId);

          if (shouldInclude) {
            driversWithProfiles.push({
              ...driver,
              full_name: userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : `Driver ${driver.id.substring(0, 8)}`,
              phone: userProfile?.phone_number || 'N/A'
            });
          }
        } catch (profileError) {
          console.warn(`Could not fetch profile for driver ${driver.id}`);
        }
      }

      setOnlineDrivers(driversWithProfiles);
    } catch (error) {
      console.error('Error fetching online drivers:', error);
    }
  }, [businessId, supabase]);

  const fetchDashboardData = async () => {
    if (!businessId) return;

    try {
      setLoading(true);

      // Get today's date range
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString();

      // Get week start
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const weekStartStr = weekStart.toISOString();

      // Get month start
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthStartStr = monthStart.toISOString();

      // Fetch all deliveries for this business
      const { data: allDeliveries, error: deliveriesError } = await supabase
        .from('deliveries')
        .select(`
          *,
          driver:driver_id (id)
        `)
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });

      if (deliveriesError) throw deliveriesError;

      // Fetch user profiles for drivers separately
      const deliveriesWithDrivers = await Promise.all((allDeliveries || []).map(async (delivery) => {
        if (delivery.driver?.id) {
          const { data: userProfile } = await supabase
            .from('user_profiles')
            .select('first_name, last_name')
            .eq('id', delivery.driver.id)
            .single();
          
          return {
            ...delivery,
            driver: {
              ...delivery.driver,
              user_profile: userProfile
            }
          };
        }
        return delivery;
      }));

      // Set all deliveries for charts
      setDeliveries(deliveriesWithDrivers || []);

      // Calculate stats
      const todayDeliveries = deliveriesWithDrivers?.filter(d => 
        new Date(d.created_at) >= today
      ) || [];

      const weekDeliveries = deliveriesWithDrivers?.filter(d => 
        new Date(d.created_at) >= weekStart
      ) || [];

      const monthDeliveries = deliveriesWithDrivers?.filter(d => 
        new Date(d.created_at) >= monthStart
      ) || [];

      const activeDelivs = deliveriesWithDrivers?.filter(d => 
        ['pending', 'driver_offered', 'driver_assigned', 'picking_up', 'in_transit'].includes(d.status)
      ) || [];

      const scheduledDelivs = deliveriesWithDrivers?.filter(d => 
        d.status === 'scheduled'
      ) || [];

      const completedDelivs = deliveriesWithDrivers?.filter(d => 
        d.status === 'delivered'
      ) || [];

      const monthlyTotal = monthDeliveries.reduce((sum, d) => sum + (d.price || d.total_price || d.total_amount || 0), 0);
      const completionRate = deliveriesWithDrivers.length > 0 ? (completedDelivs.length / deliveriesWithDrivers.length) * 100 : 0;
      
      // Calculate average delivery time (mock for now)
      const avgDeliveryTime = 45; // minutes

      // Get unique active drivers
      const activeDriverIds = new Set(
        activeDelivs.filter(d => d.driver_id).map(d => d.driver_id)
      );

      setStats({
        deliveriesToday: todayDeliveries.length,
        deliveriesThisWeek: weekDeliveries.length,
        monthlySpend: monthlyTotal,
        activeDrivers: activeDriverIds.size,
        scheduledDeliveries: scheduledDelivs.length,
        activeDeliveries: activeDelivs.length,
        completionRate,
        avgDeliveryTime,
      });

      // Set active deliveries
      setActiveDeliveries(activeDelivs.slice(0, 5));

      // Set recent completed deliveries
      const recentCompleted = deliveriesWithDrivers?.filter(d => 
        d.status === 'delivered'
      ).slice(0, 5) || [];
      setRecentDeliveries(recentCompleted);

      // Prepare chart data
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        return {
          date: date.toISOString().split('T')[0],
          day: date.toLocaleDateString('en-US', { weekday: 'short' }),
          deliveries: deliveriesWithDrivers?.filter(d => 
            d.created_at.split('T')[0] === date.toISOString().split('T')[0]
          ).length || 0
        };
      }).reverse();

      setChartData({
        weeklyDeliveries: last7Days,
        statusBreakdown: [
          { name: 'Completed', value: completedDelivs.length, color: '#22c55e' },
          { name: 'In Progress', value: activeDelivs.length, color: '#3b82f6' },
          { name: 'Scheduled', value: scheduledDelivs.length, color: '#f59e0b' },
        ]
      });

      // Fetch online drivers
      await fetchOnlineDrivers();

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealTimeSubscriptions = () => {
    if (!businessId) return;

    // Subscribe to deliveries changes
    const deliveriesChannel = supabase
      .channel('dashboard-deliveries')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deliveries',
          filter: `business_id=eq.${businessId}`,
        },
        () => {
          fetchDashboardData();
        }
      )
      .subscribe();

    // Subscribe to driver location updates
    const driversChannel = supabase
      .channel('dashboard-drivers')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'driver_profiles',
        },
        (payload) => {
          if (payload.new.current_latitude && payload.new.current_longitude) {
            fetchOnlineDrivers();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(deliveriesChannel);
      supabase.removeChannel(driversChannel);
    };
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDriverName = (delivery: Delivery) => {
    if (!delivery.driver?.user_profile) return 'Unassigned';
    const { first_name, last_name } = delivery.driver.user_profile;
    return `${first_name} ${last_name}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'text-green-600 bg-green-50';
      case 'in_transit': return 'text-blue-600 bg-blue-50';
      case 'picking_up': return 'text-yellow-600 bg-yellow-50';
      case 'driver_offered': return 'text-orange-600 bg-orange-50';
      case 'driver_assigned': return 'text-purple-600 bg-purple-50';
      case 'cancelled': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered': return <CheckCircle className="h-4 w-4" />;
      case 'in_transit': return <Truck className="h-4 w-4" />;
      case 'picking_up': return <Clock className="h-4 w-4" />;
      case 'driver_offered': return <Navigation className="h-4 w-4" />;
      case 'driver_assigned': return <Users className="h-4 w-4" />;
      case 'cancelled': return <AlertCircle className="h-4 w-4" />;
      default: return <Package className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here's what's happening with your business.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-green-50 text-sm">
            <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
            Live Updates
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      >
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deliveries Today</CardTitle>
            <Package className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.deliveriesToday}</div>
            <p className="text-xs text-muted-foreground">
              {stats.deliveriesThisWeek} this week
            </p>
          </CardContent>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-blue-400"></div>
        </Card>

        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Fleet</CardTitle>
            <MapPin className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{onlineDrivers.length}</div>
            <p className="text-xs text-muted-foreground">
              Online drivers
            </p>
          </CardContent>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-green-600 to-green-400"></div>
        </Card>

        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Avg delivery time: {stats.avgDeliveryTime}m
            </p>
          </CardContent>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-purple-600 to-purple-400"></div>
        </Card>

        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₱{stats.monthlySpend.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="inline h-3 w-3 mr-1" />
              +12% from last month
            </p>
          </CardContent>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-orange-600 to-orange-400"></div>
        </Card>
      </motion.div>

      {/* Main Content */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Fleet Map */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="md:col-span-2"
        >
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-green-600" />
                    Live Fleet Tracking
                  </CardTitle>
                  <CardDescription>
                    {onlineDrivers.length} drivers online • Real-time locations
                  </CardDescription>
                </div>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <div className="h-2 w-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                  Live
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <DynamicMap drivers={onlineDrivers} />
            </CardContent>
          </Card>
        </motion.div>

        {/* Online Drivers List */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Online Drivers
              </CardTitle>
              <CardDescription>
                Currently available fleet
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {onlineDrivers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">No drivers online</p>
                    <p className="text-xs text-gray-400 mt-1">Drivers will appear here when they go online</p>
                  </div>
                ) : (
                  onlineDrivers.slice(0, 6).map((driver) => (
                    <div key={driver.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                            {driver.full_name.charAt(0)}
                          </div>
                          <div className="absolute -top-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                            <div className="h-2 w-2 bg-white rounded-full"></div>
                          </div>
                        </div>
                        <div>
                          <div className="font-medium text-sm">{driver.full_name}</div>
                          <div className="text-xs text-gray-500">
                            {driver.employment_type === 'fleet_driver' ? (
                              <Badge variant="outline" className="text-xs py-0 px-1">Fleet</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs py-0 px-1">Independent</Badge>
                            )}
                            {driver.vehicle_model && (
                              <span className="ml-2">{driver.vehicle_model}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Activity className="h-3 w-3" />
                          {driver.rating?.toFixed(1) || 'N/A'}
                        </div>
                        <div className="text-xs text-gray-400">
                          {driver.total_deliveries || 0} trips
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {onlineDrivers.length > 6 && (
                <Button variant="outline" className="w-full mt-4" asChild>
                  <Link href="/business/fleet">View All Drivers</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Charts and Analytics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-purple-600" />
              Analytics Overview
            </CardTitle>
            <CardDescription>
              Performance insights and trends
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chartData && <DynamicCharts deliveries={deliveries} drivers={onlineDrivers} isLoading={loading} />}
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and shortcuts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Button
                variant="outline"
                className="h-auto py-4 flex-col gap-2 hover:bg-blue-50 hover:border-blue-200 transition-colors"
                asChild
              >
                <Link href="/business/orders">
                  <Package className="h-6 w-6 text-blue-600" />
                  <span className="text-sm font-medium">New Delivery</span>
                </Link>
              </Button>
              <Button 
                variant="outline" 
                className="h-auto py-4 flex-col gap-2 hover:bg-green-50 hover:border-green-200 transition-colors"
                asChild
              >
                <Link href="/business/dispatch">
                  <Zap className="h-6 w-6 text-green-600" />
                  <span className="text-sm font-medium">Dispatch</span>
                </Link>
              </Button>
              <Button 
                variant="outline" 
                className="h-auto py-4 flex-col gap-2 hover:bg-purple-50 hover:border-purple-200 transition-colors"
                asChild
              >
                <Link href="/business/tracking">
                  <Map className="h-6 w-6 text-purple-600" />
                  <span className="text-sm font-medium">Live Tracking</span>
                </Link>
              </Button>
              <Button 
                variant="outline" 
                className="h-auto py-4 flex-col gap-2 hover:bg-orange-50 hover:border-orange-200 transition-colors"
                asChild
              >
                <Link href="/business/reports">
                  <Download className="h-6 w-6 text-orange-600" />
                  <span className="text-sm font-medium">Reports</span>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Active & Recent Deliveries */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <Tabs defaultValue="active" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="active" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Active ({activeDeliveries.length})
            </TabsTrigger>
            <TabsTrigger value="recent" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Recent ({recentDeliveries.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="active" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Active Deliveries</CardTitle>
                    <CardDescription>Track your ongoing deliveries</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/business/tracking">
                      <Map className="mr-2 h-4 w-4" />
                      View All
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {activeDeliveries.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p>No active deliveries</p>
                      <Button variant="link" asChild className="mt-2">
                        <Link href="/business/orders">Create your first delivery</Link>
                      </Button>
                    </div>
                  ) : (
                    activeDeliveries.map((delivery) => (
                      <div
                        key={delivery.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-lg ${getStatusColor(delivery.status)}`}>
                            {getStatusIcon(delivery.status)}
                          </div>
                          <div>
                            <div className="font-medium">{delivery.id.slice(0, 8).toUpperCase()}</div>
                            <div className="text-sm text-gray-600">
                              {delivery.pickup_address} → {delivery.delivery_address}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              Driver: {getDriverName(delivery)} • {formatDate(delivery.created_at)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">₱{(delivery.price || delivery.total_price || delivery.total_amount || 0).toFixed(2)}</div>
                          <Badge variant="outline" className={`mt-1 ${getStatusColor(delivery.status)}`}>
                            {delivery.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="recent" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Deliveries</CardTitle>
                <CardDescription>Your delivery history</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentDeliveries.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <CheckCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p>No completed deliveries yet</p>
                    </div>
                  ) : (
                    recentDeliveries.map((delivery) => (
                      <div 
                        key={delivery.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-lg ${getStatusColor(delivery.status)}`}>
                            {getStatusIcon(delivery.status)}
                          </div>
                          <div>
                            <div className="font-medium">{delivery.id.slice(0, 8).toUpperCase()}</div>
                            <div className="text-sm text-gray-600">
                              {delivery.pickup_address} → {delivery.delivery_address}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {formatDate(delivery.created_at)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">₱{(delivery.price || delivery.total_price || delivery.total_amount || 0).toFixed(2)}</div>
                          <Badge className="mt-1 bg-green-100 text-green-800 hover:bg-green-100">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Delivered
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-4 text-center">
                  <Button variant="outline" asChild>
                    <Link href="/business/tracking">View All Deliveries</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
