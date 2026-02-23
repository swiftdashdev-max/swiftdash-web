'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Package, DollarSign, Truck, Map, Download, TrendingUp, TrendingDown, Clock, CheckCircle, AlertCircle,
  Users, Activity, BarChart3, RefreshCw, Navigation, Zap
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';



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
  lastMonthSpend: number;
  activeDeliveries: number;
  completionRate: number;
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
    lastMonthSpend: 0,
    activeDeliveries: 0,
    completionRate: 0,
  });

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [activeDeliveries, setActiveDeliveries] = useState<Delivery[]>([]);
  const [recentDeliveries, setRecentDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
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

      // Get month start & last month range for real growth calc
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthStartStr = monthStart.toISOString();
      const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59);

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

      // Last month revenue for real growth
      const lastMonthDeliveries = deliveriesWithDrivers?.filter(d => {
        const created = new Date(d.created_at);
        return created >= lastMonthStart && created <= lastMonthEnd;
      }) || [];
      const lastMonthTotal = lastMonthDeliveries.reduce((sum, d) => sum + (d.price || d.total_price || d.total_amount || 0), 0);

      setStats({
        deliveriesToday: todayDeliveries.length,
        deliveriesThisWeek: weekDeliveries.length,
        monthlySpend: monthlyTotal,
        lastMonthSpend: lastMonthTotal,
        activeDeliveries: activeDelivs.length,
        completionRate,
      });

      // Set active deliveries
      setActiveDeliveries(activeDelivs.slice(0, 5));

      // Set recent completed deliveries
      const recentCompleted = deliveriesWithDrivers?.filter(d => 
        d.status === 'delivered'
      ).slice(0, 5) || [];
      setRecentDeliveries(recentCompleted);


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

    return () => {
      supabase.removeChannel(deliveriesChannel);
    };
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
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

  // Compute real month-over-month growth
  const monthGrowth = stats.lastMonthSpend > 0
    ? ((stats.monthlySpend - stats.lastMonthSpend) / stats.lastMonthSpend) * 100
    : stats.monthlySpend > 0 ? 100 : 0;

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Your delivery performance at a glance.
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
            <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
            Live
          </div>
        </div>
      </div>

      {/* Key Metrics – single row of 4 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="grid gap-4 grid-cols-2 lg:grid-cols-4"
      >
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today</CardTitle>
            <Package className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.deliveriesToday}</div>
            <p className="text-xs text-muted-foreground">
              {stats.deliveriesThisWeek} this week
            </p>
          </CardContent>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-blue-400" />
        </Card>

        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Activity className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeDeliveries}</div>
            <p className="text-xs text-muted-foreground">
              In progress right now
            </p>
          </CardContent>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-green-600 to-green-400" />
        </Card>

        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₱{stats.monthlySpend.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground flex items-center">
              {monthGrowth >= 0 ? (
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
              )}
              <span className={monthGrowth >= 0 ? 'text-green-600' : 'text-red-600'}>
                {monthGrowth >= 0 ? '+' : ''}{monthGrowth.toFixed(1)}%
              </span>
              <span className="ml-1">vs last month</span>
            </p>
          </CardContent>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-orange-600 to-orange-400" />
        </Card>

        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              All-time success rate
            </p>
          </CardContent>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-purple-600 to-purple-400" />
        </Card>
      </motion.div>

      {/* Charts – rendered directly, no wrapper card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <DynamicCharts deliveries={deliveries} drivers={[]} isLoading={loading} />
      </motion.div>

      {/* Quick Actions + Active Deliveries – side by side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="h-auto py-3 flex-col gap-1.5 hover:bg-blue-50 hover:border-blue-200 transition-colors"
                  asChild
                >
                  <Link href="/business/orders">
                    <Package className="h-5 w-5 text-blue-600" />
                    <span className="text-xs font-medium">New Delivery</span>
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto py-3 flex-col gap-1.5 hover:bg-green-50 hover:border-green-200 transition-colors"
                  asChild
                >
                  <Link href="/business/dispatch">
                    <Zap className="h-5 w-5 text-green-600" />
                    <span className="text-xs font-medium">Dispatch</span>
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto py-3 flex-col gap-1.5 hover:bg-purple-50 hover:border-purple-200 transition-colors"
                  asChild
                >
                  <Link href="/business/tracking">
                    <Map className="h-5 w-5 text-purple-600" />
                    <span className="text-xs font-medium">Live Tracking</span>
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto py-3 flex-col gap-1.5 hover:bg-orange-50 hover:border-orange-200 transition-colors"
                  asChild
                >
                  <Link href="/business/reports">
                    <Download className="h-5 w-5 text-orange-600" />
                    <span className="text-xs font-medium">Reports</span>
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Active Deliveries */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="lg:col-span-2"
        >
          <Card className="h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="h-4 w-4 text-blue-600" />
                    Active Deliveries
                  </CardTitle>
                  <CardDescription>In-progress deliveries</CardDescription>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/business/dispatch">
                    View All
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {activeDeliveries.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">No active deliveries</p>
                    <Button variant="link" size="sm" asChild className="mt-1">
                      <Link href="/business/orders">Create one →</Link>
                    </Button>
                  </div>
                ) : (
                  activeDeliveries.map((delivery) => (
                    <div
                      key={delivery.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-1.5 rounded-md ${getStatusColor(delivery.status)}`}>
                          {getStatusIcon(delivery.status)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium">{delivery.id.slice(0, 8).toUpperCase()}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[300px]">
                            {delivery.pickup_address} → {delivery.delivery_address}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <div className="text-sm font-semibold">₱{(delivery.price || delivery.total_price || delivery.total_amount || 0).toFixed(0)}</div>
                        <Badge variant="outline" className={`text-xs ${getStatusColor(delivery.status)}`}>
                          {delivery.status.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
