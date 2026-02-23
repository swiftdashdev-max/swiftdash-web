'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Package, CheckCircle2, XCircle, Clock, TrendingUp, TrendingDown,
  Star, Truck, Download, Loader2, Users, BarChart3,
  AlertCircle, FileText, CreditCard, MapPin, Zap,
} from 'lucide-react';

// Dynamically import Recharts to avoid SSR issues
const BarChart = dynamic(() => import('recharts').then(m => m.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then(m => m.Bar), { ssr: false });
const AreaChart = dynamic(() => import('recharts').then(m => m.AreaChart), { ssr: false });
const Area = dynamic(() => import('recharts').then(m => m.Area), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(m => m.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });
const Cell = dynamic(() => import('recharts').then(m => m.Cell), { ssr: false });

// ─── Types ────────────────────────────────────────────────────────────────────

interface Delivery {
  id: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  total_amount: number | null;
  total_price: number | null;
  distance_km: number | null;
  customer_rating: number | null;
  driver_id: string | null;
  vehicle_type_id: string | null;
  estimated_duration: number | null;
  payment_method: string | null;
}

interface DriverStat {
  driver_id: string;
  name: string;
  total: number;
  completed: number;
  cancelled: number;
  avg_rating: number;
  avg_duration_min: number | null;
  completion_rate: number;
  total_distance: number;
}

type Period = 'today' | 'week' | 'month' | 'last_month' | 'quarter';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function trend(current: number, previous: number): { pct: number; up: boolean } {
  if (previous === 0) return { pct: 0, up: true };
  const pct = ((current - previous) / previous) * 100;
  return { pct: Math.abs(pct), up: pct >= 0 };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const router = useRouter();
  const supabase = createClient();
  const reportRef = useRef<HTMLDivElement>(null);

  const [businessId, setBusinessId] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('month');
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [allDeliveries, setAllDeliveries] = useState<Delivery[]>([]);
  const [driverNames, setDriverNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  // ── Auth ──
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/business/login'); return; }
      const { data: profile } = await supabase
        .from('user_profiles').select('business_id').eq('id', user.id).single();
      if (profile?.business_id) setBusinessId(profile.business_id);
      else router.push('/business/login');
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fetch all deliveries for this business ──
  useEffect(() => {
    if (!businessId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('deliveries')
        .select('id,status,created_at,completed_at,total_amount,total_price,distance_km,customer_rating,driver_id,vehicle_type_id,estimated_duration,payment_method')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });

      const rows = (data || []) as Delivery[];
      setAllDeliveries(rows);

      // Fetch driver names
      const driverIds = [...new Set(rows.map(d => d.driver_id).filter(Boolean))] as string[];
      if (driverIds.length > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id,first_name,last_name')
          .in('id', driverIds);
        const map = new Map<string, string>();
        (profiles || []).forEach(p => map.set(p.id, `${p.first_name} ${p.last_name}`));
        setDriverNames(map);
      }

      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  // ── Filter to selected period ──
  useEffect(() => {
    const { start, end } = getPeriodRange(period);
    setDeliveries(
      allDeliveries.filter(d => {
        const t = new Date(d.created_at).getTime();
        return t >= start.getTime() && t < end.getTime();
      })
    );
  }, [period, allDeliveries]);

  // ── Previous period for comparison ──
  const prevDeliveries = useMemo(() => {
    const { start, end } = getPeriodRange(period);
    const len = end.getTime() - start.getTime();
    const ps = new Date(start.getTime() - len);
    const pe = start;
    return allDeliveries.filter(d => {
      const t = new Date(d.created_at).getTime();
      return t >= ps.getTime() && t < pe.getTime();
    });
  }, [period, allDeliveries]);

  // ── KPI calculations ──
  const kpis = useMemo(() => {
    const total = deliveries.length;
    const completed = deliveries.filter(d => d.status === 'delivered').length;
    const cancelled = deliveries.filter(d => d.status === 'cancelled' || d.status === 'failed').length;
    const completionRate = total > 0 ? (completed / total) * 100 : 0;

    const revenue = deliveries.reduce((s, d) => s + (d.total_amount ?? d.total_price ?? 0), 0);
    const completedRows = deliveries.filter(d => d.status === 'delivered');
    const avgOrderValue = completedRows.length > 0
      ? completedRows.reduce((s, d) => s + (d.total_amount ?? d.total_price ?? 0), 0) / completedRows.length
      : 0;

    const rated = deliveries.filter(d => d.customer_rating != null);
    const avgRating = rated.length > 0
      ? rated.reduce((s, d) => s + d.customer_rating!, 0) / rated.length
      : 0;

    const completedWithTime = deliveries.filter(d => d.status === 'delivered' && d.completed_at);
    const avgDuration = completedWithTime.length > 0
      ? completedWithTime.reduce((s, d) => {
          const mins = (new Date(d.completed_at!).getTime() - new Date(d.created_at).getTime()) / 60000;
          return s + mins;
        }, 0) / completedWithTime.length
      : null;

    const prevTotal = prevDeliveries.length;
    const prevRevenue = prevDeliveries.reduce((s, d) => s + (d.total_amount ?? d.total_price ?? 0), 0);
    const prevCompleted = prevDeliveries.filter(d => d.status === 'delivered').length;
    const prevRate = prevTotal > 0 ? (prevCompleted / prevTotal) * 100 : 0;

    return {
      total, completed, cancelled, completionRate, revenue, avgOrderValue,
      avgRating, avgDuration, ratingCount: rated.length,
      prevTotal, prevRevenue, prevCompletionRate: prevRate,
    };
  }, [deliveries, prevDeliveries]);

  // ── Daily volume chart data ──
  const volumeData = useMemo(() => {
    const { start, end } = getPeriodRange(period);
    const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
    const buckets: Record<string, { date: string; Delivered: number; Cancelled: number; Pending: number }> = {};

    for (let i = 0; i < days; i++) {
      const d = new Date(start.getTime() + i * 86_400_000);
      const key = d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
      buckets[key] = { date: key, Delivered: 0, Cancelled: 0, Pending: 0 };
    }

    deliveries.forEach(d => {
      const key = new Date(d.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
      if (!buckets[key]) return;
      if (d.status === 'delivered') buckets[key].Delivered++;
      else if (d.status === 'cancelled' || d.status === 'failed') buckets[key].Cancelled++;
      else buckets[key].Pending++;
    });

    return Object.values(buckets);
  }, [deliveries, period]);

  // ── Status breakdown ──
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    deliveries.forEach(d => { counts[d.status] = (counts[d.status] ?? 0) + 1; });
    const colors: Record<string, string> = {
      delivered: '#10b981', cancelled: '#ef4444', failed: '#f97316',
      pending: '#f59e0b', in_transit: '#3b82f6', driver_assigned: '#6366f1',
      package_collected: '#8b5cf6', pickup_arrived: '#ec4899',
    };
    const labels: Record<string, string> = {
      delivered: 'Delivered', cancelled: 'Cancelled', failed: 'Failed',
      pending: 'Pending', in_transit: 'In Transit', driver_assigned: 'Driver Assigned',
      package_collected: 'Pkg Collected', pickup_arrived: 'At Pickup',
    };
    return Object.entries(counts).map(([status, count]) => ({
      name: labels[status] ?? status,
      value: count,
      color: colors[status] ?? '#9ca3af',
    }));
  }, [deliveries]);

  // ── Driver performance ──
  const driverStats = useMemo((): DriverStat[] => {
    const map = new Map<string, DriverStat>();

    deliveries.forEach(d => {
      if (!d.driver_id) return;
      if (!map.has(d.driver_id)) {
        map.set(d.driver_id, {
          driver_id: d.driver_id,
          name: driverNames.get(d.driver_id) ?? 'Unknown Driver',
          total: 0, completed: 0, cancelled: 0,
          avg_rating: 0, avg_duration_min: null,
          completion_rate: 0, total_distance: 0,
        });
      }
      const s = map.get(d.driver_id)!;
      s.total++;
      if (d.status === 'delivered') s.completed++;
      if (d.status === 'cancelled' || d.status === 'failed') s.cancelled++;
      if (d.distance_km) s.total_distance += d.distance_km;
    });

    map.forEach((s, dId) => {
      const driverDeliveries = deliveries.filter(d => d.driver_id === dId);
      const rated = driverDeliveries.filter(d => d.customer_rating != null);
      s.avg_rating = rated.length > 0
        ? rated.reduce((acc, d) => acc + d.customer_rating!, 0) / rated.length
        : 0;

      const timed = driverDeliveries.filter(d => d.status === 'delivered' && d.completed_at);
      s.avg_duration_min = timed.length > 0
        ? timed.reduce((acc, d) => acc + (new Date(d.completed_at!).getTime() - new Date(d.created_at).getTime()) / 60000, 0) / timed.length
        : null;

      s.completion_rate = s.total > 0 ? (s.completed / s.total) * 100 : 0;
    });

    return Array.from(map.values()).sort((a, b) => b.completed - a.completed);
  }, [deliveries, driverNames]);

  // ── Rating distribution ──
  const ratingDist = useMemo(() => {
    return [1, 2, 3, 4, 5].map(star => ({
      star: `${star}★`,
      count: deliveries.filter(d => d.customer_rating === star).length,
      fill: star >= 4 ? '#10b981' : star === 3 ? '#f59e0b' : '#ef4444',
    }));
  }, [deliveries]);

  // ── Peak hours (0-23) ──
  const peakHoursData = useMemo(() => {
    const counts = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}:00`, count: 0 }));
    deliveries.forEach(d => {
      const h = new Date(d.created_at).getHours();
      counts[h].count++;
    });
    return counts;
  }, [deliveries]);

  // ── Weekday heatmap ──
  const weekdayData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const counts = days.map(day => ({ day, Delivered: 0, Cancelled: 0, Total: 0 }));
    deliveries.forEach(d => {
      const idx = new Date(d.created_at).getDay();
      counts[idx].Total++;
      if (d.status === 'delivered') counts[idx].Delivered++;
      else if (d.status === 'cancelled' || d.status === 'failed') counts[idx].Cancelled++;
    });
    return counts;
  }, [deliveries]);

  // ── Cumulative spend over time ──
  const cumulativeSpendData = useMemo(() => {
    const sorted = [...deliveries].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    let cumulative = 0;
    return sorted.map(d => {
      cumulative += d.total_amount ?? d.total_price ?? 0;
      return {
        date: new Date(d.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
        spend: Math.round(cumulative * 100) / 100,
      };
    });
  }, [deliveries]);

  // ── Payment method breakdown ──
  const paymentData = useMemo(() => {
    const counts: Record<string, number> = {};
    deliveries.forEach(d => {
      const m = d.payment_method ?? 'unknown';
      counts[m] = (counts[m] ?? 0) + 1;
    });
    const labels: Record<string, string> = {
      credit_card: 'Credit Card', maya_wallet: 'Maya Wallet',
      qr_ph: 'QR Ph', cash: 'Cash on Delivery', unknown: 'Unknown',
    };
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#9ca3af'];
    return Object.entries(counts).map(([key, value], i) => ({
      name: labels[key] ?? key,
      value,
      fill: colors[i % colors.length],
    }));
  }, [deliveries]);

  // ── Distance distribution buckets ──
  const distanceData = useMemo(() => {
    const buckets = [
      { range: '0-3 km', min: 0, max: 3, count: 0 },
      { range: '3-7 km', min: 3, max: 7, count: 0 },
      { range: '7-15 km', min: 7, max: 15, count: 0 },
      { range: '15-30 km', min: 15, max: 30, count: 0 },
      { range: '30+ km', min: 30, max: Infinity, count: 0 },
    ];
    deliveries.forEach(d => {
      if (d.distance_km == null) return;
      const b = buckets.find(b => d.distance_km! >= b.min && d.distance_km! < b.max);
      if (b) b.count++;
    });
    return buckets;
  }, [deliveries]);

  // ── CSV export ──
  const handleExportCsv = () => {
    setExportingCsv(true);
    const { label } = getPeriodRange(period);
    const headers = ['Tracking ID', 'Status', 'Date', 'Driver', 'Distance (km)', 'Amount (PHP)', 'Customer Rating', 'Duration (min)', 'Payment Method'];
    const rows = deliveries.map(d => [
      d.id,
      d.status,
      new Date(d.created_at).toLocaleDateString('en-PH'),
      d.driver_id ? (driverNames.get(d.driver_id) ?? d.driver_id) : '',
      d.distance_km?.toFixed(2) ?? '',
      (d.total_amount ?? d.total_price ?? 0).toFixed(2),
      d.customer_rating ?? '',
      d.completed_at
        ? ((new Date(d.completed_at).getTime() - new Date(d.created_at).getTime()) / 60000).toFixed(0)
        : '',
      d.payment_method ?? '',
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `deliveries-report-${label.replace(/\s/g, '-').toLowerCase()}.csv`;
    a.click(); URL.revokeObjectURL(url);
    setExportingCsv(false);
  };

  // ── PDF export ──
  const handleExportPdf = async () => {
    if (!reportRef.current) return;
    setExportingPdf(true);
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ]);
      const { label } = getPeriodRange(period);
      const el = reportRef.current;
      const canvas = await html2canvas(el, {
        scale: 1.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png');
      const pageW = 210; // A4 mm
      const pageH = 297;
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      let yPos = 0;
      let remaining = imgH;
      let pageNum = 0;
      while (remaining > 0) {
        if (pageNum > 0) pdf.addPage();
        const sliceH = Math.min(pageH, remaining);
        pdf.addImage(imgData, 'PNG', 0, -yPos, imgW, imgH);
        yPos += pageH;
        remaining -= sliceH;
        pageNum++;
      }
      pdf.save(`swiftdash-report-${label.replace(/\s/g, '-').toLowerCase()}.pdf`);
    } finally {
      setExportingPdf(false);
    }
  };

  // ── Loading state ─────────────────────────────────────────────────────────

  const { label: periodLabel } = getPeriodRange(period);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalTrend = trend(kpis.total, kpis.prevTotal);
  const revenueTrend = trend(kpis.revenue, kpis.prevRevenue);
  const rateTrend = trend(kpis.completionRate, kpis.prevCompletionRate);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Reports & Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {periodLabel} · {deliveries.length} deliveries
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
          <Button
            variant="outline" size="sm"
            onClick={handleExportCsv}
            disabled={exportingCsv || deliveries.length === 0}
          >
            {exportingCsv
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Download className="h-4 w-4" />}
            <span className="ml-1.5">CSV</span>
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={handleExportPdf}
            disabled={exportingPdf || deliveries.length === 0}
          >
            {exportingPdf
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <FileText className="h-4 w-4" />}
            <span className="ml-1.5">PDF</span>
          </Button>
        </div>
      </div>

      {/* ── Printable report area ── */}
      <div ref={reportRef} className="space-y-6 bg-background">

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground">Total Deliveries</p>
              <Package className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{kpis.total}</p>
            <div className={`flex items-center gap-1 mt-1 text-xs ${totalTrend.up ? 'text-green-600' : 'text-red-500'}`}>
              {totalTrend.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {kpis.prevTotal > 0 ? `${totalTrend.pct.toFixed(1)}% vs prev` : 'No prior data'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground">Completion Rate</p>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{kpis.completionRate.toFixed(1)}%</p>
            <div className={`flex items-center gap-1 mt-1 text-xs ${rateTrend.up ? 'text-green-600' : 'text-red-500'}`}>
              {rateTrend.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {kpis.prevCompletionRate > 0 ? `${rateTrend.pct.toFixed(1)}% vs prev` : 'No prior data'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground">Total Spend</p>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{fmtCurrency(kpis.revenue)}</p>
            <div className={`flex items-center gap-1 mt-1 text-xs ${revenueTrend.up ? 'text-green-600' : 'text-red-500'}`}>
              {revenueTrend.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {kpis.prevRevenue > 0 ? `${revenueTrend.pct.toFixed(1)}% vs prev` : 'No prior data'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground">Avg Rating</p>
              <Star className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">
              {kpis.avgRating > 0 ? kpis.avgRating.toFixed(1) : '—'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {kpis.ratingCount} rating{kpis.ratingCount !== 1 ? 's' : ''} submitted
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground">Avg Order Value</p>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">
              {kpis.avgOrderValue > 0 ? fmtCurrency(kpis.avgOrderValue) : '—'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">per completed delivery</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground">Avg Duration</p>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">
              {kpis.avgDuration != null ? fmtDuration(kpis.avgDuration) : '—'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">placed → delivered</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground">Completed</p>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-green-600">{kpis.completed}</p>
            <p className="text-xs text-muted-foreground mt-1">successfully delivered</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground">Cancelled / Failed</p>
              <XCircle className="h-4 w-4 text-red-500" />
            </div>
            <p className="text-2xl font-bold text-red-500">{kpis.cancelled}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {kpis.total > 0 ? ((kpis.cancelled / kpis.total) * 100).toFixed(1) : 0}% of total
            </p>
          </CardContent>
        </Card>

      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Delivery Volume bar chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Delivery Volume</CardTitle>
            <CardDescription className="text-xs">Daily breakdown · {periodLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            {deliveries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[220px] text-muted-foreground">
                <BarChart3 className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">No deliveries in this period</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={volumeData}
                  margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
                  barSize={period === 'today' ? 40 : period === 'quarter' ? 4 : 12}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    interval={period === 'quarter' ? 13 : period === 'month' ? 6 : 0}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="Delivered" fill="#10b981" stackId="a" />
                  <Bar dataKey="Pending" fill="#f59e0b" stackId="a" />
                  <Bar dataKey="Cancelled" fill="#ef4444" stackId="a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
            <div className="flex items-center gap-4 mt-2 justify-center">
              {([['#10b981', 'Delivered'], ['#f59e0b', 'Pending/Active'], ['#ef4444', 'Cancelled']] as [string, string][]).map(([color, label]) => (
                <div key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                  {label}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Status Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Status Breakdown</CardTitle>
            <CardDescription className="text-xs">{deliveries.length} total deliveries</CardDescription>
          </CardHeader>
          <CardContent>
            {statusData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[220px] text-muted-foreground">
                <AlertCircle className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">No data</p>
              </div>
            ) : (
              <div className="space-y-2.5 mt-1">
                {statusData.sort((a, b) => b.value - a.value).map(item => (
                  <div key={item.name}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-muted-foreground">
                        {item.value} ({deliveries.length > 0 ? ((item.value / deliveries.length) * 100).toFixed(0) : 0}%)
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full transition-all duration-500"
                        style={{
                          width: `${deliveries.length > 0 ? (item.value / deliveries.length) * 100 : 0}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* ── Rating Distribution ── */}
      {kpis.ratingCount > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Customer Rating Distribution</CardTitle>
            <CardDescription className="text-xs">
              {kpis.ratingCount} ratings · avg {kpis.avgRating.toFixed(1)}★
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={ratingDist} margin={{ top: 4, right: 8, left: -16, bottom: 0 }} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="star" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="count" name="Ratings" radius={[4, 4, 0, 0]}>
                  {ratingDist.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* ── Insights row: Peak Hours + Weekday Heatmap ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Peak Hours */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              <CardTitle className="text-sm font-semibold">Peak Order Hours</CardTitle>
            </div>
            <CardDescription className="text-xs">When orders are placed throughout the day</CardDescription>
          </CardHeader>
          <CardContent>
            {deliveries.length === 0 ? (
              <div className="flex items-center justify-center h-[160px] text-muted-foreground text-sm">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={peakHoursData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barSize={6}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="hour" tick={{ fontSize: 9 }} tickLine={false} axisLine={false}
                    interval={2} tickFormatter={v => v.split(':')[0]} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v) => [v, 'Orders']} />
                  <Bar dataKey="count" fill="#6366f1" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Weekday Performance */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-500" />
              <CardTitle className="text-sm font-semibold">Weekday Performance</CardTitle>
            </div>
            <CardDescription className="text-xs">Deliveries completed vs cancelled by day of week</CardDescription>
          </CardHeader>
          <CardContent>
            {deliveries.length === 0 ? (
              <div className="flex items-center justify-center h-[160px] text-muted-foreground text-sm">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={weekdayData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Bar dataKey="Delivered" fill="#10b981" stackId="a" />
                  <Bar dataKey="Cancelled" fill="#ef4444" stackId="a" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

      </div>

      {/* ── Insights row: Cumulative Spend + Payment Methods + Distance ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Cumulative Spend */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <CardTitle className="text-sm font-semibold">Cumulative Spend</CardTitle>
            </div>
            <CardDescription className="text-xs">Running total spend across the period (₱)</CardDescription>
          </CardHeader>
          <CardContent>
            {cumulativeSpendData.length === 0 ? (
              <div className="flex items-center justify-center h-[160px] text-muted-foreground text-sm">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={cumulativeSpendData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} tickLine={false} axisLine={false}
                    interval={Math.floor(cumulativeSpendData.length / 6)} />
                  <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false}
                    tickFormatter={v => `₱${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }}
                    formatter={(v: number) => [fmtCurrency(v), 'Total Spend']} />
                  <Area type="monotone" dataKey="spend" stroke="#10b981" strokeWidth={2}
                    fill="url(#spendGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-indigo-500" />
              <CardTitle className="text-sm font-semibold">Payment Methods</CardTitle>
            </div>
            <CardDescription className="text-xs">How orders are paid</CardDescription>
          </CardHeader>
          <CardContent>
            {paymentData.length === 0 ? (
              <div className="flex items-center justify-center h-[160px] text-muted-foreground text-sm">No data</div>
            ) : (
              <div className="space-y-2.5 mt-2">
                {paymentData.sort((a, b) => b.value - a.value).map(item => (
                  <div key={item.name}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-muted-foreground">
                        {item.value} ({deliveries.length > 0 ? ((item.value / deliveries.length) * 100).toFixed(0) : 0}%)
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div className="h-1.5 rounded-full transition-all duration-500"
                        style={{
                          width: `${deliveries.length > 0 ? (item.value / deliveries.length) * 100 : 0}%`,
                          backgroundColor: item.fill,
                        }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* ── Distance Distribution ── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-rose-500" />
            <CardTitle className="text-sm font-semibold">Delivery Distance Distribution</CardTitle>
          </div>
          <CardDescription className="text-xs">How far deliveries travel</CardDescription>
        </CardHeader>
        <CardContent>
          {deliveries.filter(d => d.distance_km != null).length === 0 ? (
            <div className="flex items-center justify-center h-[120px] text-muted-foreground text-sm">No distance data</div>
          ) : (
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={distanceData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }} barSize={36}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="range" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v) => [v, 'Deliveries']} />
                <Bar dataKey="count" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* ── Driver Performance ── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Driver Performance</h2>
          <Badge variant="outline" className="text-xs">
            {driverStats.length} driver{driverStats.length !== 1 ? 's' : ''}
          </Badge>
        </div>

        {driverStats.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Truck className="h-10 w-10 mb-3 opacity-40" />
              <p>No driver data for this period</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {driverStats.map((driver, idx) => (
              <Card
                key={driver.driver_id}
                className={idx === 0 ? 'border-yellow-400 dark:border-yellow-600' : ''}
              >
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
                        <p className="font-semibold text-sm truncate">{driver.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {driver.total_distance.toFixed(1)} km driven
                        </p>
                      </div>
                    </div>

                    {/* Stats grid */}
                    <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">

                      <div className="text-center sm:text-left">
                        <p className="text-xs text-muted-foreground">Deliveries</p>
                        <p className="font-semibold">
                          {driver.completed}{' '}
                          <span className="text-xs text-muted-foreground">/ {driver.total}</span>
                        </p>
                      </div>

                      <div className="text-center sm:text-left">
                        <p className="text-xs text-muted-foreground">Completion</p>
                        <div className="flex items-center gap-1.5">
                          <span className={`font-semibold text-sm ${
                            driver.completion_rate >= 90 ? 'text-green-600'
                            : driver.completion_rate >= 70 ? 'text-yellow-600'
                            : 'text-red-500'}`}
                          >
                            {driver.completion_rate.toFixed(0)}%
                          </span>
                          <div className="flex-1 bg-muted rounded-full h-1.5 hidden sm:block">
                            <div
                              className="h-1.5 rounded-full"
                              style={{
                                width: `${driver.completion_rate}%`,
                                backgroundColor:
                                  driver.completion_rate >= 90 ? '#10b981'
                                  : driver.completion_rate >= 70 ? '#f59e0b'
                                  : '#ef4444',
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="text-center sm:text-left">
                        <p className="text-xs text-muted-foreground">Avg Rating</p>
                        <div className="flex items-center gap-1">
                          <Star className={`h-3.5 w-3.5 ${
                            driver.avg_rating >= 4 ? 'text-yellow-500'
                            : driver.avg_rating >= 3 ? 'text-orange-400'
                            : 'text-red-400'}`}
                          />
                          <span className="font-semibold text-sm">
                            {driver.avg_rating > 0 ? driver.avg_rating.toFixed(1) : '—'}
                          </span>
                        </div>
                      </div>

                      <div className="text-center sm:text-left">
                        <p className="text-xs text-muted-foreground">Avg Duration</p>
                        <p className="font-semibold text-sm">
                          {driver.avg_duration_min != null
                            ? fmtDuration(driver.avg_duration_min)
                            : '—'}
                        </p>
                      </div>

                    </div>

                    {/* Cancelled badge */}
                    {driver.cancelled > 0 && (
                      <Badge variant="outline" className="text-xs border-red-300 text-red-600 shrink-0">
                        {driver.cancelled} cancelled
                      </Badge>
                    )}

                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      </div> {/* end reportRef */}
    </div>
  );
}
