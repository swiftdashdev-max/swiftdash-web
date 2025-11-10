'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Package, 
  Clock, 
  Users,
  BarChart3,
  PieChart,
  Calendar
} from 'lucide-react';
import { motion } from 'framer-motion';

interface DeliveryData {
  id: string;
  status: string;
  created_at: string;
  price?: number;
  total_price?: number;
  total_amount?: number;
  driver_id?: string;
  customer_id?: string;
  pickup_address?: string;
  delivery_address?: string;
}

interface DriverData {
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

interface DashboardChartsProps {
  deliveries: DeliveryData[];
  drivers: DriverData[];
  isLoading?: boolean;
}

export default function DashboardCharts({ deliveries = [], drivers = [], isLoading }: DashboardChartsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-16" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Ensure we have arrays to work with
  const safeDeliveries = Array.isArray(deliveries) ? deliveries : [];
  const safeDrivers = Array.isArray(drivers) ? drivers : [];

  // Calculate analytics data
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const todayDeliveries = safeDeliveries.filter(d => 
    new Date(d.created_at).toDateString() === today.toDateString()
  );
  
  const yesterdayDeliveries = safeDeliveries.filter(d => 
    new Date(d.created_at).toDateString() === yesterday.toDateString()
  );

  const thisWeekDeliveries = safeDeliveries.filter(d => 
    new Date(d.created_at) >= lastWeek
  );

  const thisMonthDeliveries = safeDeliveries.filter(d => 
    new Date(d.created_at) >= thisMonth
  );

  const completedDeliveries = safeDeliveries.filter(d => d.status === 'delivered');
  const activeDeliveries = safeDeliveries.filter(d => 
    !['delivered', 'cancelled', 'failed'].includes(d.status)
  );

  const totalRevenue = safeDeliveries.reduce((sum, d) => 
    sum + (d.price || d.total_price || d.total_amount || 0), 0
  );

  const todayRevenue = todayDeliveries.reduce((sum, d) => 
    sum + (d.price || d.total_price || d.total_amount || 0), 0
  );

  const yesterdayRevenue = yesterdayDeliveries.reduce((sum, d) => 
    sum + (d.price || d.total_price || d.total_amount || 0), 0
  );

  const revenueGrowth = yesterdayRevenue > 0 
    ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 
    : todayRevenue > 0 ? 100 : 0;

  const deliveryGrowth = yesterdayDeliveries.length > 0 
    ? ((todayDeliveries.length - yesterdayDeliveries.length) / yesterdayDeliveries.length) * 100 
    : todayDeliveries.length > 0 ? 100 : 0;

  const onlineDrivers = safeDrivers; // All drivers passed are already online
  const completionRate = safeDeliveries.length > 0 
    ? (completedDeliveries.length / safeDeliveries.length) * 100 
    : 0;

  // Status distribution
  const statusCounts = safeDeliveries.reduce((acc, d) => {
    acc[d.status] = (acc[d.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Weekly delivery trend (last 7 days)
  const weeklyTrend = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dayDeliveries = safeDeliveries.filter(d => 
      new Date(d.created_at).toDateString() === date.toDateString()
    );
    return {
      day: date.toLocaleDateString('en-US', { weekday: 'short' }),
      count: dayDeliveries.length,
      revenue: dayDeliveries.reduce((sum, d) => 
        sum + (d.price || d.total_price || d.total_amount || 0), 0
      )
    };
  }).reverse();

  const maxTrendValue = Math.max(...weeklyTrend.map(d => d.count), 1);

  return (
    <div className="space-y-6">
      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₱{todayRevenue.toFixed(2)}</div>
              <div className="flex items-center text-xs text-muted-foreground mt-1">
                {revenueGrowth >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
                )}
                <span className={revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {Math.abs(revenueGrowth).toFixed(1)}%
                </span>
                <span className="ml-1">vs yesterday</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Deliveries</CardTitle>
              <Package className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{todayDeliveries.length}</div>
              <div className="flex items-center text-xs text-muted-foreground mt-1">
                {deliveryGrowth >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
                )}
                <span className={deliveryGrowth >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {Math.abs(deliveryGrowth).toFixed(1)}%
                </span>
                <span className="ml-1">vs yesterday</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Drivers</CardTitle>
              <Users className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{onlineDrivers.length}</div>
              <div className="text-xs text-muted-foreground mt-1">
                of {safeDrivers.length} total drivers
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
              <BarChart3 className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completionRate.toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground mt-1">
                {completedDeliveries.length} of {safeDeliveries.length} delivered
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Delivery Trend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                7-Day Delivery Trend
              </CardTitle>
              <CardDescription>Daily delivery volume over the past week</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {weeklyTrend.map((day, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm font-medium w-8">{day.day}</span>
                    <div className="flex-1 mx-4 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 rounded-full transition-all duration-300"
                        style={{ width: `${(day.count / maxTrendValue) * 100}%` }}
                      />
                    </div>
                    <div className="text-right min-w-[80px]">
                      <div className="text-sm font-semibold">{day.count}</div>
                      <div className="text-xs text-gray-500">₱{day.revenue.toFixed(0)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Status Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5 text-green-600" />
                Delivery Status Distribution
              </CardTitle>
              <CardDescription>Breakdown of delivery statuses</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(statusCounts)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([status, count]) => {
                  const percentage = safeDeliveries.length > 0 ? (count / safeDeliveries.length) * 100 : 0;
                  const colors: Record<string, string> = {
                    delivered: 'bg-green-500',
                    'in_transit': 'bg-blue-500',
                    picked_up: 'bg-yellow-500',
                    assigned: 'bg-purple-500',
                    pending: 'bg-gray-500',
                    cancelled: 'bg-red-500',
                    failed: 'bg-red-600'
                  };
                  
                  return (
                    <div key={status} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${colors[status] || 'bg-gray-400'}`} />
                        <span className="text-sm font-medium capitalize">
                          {status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">
                          {count}
                        </Badge>
                        <span className="text-sm text-gray-500 w-12 text-right">
                          {percentage.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              {Object.keys(statusCounts).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No delivery data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Monthly Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-indigo-600" />
              Monthly Performance Summary
            </CardTitle>
            <CardDescription>Key metrics for this month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{thisMonthDeliveries.length}</div>
                <div className="text-sm text-gray-600 mt-1">Total Deliveries</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  ₱{thisMonthDeliveries.reduce((sum, d) => 
                    sum + (d.price || d.total_price || d.total_amount || 0), 0
                  ).toFixed(0)}
                </div>
                <div className="text-sm text-gray-600 mt-1">Revenue</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{thisWeekDeliveries.length}</div>
                <div className="text-sm text-gray-600 mt-1">This Week</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-orange-600">{activeDeliveries.length}</div>
                <div className="text-sm text-gray-600 mt-1">Active Now</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}