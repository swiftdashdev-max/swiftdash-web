'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import { useUserContext } from '@/lib/supabase/user-context';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Package, CheckCircle2, XCircle, Clock, TrendingUp, TrendingDown,
  Star, Truck, Download, Loader2, Users, BarChart3, Timer,
  AlertCircle, AlertTriangle, Target, DollarSign, MapPin, Zap,
  Activity, Route, Calendar, ArrowUpRight, ArrowDownRight,
  FileText, CreditCard, RefreshCw,
} from 'lucide-react';

// Dynamically import Recharts
/* eslint-disable @typescript-eslint/no-explicit-any */
const BarChart = dynamic(() => import('recharts').then(m => m.BarChart) as any, { ssr: false }) as any;
const Bar = dynamic(() => import('recharts').then(m => m.Bar) as any, { ssr: false }) as any;
const AreaChart = dynamic(() => import('recharts').then(m => m.AreaChart) as any, { ssr: false }) as any;
const Area = dynamic(() => import('recharts').then(m => m.Area) as any, { ssr: false }) as any;
const LineChart = dynamic(() => import('recharts').then(m => m.LineChart) as any, { ssr: false }) as any;
const Line = dynamic(() => import('recharts').then(m => m.Line) as any, { ssr: false }) as any;
const PieChart = dynamic(() => import('recharts').then(m => m.PieChart) as any, { ssr: false }) as any;
const Pie = dynamic(() => import('recharts').then(m => m.Pie) as any, { ssr: false }) as any;
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis) as any, { ssr: false }) as any;
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis) as any, { ssr: false }) as any;
const CartesianGrid = dynamic(() => import('recharts').then(m => m.CartesianGrid) as any, { ssr: false }) as any;
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip) as any, { ssr: false }) as any;
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer) as any, { ssr: false }) as any;
const Cell = dynamic(() => import('recharts').then(m => m.Cell) as any, { ssr: false }) as any;
const Legend = dynamic(() => import('recharts').then(m => m.Legend) as any, { ssr: false }) as any;

// ─── Types ────────────────────────────────────────────────────────────────

type Period = 'today' | 'week' | 'month' | 'last_month' | 'quarter';

interface Analytics {
  total: number;
  delivered: number;
  cancelled: number;
  failed: number;
  in_transit: number;
  pending: number;
  revenue: number;
  avg_delivery_time_minutes: number;
  on_time_count: number;
  late_count: number;
  avg_distance_km: number;
  total_distance_km: number;
  avg_order_value: number;
  cost_per_delivery: number;
  cash_orders: number;
  card_orders: number;
  maya_orders: number;
  failed_attempt_count: number;
  first_attempt_success: number;
  multi_stop_orders: number;
  scheduled_orders: number;
}

interface DriverPerf {
  driver_id: string;
  driver_name: string;
  current_rating: number;
  is_online: boolean;
  vehicle_model: string;
  plate_number: string;
  total: number;
  completed: number;
  failed: number;
  completion_rate: number;
  avg_delivery_minutes: number;
  total_distance_km: number;
  total_revenue: number;
  on_time_deliveries: number;
  avg_customer_rating: number;
  rating_count: number;
}

interface DailyData {
  date: string;
  delivered: number;
  failed: number;
  cancelled: number;
  total: number;
  revenue: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function getPeriodRange(period: Period): { start: Date; end: Date; label: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (period) {
    case 'today':
      return { start: today, end: new Date(today.getTime() + 86_400_000), label: 'Today' };
    case 'week': {
      const s = new Date(today); s.setDate(today.getDate() - 6);
      return { start: s, end: new Date(today.getTime() + 86_400_000), label: 'Last 7 Days' };
    }
    case 'month': {
      const s = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: s, end: new Date(today.getTime() + 86_400_000), label: 'This Month' };
    }
    case 'last_month': {
      const s = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const e = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: s, end: e, label: 'Last Month' };
    }
    case 'quarter': {
      const s = new Date(today); s.setDate(today.getDate() - 89);
      return { start: s, end: new Date(today.getTime() + 86_400_000), label: 'Last 90 Days' };
    }
  }
}

function fmtCurrency(v: number) {
  return '₱' + v.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDuration(minutes: number) {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  return `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}m`;
}

function pctChange(current: number, previous: number) {
  if (previous === 0) return { pct: 0, up: true };
  const pct = ((current - previous) / previous) * 100;
  return { pct: Math.abs(pct), up: pct >= 0 };
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const router = useRouter();
  const supabase = createClient();
  const { businessId, loading: userLoading } = useUserContext();
  const { toast } = useToast();

  const [period, setPeriod] = useState<Period>('month');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [prevAnalytics, setPrevAnalytics] = useState<Analytics | null>(null);
  const [driverPerf, setDriverPerf] = useState<DriverPerf[]>([]);
  const [hourlyData, setHourlyData] = useState<any[]>([]);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [tab, setTab] = useState('overview');

  // Fetch analytics
  const fetchAnalytics = async (showLoader = true) => {
    if (!businessId) return;
    if (showLoader) setLoading(true);
    else setRefreshing(true);

    try {
      const { start, end } = getPeriodRange(period);
      const prevLen = end.getTime() - start.getTime();
      const prevStart = new Date(start.getTime() - prevLen);

      // Parallel fetch: current analytics, previous analytics, driver perf, hourly, daily
      const [currentRes, prevRes, driverRes, hourlyRes, dailyRes] = await Promise.all([
        supabase.rpc('get_delivery_analytics', {
          p_business_id: businessId,
          p_date_start: start.toISOString(),
          p_date_end: end.toISOString(),
        }),
        supabase.rpc('get_delivery_analytics', {
          p_business_id: businessId,
          p_date_start: prevStart.toISOString(),
          p_date_end: start.toISOString(),
        }),
        supabase.rpc('get_driver_performance', {
          p_business_id: businessId,
          p_date_start: start.toISOString(),
          p_date_end: end.toISOString(),
        }),
        supabase.rpc('get_hourly_distribution', {
          p_business_id: businessId,
          p_date_start: start.toISOString(),
          p_date_end: end.toISOString(),
        }),
        supabase
          .from('deliveries')
          .select('status, created_at, total_amount, total_price')
          .eq('business_id', businessId)
          .gte('created_at', start.toISOString())
          .lt('created_at', end.toISOString())
          .order('created_at', { ascending: true }),
      ]);

      if (currentRes.data) setAnalytics(currentRes.data);
      if (prevRes.data) setPrevAnalytics(prevRes.data);
      if (driverRes.data) setDriverPerf(driverRes.data);
      if (hourlyRes.data) {
        // Fill in missing hours
        const hourMap = new Map((hourlyRes.data || []).map((h: any) => [h.hour, h]));
        const fullHours = Array.from({ length: 24 }, (_, i) => ({
          hour: `${i}:00`,
          total: 0,
          delivered: 0,
          failed: 0,
          ...(hourMap.get(i) || {}),
        }));
        setHourlyData(fullHours);
      }

      // Build daily chart data
      if (dailyRes.data) {
        const buckets = new Map<string, DailyData>();
        const days = Math.ceil((end.getTime() - start.getTime()) / 86_400_000);
        for (let i = 0; i < days; i++) {
          const d = new Date(start.getTime() + i * 86_400_000);
          const key = d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
          buckets.set(key, { date: key, delivered: 0, failed: 0, cancelled: 0, total: 0, revenue: 0 });
        }
        (dailyRes.data || []).forEach((d: any) => {
          const key = new Date(d.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
          const bucket = buckets.get(key);
          if (bucket) {
            bucket.total++;
            bucket.revenue += d.total_amount || d.total_price || 0;
            if (d.status === 'delivered') bucket.delivered++;
            else if (d.status === 'cancelled') bucket.cancelled++;
            else if (['failed', 'failed_attempt'].includes(d.status)) bucket.failed++;
          }
        });
        setDailyData(Array.from(buckets.values()));
      }
    } catch (err) {
      console.error('Analytics fetch error:', err);
      toast({ title: 'Error', description: 'Failed to load analytics', variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (businessId) fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, period]);

  // ─── Computed values ──────────────────────────────────────────────────────

  const a = analytics;
  const p = prevAnalytics;

  const onTimeRate = a && (a.on_time_count + a.late_count) > 0
    ? (a.on_time_count / (a.on_time_count + a.late_count)) * 100
    : 0;
  const firstAttemptRate = a && a.delivered > 0
    ? (a.first_attempt_success / a.delivered) * 100
    : 0;
  const failureRate = a && a.total > 0
    ? ((a.failed + a.cancelled) / a.total) * 100
    : 0;
  const completionRate = a && a.total > 0
    ? (a.delivered / a.total) * 100
    : 0;

  const { label: periodLabel } = getPeriodRange(period);

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (loading || userLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!a) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-muted-foreground">
        <BarChart3 className="h-12 w-12 mb-4 opacity-30" />
        <p className="text-lg font-medium">No analytics data available</p>
        <p className="text-sm mt-1">Start creating deliveries to see insights here.</p>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6" />
            Advanced Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {periodLabel} · {a.total} deliveries · {fmtCurrency(a.revenue)} revenue
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={period} onValueChange={v => setPeriod(v as Period)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
              <SelectItem value="quarter">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => fetchAnalytics(false)} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="ml-1.5 hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="drivers">Drivers</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
        </TabsList>

        {/* ═══ OVERVIEW TAB ═══ */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          {/* KPI Row 1 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              label="Total Deliveries" value={a.total.toString()}
              icon={<Package className="h-4 w-4" />}
              trend={p ? pctChange(a.total, p.total) : undefined}
            />
            <KPICard
              label="Revenue" value={fmtCurrency(a.revenue)}
              icon={<DollarSign className="h-4 w-4" />}
              trend={p ? pctChange(a.revenue, p.revenue) : undefined}
            />
            <KPICard
              label="Completion Rate" value={`${completionRate.toFixed(1)}%`}
              icon={<Target className="h-4 w-4" />}
              trend={p ? pctChange(completionRate, p.total > 0 ? (p.delivered / p.total) * 100 : 0) : undefined}
              valueColor={completionRate >= 90 ? 'text-green-600' : completionRate >= 70 ? 'text-yellow-600' : 'text-red-500'}
            />
            <KPICard
              label="Avg Order Value" value={fmtCurrency(a.avg_order_value)}
              icon={<BarChart3 className="h-4 w-4" />}
              trend={p ? pctChange(a.avg_order_value, p.avg_order_value) : undefined}
            />
          </div>

          {/* KPI Row 2: Operational Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              label="On-Time Delivery" value={`${onTimeRate.toFixed(1)}%`}
              icon={<Timer className="h-4 w-4" />}
              subtitle={`${a.on_time_count} of ${a.on_time_count + a.late_count} deliveries`}
              valueColor={onTimeRate >= 90 ? 'text-green-600' : onTimeRate >= 75 ? 'text-yellow-600' : 'text-red-500'}
            />
            <KPICard
              label="Avg Delivery Time" value={a.avg_delivery_time_minutes > 0 ? fmtDuration(a.avg_delivery_time_minutes) : '—'}
              icon={<Clock className="h-4 w-4" />}
              subtitle="from booked to delivered"
            />
            <KPICard
              label="First Attempt Success" value={`${firstAttemptRate.toFixed(1)}%`}
              icon={<CheckCircle2 className="h-4 w-4" />}
              subtitle={`${a.first_attempt_success} of ${a.delivered} succeeded first try`}
              valueColor={firstAttemptRate >= 90 ? 'text-green-600' : 'text-yellow-600'}
            />
            <KPICard
              label="Failure Rate" value={`${failureRate.toFixed(1)}%`}
              icon={<AlertTriangle className="h-4 w-4" />}
              subtitle={`${a.failed + a.cancelled} failed/cancelled`}
              valueColor={failureRate <= 5 ? 'text-green-600' : failureRate <= 15 ? 'text-yellow-600' : 'text-red-500'}
            />
          </div>

          {/* KPI Row 3: Cost & Distance */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              label="Cost Per Delivery" value={a.cost_per_delivery > 0 ? fmtCurrency(a.cost_per_delivery) : '—'}
              icon={<DollarSign className="h-4 w-4" />}
            />
            <KPICard
              label="Avg Distance" value={`${Number(a.avg_distance_km).toFixed(1)} km`}
              icon={<Route className="h-4 w-4" />}
            />
            <KPICard
              label="Total Distance" value={`${Number(a.total_distance_km).toFixed(0)} km`}
              icon={<MapPin className="h-4 w-4" />}
            />
            <KPICard
              label="Active Drivers" value={driverPerf.length.toString()}
              icon={<Users className="h-4 w-4" />}
              subtitle={`${driverPerf.filter(d => d.is_online).length} currently online`}
            />
          </div>

          {/* Daily Volume Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Daily Delivery Volume & Revenue</CardTitle>
              <CardDescription className="text-xs">{periodLabel}</CardDescription>
            </CardHeader>
            <CardContent>
              {dailyData.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={dailyData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
                    barSize={period === 'quarter' ? 4 : period === 'month' ? 10 : 20}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
                      interval={period === 'quarter' ? 13 : period === 'month' ? 6 : 0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="delivered" fill="#10b981" stackId="a" name="Delivered" />
                    <Bar dataKey="failed" fill="#f97316" stackId="a" name="Failed" />
                    <Bar dataKey="cancelled" fill="#ef4444" stackId="a" name="Cancelled" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              <div className="flex items-center gap-4 mt-2 justify-center">
                {([['#10b981', 'Delivered'], ['#f97316', 'Failed'], ['#ef4444', 'Cancelled']] as [string, string][]).map(([color, label]) => (
                  <div key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                    {label}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Status & Payment Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Delivery Status Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <StatusBar label="Delivered" count={a.delivered} total={a.total} color="#10b981" />
                <StatusBar label="In Transit" count={a.in_transit} total={a.total} color="#3b82f6" />
                <StatusBar label="Pending" count={a.pending} total={a.total} color="#f59e0b" />
                <StatusBar label="Failed" count={a.failed} total={a.total} color="#f97316" />
                <StatusBar label="Cancelled" count={a.cancelled} total={a.total} color="#ef4444" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Payment Methods</CardTitle>
              </CardHeader>
              <CardContent>
                <StatusBar label="Cash on Delivery" count={a.cash_orders} total={a.total} color="#10b981" />
                <StatusBar label="Credit Card" count={a.card_orders} total={a.total} color="#6366f1" />
                <StatusBar label="Maya Wallet" count={a.maya_orders} total={a.total} color="#3b82f6" />
                <StatusBar label="Other" count={Math.max(0, a.total - a.cash_orders - a.card_orders - a.maya_orders)} total={a.total} color="#9ca3af" />
                <Separator className="my-3" />
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground">Multi-stop orders</span>
                    <p className="font-semibold">{a.multi_stop_orders}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Scheduled orders</span>
                    <p className="font-semibold">{a.scheduled_orders}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══ PERFORMANCE TAB ═══ */}
        <TabsContent value="performance" className="space-y-6 mt-4">
          {/* SLA Gauges */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SLAGauge
              label="On-Time Delivery Rate"
              value={onTimeRate}
              target={95}
              icon={<Timer className="h-5 w-5" />}
              description="Target: 95% of deliveries on time"
            />
            <SLAGauge
              label="First Attempt Success"
              value={firstAttemptRate}
              target={90}
              icon={<CheckCircle2 className="h-5 w-5" />}
              description="Target: 90% delivered on first attempt"
            />
            <SLAGauge
              label="Completion Rate"
              value={completionRate}
              target={95}
              icon={<Target className="h-5 w-5" />}
              description="Target: 95% order completion"
            />
          </div>

          {/* Peak Hours */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-500" />
                <CardTitle className="text-sm font-semibold">Order Volume by Hour</CardTitle>
              </div>
              <CardDescription className="text-xs">Identify peak periods to optimize driver scheduling</CardDescription>
            </CardHeader>
            <CardContent>
              {hourlyData.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={hourlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barSize={10}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="hour" tick={{ fontSize: 9 }} tickLine={false} axisLine={false}
                      interval={2} tickFormatter={(v: any) => v.split(':')[0]} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <Bar dataKey="delivered" fill="#10b981" stackId="a" name="Delivered" />
                    <Bar dataKey="failed" fill="#ef4444" stackId="a" name="Failed" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Revenue Trend */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <CardTitle className="text-sm font-semibold">Revenue Trend</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {dailyData.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={dailyData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} tickLine={false} axisLine={false}
                      interval={Math.max(1, Math.floor(dailyData.length / 7))} />
                    <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false}
                      tickFormatter={(v: any) => `₱${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }}
                      formatter={(v: any) => [fmtCurrency(v), 'Revenue']} />
                    <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2}
                      fill="url(#revGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ DRIVERS TAB ═══ */}
        <TabsContent value="drivers" className="space-y-6 mt-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Driver Leaderboard</h2>
            <Badge variant="outline">{driverPerf.length} drivers</Badge>
          </div>

          {driverPerf.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Truck className="h-10 w-10 mb-3 opacity-40" />
                <p>No driver data for this period</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {driverPerf.map((driver, idx) => (
                <Card key={driver.driver_id}
                  className={idx === 0 ? 'border-yellow-400 dark:border-yellow-600' : ''}>
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      {/* Rank + Name */}
                      <div className="flex items-center gap-3 min-w-0 sm:w-48">
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                          ${idx === 0 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                            : idx === 1 ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                            : idx === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                            : 'bg-muted text-muted-foreground'}`}
                        >
                          {idx + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{driver.driver_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {driver.vehicle_model || 'Unknown'} · {driver.plate_number || 'N/A'}
                          </p>
                        </div>
                        {driver.is_online && <Badge className="bg-green-100 text-green-700 text-[10px]">Online</Badge>}
                      </div>

                      {/* Stats */}
                      <div className="flex-1 grid grid-cols-2 sm:grid-cols-6 gap-3">
                        <div className="text-center sm:text-left">
                          <p className="text-xs text-muted-foreground">Deliveries</p>
                          <p className="font-semibold text-sm">{driver.completed}<span className="text-xs text-muted-foreground">/{driver.total}</span></p>
                        </div>
                        <div className="text-center sm:text-left">
                          <p className="text-xs text-muted-foreground">Completion</p>
                          <p className={`font-semibold text-sm ${
                            Number(driver.completion_rate) >= 90 ? 'text-green-600' : Number(driver.completion_rate) >= 70 ? 'text-yellow-600' : 'text-red-500'
                          }`}>{Number(driver.completion_rate).toFixed(0)}%</p>
                        </div>
                        <div className="text-center sm:text-left">
                          <p className="text-xs text-muted-foreground">On-Time</p>
                          <p className="font-semibold text-sm">
                            {driver.completed > 0 ? `${Math.round((driver.on_time_deliveries / driver.completed) * 100)}%` : '—'}
                          </p>
                        </div>
                        <div className="text-center sm:text-left">
                          <p className="text-xs text-muted-foreground">Avg Time</p>
                          <p className="font-semibold text-sm">
                            {Number(driver.avg_delivery_minutes) > 0 ? fmtDuration(Number(driver.avg_delivery_minutes)) : '—'}
                          </p>
                        </div>
                        <div className="text-center sm:text-left">
                          <p className="text-xs text-muted-foreground">Rating</p>
                          <div className="flex items-center gap-1">
                            <Star className={`h-3.5 w-3.5 ${Number(driver.avg_customer_rating) >= 4 ? 'text-yellow-500' : 'text-gray-400'}`} />
                            <span className="font-semibold text-sm">
                              {Number(driver.avg_customer_rating) > 0 ? Number(driver.avg_customer_rating).toFixed(1) : '—'}
                            </span>
                            <span className="text-[10px] text-muted-foreground">({driver.rating_count})</span>
                          </div>
                        </div>
                        <div className="text-center sm:text-left">
                          <p className="text-xs text-muted-foreground">Revenue</p>
                          <p className="font-semibold text-sm">{fmtCurrency(Number(driver.total_revenue))}</p>
                        </div>
                      </div>

                      {driver.failed > 0 && (
                        <Badge variant="outline" className="text-xs border-red-300 text-red-600 shrink-0">
                          {driver.failed} failed
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ═══ OPERATIONS TAB ═══ */}
        <TabsContent value="operations" className="space-y-6 mt-4">
          {/* Failed Delivery Analysis */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <CardTitle className="text-sm font-semibold">Failed Delivery Analysis</CardTitle>
              </div>
              <CardDescription className="text-xs">
                {a.failed + a.cancelled} deliveries failed or cancelled out of {a.total}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20">
                  <p className="text-xs text-muted-foreground">Cancelled</p>
                  <p className="text-xl font-bold text-red-600">{a.cancelled}</p>
                  <p className="text-xs text-muted-foreground">{a.total > 0 ? ((a.cancelled / a.total) * 100).toFixed(1) : 0}% of total</p>
                </div>
                <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20">
                  <p className="text-xs text-muted-foreground">Failed</p>
                  <p className="text-xl font-bold text-orange-600">{a.failed}</p>
                  <p className="text-xs text-muted-foreground">{a.total > 0 ? ((a.failed / a.total) * 100).toFixed(1) : 0}% of total</p>
                </div>
                <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/20">
                  <p className="text-xs text-muted-foreground">Failed Attempts</p>
                  <p className="text-xl font-bold text-yellow-600">{a.failed_attempt_count}</p>
                  <p className="text-xs text-muted-foreground">across all deliveries</p>
                </div>
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
                  <p className="text-xs text-muted-foreground">First Attempt Success</p>
                  <p className="text-xl font-bold text-green-600">{firstAttemptRate.toFixed(0)}%</p>
                  <p className="text-xs text-muted-foreground">{a.first_attempt_success} of {a.delivered}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Distance Analysis */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Route className="h-4 w-4 text-blue-500" />
                <CardTitle className="text-sm font-semibold">Operational Metrics</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                  <p className="text-xs text-muted-foreground">Total Distance</p>
                  <p className="text-xl font-bold text-blue-600">{Number(a.total_distance_km).toFixed(0)} km</p>
                </div>
                <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/20">
                  <p className="text-xs text-muted-foreground">Avg Distance</p>
                  <p className="text-xl font-bold text-indigo-600">{Number(a.avg_distance_km).toFixed(1)} km</p>
                </div>
                <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20">
                  <p className="text-xs text-muted-foreground">Multi-Stop Orders</p>
                  <p className="text-xl font-bold text-purple-600">{a.multi_stop_orders}</p>
                  <p className="text-xs text-muted-foreground">{a.total > 0 ? ((a.multi_stop_orders / a.total) * 100).toFixed(0) : 0}% of total</p>
                </div>
                <div className="p-3 rounded-lg bg-cyan-50 dark:bg-cyan-950/20">
                  <p className="text-xs text-muted-foreground">Scheduled Orders</p>
                  <p className="text-xl font-bold text-cyan-600">{a.scheduled_orders}</p>
                  <p className="text-xs text-muted-foreground">{a.total > 0 ? ((a.scheduled_orders / a.total) * 100).toFixed(0) : 0}% of total</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function KPICard({ label, value, icon, trend, subtitle, valueColor }: {
  label: string; value: string; icon: React.ReactNode;
  trend?: { pct: number; up: boolean }; subtitle?: string; valueColor?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <span className="text-muted-foreground">{icon}</span>
        </div>
        <p className={`text-2xl font-bold ${valueColor || ''}`}>{value}</p>
        {trend && (
          <div className={`flex items-center gap-1 mt-1 text-xs ${trend.up ? 'text-green-600' : 'text-red-500'}`}>
            {trend.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {trend.pct > 0 ? `${trend.pct.toFixed(1)}% vs prev` : 'No change'}
          </div>
        )}
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function StatusBar({ label, count, total, color }: {
  label: string; count: number; total: number; color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="mb-2.5">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{count} ({pct.toFixed(0)}%)</span>
      </div>
      <div className="w-full bg-muted rounded-full h-1.5">
        <div className="h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function SLAGauge({ label, value, target, icon, description }: {
  label: string; value: number; target: number; icon: React.ReactNode; description: string;
}) {
  const met = value >= target;
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-2 mb-3">
          <span className={met ? 'text-green-500' : 'text-orange-500'}>{icon}</span>
          <p className="text-sm font-semibold">{label}</p>
        </div>
        <div className="flex items-end gap-2 mb-2">
          <span className={`text-3xl font-bold ${met ? 'text-green-600' : value >= target * 0.8 ? 'text-yellow-600' : 'text-red-500'}`}>
            {value.toFixed(1)}%
          </span>
          <span className="text-sm text-muted-foreground mb-1">/ {target}%</span>
        </div>
        <Progress value={Math.min(value, 100)} className="h-2"
          // @ts-ignore
          style={{ '--progress-color': met ? '#10b981' : value >= target * 0.8 ? '#f59e0b' : '#ef4444' }}
        />
        <p className="text-xs text-muted-foreground mt-2">{description}</p>
        <Badge variant={met ? 'default' : 'destructive'} className="mt-2 text-[10px]">
          {met ? '✓ SLA Met' : '✗ Below Target'}
        </Badge>
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return (
    <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
      <BarChart3 className="h-8 w-8 mb-2 opacity-40" />
      <p className="text-sm">No data for this period</p>
    </div>
  );
}
