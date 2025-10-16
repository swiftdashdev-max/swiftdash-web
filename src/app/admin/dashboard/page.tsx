'use client';

import { motion } from 'framer-motion';
import { MetricCard } from '@/components/ui/metric-card';
import { RevenueChart, UserChart } from '@/components/ui/chart-card';
import { useDashboardData } from '@/hooks/use-dashboard-data';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import AdminLayout from '@/components/admin-layout';
import { 
  TruckIcon, 
  Users, 
  DollarSign, 
  UserCheck,
  AlertCircle,
  Clock,
  TrendingUp,
  Activity,
  RefreshCw,
  Wifi,
  WifiOff
} from 'lucide-react';

export default function AdminDashboard() {
  const {
    metrics,
    deliveryStats,
    driverStats,
    revenueChartData,
    userChartData,
    isLoading,
    error,
    refreshData,
    lastUpdated
  } = useDashboardData();

  const handleRefresh = async () => {
    await refreshData();
  };

  const isRecentlyUpdated = lastUpdated && (Date.now() - lastUpdated.getTime()) < 120000; // 2 minutes

  return (
    <AdminLayout currentPath="/admin/dashboard">
      <div className="flex-1 space-y-6 p-6">
        <div className="flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-3xl font-bold tracking-tight">Dashboard Overview</h1>
            <p className="text-muted-foreground">Welcome back, Admin! Here's a snapshot of your platform.</p>
          </motion.div>
          <div className="flex items-center gap-4">
            {lastUpdated && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {isRecentlyUpdated ? (
                  <Wifi className="h-4 w-4 text-green-500" />
                ) : (
                  <WifiOff className="h-4 w-4 text-yellow-500" />
                )}
                Last updated: {lastUpdated.toLocaleTimeString()}
              </div>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">Error loading dashboard data:</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Primary Metrics Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid gap-6 md:grid-cols-2 lg:grid-cols-5"
        >
          <MetricCard
            title="Active Deliveries"
            value={metrics.activeDeliveries}
            icon={TruckIcon}
            iconColor="text-[#1CB8F7]"
            description="Currently in progress"
            isLoading={isLoading}
            badge={metrics.activeDeliveries > 0 ? { text: "Live", variant: "default" } : undefined}
          />
          
          <MetricCard
            title="Daily Revenue"
            value={metrics.dailyRevenue}
            icon={DollarSign}
            iconColor="text-green-600"
            description="Today's earnings"
            isLoading={isLoading}
            change={metrics.dailyRevenue > 0 ? { 
              value: `₱${metrics.weeklyRevenue.toLocaleString()}`, 
              type: "increase", 
              label: "this week" 
            } : undefined}
          />
          
          <MetricCard
            title="Active Users"
            value={metrics.activeUsers}
            icon={Users}
            iconColor="text-[#1CB8F7]"
            description="Active in last 30 days"
            isLoading={isLoading}
          />
          
          <MetricCard
            title="Active Drivers"
            value={metrics.activeDrivers}
            icon={UserCheck}
            iconColor="text-[#3B4CCA]"
            description="Online and available"
            isLoading={isLoading}
            badge={metrics.activeDrivers > 0 ? { text: "Online", variant: "secondary" } : { text: "Offline", variant: "outline" }}
          />

          <MetricCard
            title="Total Users"
            value={metrics.totalUsers}
            icon={Activity}
            iconColor="text-purple-600"
            description="Platform users"
            isLoading={isLoading}
          />
        </motion.div>

        {/* Secondary Metrics */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="grid gap-6 md:grid-cols-2 lg:grid-cols-4"
        >
          <MetricCard
            title="Pending Verifications"
            value={metrics.pendingVerifications}
            icon={Clock}
            iconColor="text-yellow-600"
            description="Drivers awaiting approval"
            isLoading={isLoading}
            badge={metrics.pendingVerifications > 0 ? { text: "Action Required", variant: "destructive" } : undefined}
          />
          
          <MetricCard
            title="Pending Remittances"
            value={metrics.pendingRemittances}
            icon={DollarSign}
            iconColor="text-orange-600"
            description="Cash collections to verify"
            isLoading={isLoading}
            badge={metrics.pendingRemittances > 0 ? { text: "Review", variant: "secondary" } : undefined}
          />
          
          <MetricCard
            title="Failed Payments"
            value={metrics.failedPayments}
            icon={AlertCircle}
            iconColor="text-red-600"
            description="Requires attention"
            isLoading={isLoading}
            badge={metrics.failedPayments > 0 ? { text: "Critical", variant: "destructive" } : undefined}
          />
          
          <MetricCard
            title="Total Revenue"
            value={metrics.totalRevenue}
            icon={TrendingUp}
            iconColor="text-[#3B4CCA]"
            description="All-time platform earnings"
            isLoading={isLoading}
          />
        </motion.div>

        {/* Charts Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="grid gap-6 md:grid-cols-2"
        >
          <RevenueChart data={revenueChartData} isLoading={isLoading} />
          <UserChart data={userChartData} isLoading={isLoading} />
        </motion.div>

        {/* Stats Breakdown */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="grid gap-6 md:grid-cols-2"
        >
          {/* Delivery Status Breakdown */}
          <div className="rounded-lg border bg-card p-6">
            <h3 className="text-lg font-semibold mb-4">Delivery Status Breakdown</h3>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="flex justify-between animate-pulse">
                    <div className="h-4 bg-muted rounded w-24"></div>
                    <div className="h-4 bg-muted rounded w-8"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Pending</span>
                  <Badge variant="outline">{deliveryStats.pending}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">In Transit</span>
                  <Badge variant="default">{deliveryStats.in_transit}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Package Collected</span>
                  <Badge variant="secondary">{deliveryStats.package_collected}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Delivered</span>
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                    {deliveryStats.delivered}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Cancelled/Failed</span>
                  <Badge variant="destructive">{deliveryStats.cancelled + deliveryStats.failed}</Badge>
                </div>
              </div>
            )}
          </div>

          {/* Driver Status Breakdown */}
          <div className="rounded-lg border bg-card p-6">
            <h3 className="text-lg font-semibold mb-4">Driver Status Overview</h3>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="flex justify-between animate-pulse">
                    <div className="h-4 bg-muted rounded w-24"></div>
                    <div className="h-4 bg-muted rounded w-8"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Drivers</span>
                  <Badge variant="outline">{driverStats.total}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Verified</span>
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                    {driverStats.verified}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Online</span>
                  <Badge variant="default">{driverStats.online}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Available</span>
                  <Badge variant="secondary">{driverStats.available}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Suspended</span>
                  <Badge variant="destructive">{driverStats.suspended}</Badge>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AdminLayout>
  );
}
