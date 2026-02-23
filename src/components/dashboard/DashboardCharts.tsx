'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TrendingUp,
  Package,
  Clock,
  Calendar,
  PieChart as PieChartIcon,
  Activity,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

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

const STATUS_COLORS: Record<string, string> = {
  delivered: '#22c55e',
  in_transit: '#3b82f6',
  picking_up: '#f59e0b',
  driver_assigned: '#8b5cf6',
  driver_offered: '#f97316',
  pending: '#6b7280',
  cancelled: '#ef4444',
  failed: '#dc2626',
  scheduled: '#06b6d4',
};

const STATUS_LABELS: Record<string, string> = {
  delivered: 'Delivered',
  in_transit: 'In Transit',
  picking_up: 'Picking Up',
  driver_assigned: 'Assigned',
  driver_offered: 'Offered',
  pending: 'Pending',
  cancelled: 'Cancelled',
  failed: 'Failed',
  scheduled: 'Scheduled',
};

const getPrice = (d: DeliveryData) => d.price || d.total_price || d.total_amount || 0;

export default function DashboardCharts({ deliveries = [], drivers = [], isLoading }: DashboardChartsProps) {
  const safeDeliveries = Array.isArray(deliveries) ? deliveries : [];

  // ── Derived data ──────────────────────────────────────────────
  const { weeklyTrend, statusDistribution, hourlyActivity, monthlyTrend } = useMemo(() => {
    const today = new Date();

    // 7-day trend (deliveries + revenue per day)
    const weeklyTrend = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(today);
      date.setDate(date.getDate() - (6 - i));
      const dateStr = date.toDateString();
      const dayDeliveries = safeDeliveries.filter(d => new Date(d.created_at).toDateString() === dateStr);
      return {
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        deliveries: dayDeliveries.length,
        revenue: Math.round(dayDeliveries.reduce((s, d) => s + getPrice(d), 0)),
      };
    });

    // Status distribution for pie chart
    const counts: Record<string, number> = {};
    safeDeliveries.forEach(d => { counts[d.status] = (counts[d.status] || 0) + 1; });
    const statusDistribution = Object.entries(counts)
      .map(([status, value]) => ({
        name: STATUS_LABELS[status] || status.replace(/_/g, ' '),
        value,
        color: STATUS_COLORS[status] || '#9ca3af',
      }))
      .sort((a, b) => b.value - a.value);

    // Hourly activity (all deliveries grouped by hour of day)
    const hourBuckets = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      label: h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`,
      count: 0,
    }));
    safeDeliveries.forEach(d => {
      const h = new Date(d.created_at).getHours();
      hourBuckets[h].count++;
    });
    const hourlyActivity = hourBuckets;

    // Monthly trend (last 6 months)
    const monthlyTrend = Array.from({ length: 6 }, (_, i) => {
      const date = new Date(today.getFullYear(), today.getMonth() - (5 - i), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
      const monthDeliveries = safeDeliveries.filter(d => {
        const created = new Date(d.created_at);
        return created >= date && created <= monthEnd;
      });
      const completed = monthDeliveries.filter(d => d.status === 'delivered').length;
      return {
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        deliveries: monthDeliveries.length,
        completed,
        revenue: Math.round(monthDeliveries.reduce((s, d) => s + getPrice(d), 0)),
      };
    });

    return { weeklyTrend, statusDistribution, hourlyActivity, monthlyTrend };
  }, [safeDeliveries]);

  // ── Loading skeleton ──────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[260px] w-full rounded-lg" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // ── Custom tooltip ────────────────────────────────────────────
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white dark:bg-gray-900 border rounded-lg shadow-lg px-3 py-2 text-sm">
        <p className="font-medium text-foreground mb-1">{label}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} className="text-muted-foreground" style={{ color: entry.color }}>
            {entry.name}: {entry.name === 'Revenue' ? `₱${entry.value.toLocaleString()}` : entry.value}
          </p>
        ))}
      </div>
    );
  };

  const PieTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const entry = payload[0];
    const pct = safeDeliveries.length > 0 ? ((entry.value / safeDeliveries.length) * 100).toFixed(1) : '0';
    return (
      <div className="bg-white dark:bg-gray-900 border rounded-lg shadow-lg px-3 py-2 text-sm">
        <p className="font-medium" style={{ color: entry.payload.color }}>{entry.name}</p>
        <p className="text-muted-foreground">{entry.value} deliveries ({pct}%)</p>
      </div>
    );
  };

  const emptyState = (
    <div className="flex items-center justify-center h-[260px] text-muted-foreground">
      <div className="text-center">
        <Package className="h-10 w-10 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No delivery data yet</p>
      </div>
    </div>
  );

  const hasData = safeDeliveries.length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ── 1. Delivery Volume – Area Chart ────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Card className="h-full">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4 text-blue-600" />
              Delivery Volume
            </CardTitle>
            <CardDescription>Last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            {!hasData ? emptyState : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={weeklyTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorDeliveries" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="deliveries"
                    name="Deliveries"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#colorDeliveries)"
                    dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
                    activeDot={{ r: 6 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ── 2. Revenue Trend – Bar Chart ───────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
        <Card className="h-full">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              Revenue
            </CardTitle>
            <CardDescription>Last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            {!hasData ? emptyState : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={weeklyTrend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                    tickFormatter={(v) => `₱${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ── 3. Status Breakdown – Donut Chart ──────────────────── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
        <Card className="h-full">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <PieChartIcon className="h-4 w-4 text-violet-600" />
              Status Breakdown
            </CardTitle>
            <CardDescription>All-time delivery statuses</CardDescription>
          </CardHeader>
          <CardContent>
            {!hasData ? emptyState : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="55%" height={260}>
                  <PieChart>
                    <Pie
                      data={statusDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {statusDistribution.map((entry, index) => (
                        <Cell key={index} fill={entry.color} strokeWidth={0} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {statusDistribution.map((entry) => {
                    const pct = safeDeliveries.length > 0 ? ((entry.value / safeDeliveries.length) * 100).toFixed(0) : '0';
                    return (
                      <div key={entry.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                          <span className="text-muted-foreground truncate">{entry.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className="font-semibold tabular-nums">{entry.value}</span>
                          <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ── 4. Peak Hours – Bar Chart ──────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }}>
        <Card className="h-full">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-amber-600" />
              Peak Hours
            </CardTitle>
            <CardDescription>Delivery volume by hour of day</CardDescription>
          </CardHeader>
          <CardContent>
            {!hasData ? emptyState : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={hourlyActivity} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10 }}
                    className="text-muted-foreground"
                    interval={1}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <Tooltip
                    content={({ active, payload }: any) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      const hourLabel = `${d.hour === 0 ? 12 : d.hour > 12 ? d.hour - 12 : d.hour}:00 ${d.hour < 12 ? 'AM' : 'PM'}`;
                      return (
                        <div className="bg-white dark:bg-gray-900 border rounded-lg shadow-lg px-3 py-2 text-sm">
                          <p className="font-medium">{hourLabel}</p>
                          <p className="text-amber-600">{d.count} deliveries</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="count" name="Deliveries" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ── 5. Monthly Trend – Stacked Bar Chart ───────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
        className="lg:col-span-2"
      >
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-indigo-600" />
              6-Month Overview
            </CardTitle>
            <CardDescription>Monthly delivery volume and completion</CardDescription>
          </CardHeader>
          <CardContent>
            {!hasData ? emptyState : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthlyTrend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="top"
                    height={36}
                    iconType="circle"
                    iconSize={8}
                    formatter={(value: string) => <span className="text-sm text-muted-foreground">{value}</span>}
                  />
                  <Bar dataKey="deliveries" name="Total" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="completed" name="Completed" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}