'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserContext } from '@/lib/supabase/user-context';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DollarSign, Loader2, Users, TrendingUp, Wallet,
  ArrowUpRight, ArrowDownRight, Truck, Star, RefreshCw,
  CreditCard, Banknote, AlertCircle, CheckCircle2, Clock,
  Download,
} from 'lucide-react';
import dynamic from 'next/dynamic';

/* eslint-disable @typescript-eslint/no-explicit-any */
const BarChart = dynamic(() => import('recharts').then(m => m.BarChart) as any, { ssr: false }) as any;
const Bar = dynamic(() => import('recharts').then(m => m.Bar) as any, { ssr: false }) as any;
const AreaChart = dynamic(() => import('recharts').then(m => m.AreaChart) as any, { ssr: false }) as any;
const Area = dynamic(() => import('recharts').then(m => m.Area) as any, { ssr: false }) as any;
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis) as any, { ssr: false }) as any;
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis) as any, { ssr: false }) as any;
const CartesianGrid = dynamic(() => import('recharts').then(m => m.CartesianGrid) as any, { ssr: false }) as any;
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip) as any, { ssr: false }) as any;
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer) as any, { ssr: false }) as any;

type Period = 'today' | 'week' | 'month' | 'last_month' | 'quarter';

interface DriverEarning {
  id: string;
  driver_id: string;
  delivery_id: string;
  base_earnings: number;
  distance_earnings: number;
  surge_earnings: number;
  tips: number;
  total_earnings: number;
  platform_commission: number;
  driver_net_earnings: number;
  payment_method: string;
  earnings_status: string;
  payout_status: string;
  remittance_status: string;
  earnings_date: string;
  created_at: string;
}

interface DriverSummary {
  driver_id: string;
  driver_name: string;
  total_earnings: number;
  total_commission: number;
  net_earnings: number;
  deliveries_count: number;
  tips: number;
  cash_collected: number;
  pending_remittance: number;
  is_online: boolean;
}

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

export default function DriverEarningsPage() {
  const supabase = createClient();
  const { businessId, loading: userLoading } = useUserContext();
  const { toast } = useToast();

  const [period, setPeriod] = useState<Period>('month');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [earnings, setEarnings] = useState<DriverEarning[]>([]);
  const [driverNames, setDriverNames] = useState<Map<string, string>>(new Map());
  const [driverOnline, setDriverOnline] = useState<Map<string, boolean>>(new Map());
  const [cashBalances, setCashBalances] = useState<Map<string, any>>(new Map());
  const [selectedDriver, setSelectedDriver] = useState<string>('all');
  const [tab, setTab] = useState('summary');

  const fetchData = async (showLoader = true) => {
    if (!businessId) return;
    if (showLoader) setLoading(true);
    else setRefreshing(true);

    try {
      const { start, end } = getPeriodRange(period);

      // Get business fleet driver IDs
      const { data: fleetDrivers } = await supabase
        .from('driver_profiles')
        .select('id, is_online')
        .eq('managed_by_business_id', businessId);

      const driverIds = (fleetDrivers || []).map((d: any) => d.id);
      const onlineMap = new Map<string, boolean>();
      (fleetDrivers || []).forEach((d: any) => onlineMap.set(d.id, d.is_online));
      setDriverOnline(onlineMap);

      if (driverIds.length === 0) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Parallel: earnings, driver names, cash balances
      const [earningsRes, namesRes, balancesRes] = await Promise.all([
        supabase
          .from('driver_earnings')
          .select('*')
          .in('driver_id', driverIds)
          .gte('created_at', start.toISOString())
          .lt('created_at', end.toISOString())
          .order('created_at', { ascending: false }),
        supabase
          .from('user_profiles')
          .select('id, first_name, last_name')
          .in('id', driverIds),
        supabase
          .from('driver_cash_balances')
          .select('*')
          .in('driver_id', driverIds),
      ]);

      setEarnings((earningsRes.data || []) as DriverEarning[]);

      const nameMap = new Map<string, string>();
      (namesRes.data || []).forEach((p: any) => nameMap.set(p.id, `${p.first_name} ${p.last_name}`));
      setDriverNames(nameMap);

      const balanceMap = new Map<string, any>();
      (balancesRes.data || []).forEach((b: any) => balanceMap.set(b.driver_id, b));
      setCashBalances(balanceMap);
    } catch (err) {
      console.error('Earnings fetch error:', err);
      toast({ title: 'Error', description: 'Failed to load earnings data', variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (businessId) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, period]);

  // ─── Computed ─────────────────────────────────────────────────────────

  const filteredEarnings = useMemo(() => {
    if (selectedDriver === 'all') return earnings;
    return earnings.filter(e => e.driver_id === selectedDriver);
  }, [earnings, selectedDriver]);

  const driverSummaries = useMemo((): DriverSummary[] => {
    const map = new Map<string, DriverSummary>();

    earnings.forEach(e => {
      if (!map.has(e.driver_id)) {
        map.set(e.driver_id, {
          driver_id: e.driver_id,
          driver_name: driverNames.get(e.driver_id) || 'Unknown Driver',
          total_earnings: 0,
          total_commission: 0,
          net_earnings: 0,
          deliveries_count: 0,
          tips: 0,
          cash_collected: 0,
          pending_remittance: 0,
          is_online: driverOnline.get(e.driver_id) || false,
        });
      }
      const s = map.get(e.driver_id)!;
      s.total_earnings += Number(e.total_earnings || 0);
      s.total_commission += Number(e.platform_commission || 0);
      s.net_earnings += Number(e.driver_net_earnings || e.total_earnings || 0);
      s.tips += Number(e.tips || 0);
      s.deliveries_count++;
      if (e.payment_method === 'cash') {
        s.cash_collected += Number(e.total_earnings || 0);
      }
    });

    // Add pending remittance from cash balances
    map.forEach((s, driverId) => {
      const bal = cashBalances.get(driverId);
      if (bal) {
        s.pending_remittance = Number(bal.pending_remittance || 0) + Number(bal.overdue_amount || 0);
      }
    });

    return Array.from(map.values()).sort((a, b) => b.total_earnings - a.total_earnings);
  }, [earnings, driverNames, driverOnline, cashBalances]);

  const totals = useMemo(() => {
    const data = filteredEarnings;
    return {
      grossEarnings: data.reduce((s, e) => s + Number(e.total_earnings || 0), 0),
      commission: data.reduce((s, e) => s + Number(e.platform_commission || 0), 0),
      netPayout: data.reduce((s, e) => s + Number(e.driver_net_earnings || e.total_earnings || 0), 0),
      tips: data.reduce((s, e) => s + Number(e.tips || 0), 0),
      deliveries: data.length,
      pending: data.filter(e => e.payout_status === 'pending').length,
      paid: data.filter(e => e.payout_status === 'paid' || e.payout_status === 'completed').length,
    };
  }, [filteredEarnings]);

  // Daily earnings chart data
  const dailyEarnings = useMemo(() => {
    const { start, end } = getPeriodRange(period);
    const days = Math.ceil((end.getTime() - start.getTime()) / 86_400_000);
    const buckets = new Map<string, { date: string; earnings: number; commission: number; net: number; count: number }>();

    for (let i = 0; i < days; i++) {
      const d = new Date(start.getTime() + i * 86_400_000);
      const key = d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
      buckets.set(key, { date: key, earnings: 0, commission: 0, net: 0, count: 0 });
    }

    filteredEarnings.forEach(e => {
      const key = new Date(e.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.earnings += Number(e.total_earnings || 0);
        bucket.commission += Number(e.platform_commission || 0);
        bucket.net += Number(e.driver_net_earnings || e.total_earnings || 0);
        bucket.count++;
      }
    });

    return Array.from(buckets.values());
  }, [filteredEarnings, period]);

  const handleExportCsv = () => {
    const { label } = getPeriodRange(period);
    const headers = ['Date', 'Driver', 'Delivery ID', 'Gross Earnings', 'Commission', 'Net Earnings', 'Tips', 'Payment Method', 'Status'];
    const rows = filteredEarnings.map(e => [
      new Date(e.created_at).toLocaleDateString('en-PH'),
      driverNames.get(e.driver_id) || e.driver_id,
      e.delivery_id,
      Number(e.total_earnings || 0).toFixed(2),
      Number(e.platform_commission || 0).toFixed(2),
      Number(e.driver_net_earnings || 0).toFixed(2),
      Number(e.tips || 0).toFixed(2),
      e.payment_method || 'N/A',
      e.payout_status || e.earnings_status || 'pending',
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `driver-earnings-${label.replace(/\s/g, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const { label: periodLabel } = getPeriodRange(period);

  // ─── Render ───────────────────────────────────────────────────────────

  if (loading || userLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-6 w-6" />
            Driver Earnings
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {periodLabel} · {driverSummaries.length} drivers · {totals.deliveries} deliveries
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedDriver} onValueChange={setSelectedDriver}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All Drivers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Drivers</SelectItem>
              {driverSummaries.map(d => (
                <SelectItem key={d.driver_id} value={d.driver_id}>{d.driver_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <Button variant="outline" size="sm" onClick={() => fetchData(false)} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={filteredEarnings.length === 0}>
            <Download className="h-4 w-4" />
            <span className="ml-1.5">CSV</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground">Gross Earnings</p>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{fmtCurrency(totals.grossEarnings)}</p>
            <p className="text-xs text-muted-foreground mt-1">{totals.deliveries} deliveries</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground">Platform Commission</p>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold text-orange-600">{fmtCurrency(totals.commission)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {totals.grossEarnings > 0 ? ((totals.commission / totals.grossEarnings) * 100).toFixed(1) : 0}% commission rate
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground">Net Driver Payout</p>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold text-green-600">{fmtCurrency(totals.netPayout)}</p>
            <p className="text-xs text-muted-foreground mt-1">after commission</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground">Tips</p>
              <Star className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{fmtCurrency(totals.tips)}</p>
            <p className="text-xs text-muted-foreground mt-1">100% goes to drivers</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="summary">Driver Summary</TabsTrigger>
          <TabsTrigger value="chart">Earnings Chart</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="cash">Cash Balances</TabsTrigger>
        </TabsList>

        {/* ═══ SUMMARY TAB ═══ */}
        <TabsContent value="summary" className="mt-4">
          {driverSummaries.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Truck className="h-10 w-10 mb-3 opacity-40" />
                <p>No earnings data for this period</p>
                <p className="text-xs mt-1">Earnings are recorded when deliveries are completed.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead className="text-right">Deliveries</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Commission</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead className="text-right">Tips</TableHead>
                    <TableHead className="text-right">Pending Cash</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {driverSummaries.map((d, idx) => (
                    <TableRow key={d.driver_id} className={idx === 0 ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : ''}>
                      <TableCell className="font-bold text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{d.driver_name}</span>
                          {d.is_online && <Badge className="bg-green-100 text-green-700 text-[10px]">Online</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">{d.deliveries_count}</TableCell>
                      <TableCell className="text-right font-medium">{fmtCurrency(d.total_earnings)}</TableCell>
                      <TableCell className="text-right text-orange-600">{fmtCurrency(d.total_commission)}</TableCell>
                      <TableCell className="text-right font-semibold text-green-600">{fmtCurrency(d.net_earnings)}</TableCell>
                      <TableCell className="text-right">{fmtCurrency(d.tips)}</TableCell>
                      <TableCell className="text-right">
                        {d.pending_remittance > 0 ? (
                          <span className="text-orange-600 font-medium">{fmtCurrency(d.pending_remittance)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {d.pending_remittance > 500 ? (
                          <Badge variant="destructive" className="text-[10px]">Remit Due</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">Current</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ═══ CHART TAB ═══ */}
        <TabsContent value="chart" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Daily Earnings Trend</CardTitle>
              <CardDescription className="text-xs">Gross earnings vs platform commission</CardDescription>
            </CardHeader>
            <CardContent>
              {dailyEarnings.every(d => d.earnings === 0) ? (
                <div className="flex flex-col items-center justify-center h-[220px] text-muted-foreground">
                  <DollarSign className="h-8 w-8 mb-2 opacity-40" />
                  <p className="text-sm">No earnings data for this period</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={dailyEarnings} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="earnGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="commGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} tickLine={false} axisLine={false}
                      interval={Math.max(1, Math.floor(dailyEarnings.length / 7))} />
                    <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false}
                      tickFormatter={(v: any) => `₱${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }}
                      formatter={(v: any, name: any) => [fmtCurrency(v), name === 'net' ? 'Net Payout' : name === 'earnings' ? 'Gross' : 'Commission']} />
                    <Area type="monotone" dataKey="earnings" stroke="#10b981" strokeWidth={2}
                      fill="url(#earnGrad)" name="earnings" />
                    <Area type="monotone" dataKey="commission" stroke="#f97316" strokeWidth={1.5}
                      fill="url(#commGrad)" name="commission" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
              <div className="flex items-center gap-4 mt-2 justify-center">
                {([['#10b981', 'Gross Earnings'], ['#f97316', 'Commission']] as [string, string][]).map(([color, label]) => (
                  <div key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                    {label}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ TRANSACTIONS TAB ═══ */}
        <TabsContent value="transactions" className="mt-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead className="text-right">Tips</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEarnings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No earnings transactions for this period
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEarnings.map(e => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs">
                        {new Date(e.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                      </TableCell>
                      <TableCell className="text-sm">{driverNames.get(e.driver_id) || 'Unknown'}</TableCell>
                      <TableCell className="text-right text-sm">{fmtCurrency(Number(e.total_earnings || 0))}</TableCell>
                      <TableCell className="text-right text-sm text-orange-600">{fmtCurrency(Number(e.platform_commission || 0))}</TableCell>
                      <TableCell className="text-right text-sm font-medium text-green-600">
                        {fmtCurrency(Number(e.driver_net_earnings || e.total_earnings || 0))}
                      </TableCell>
                      <TableCell className="text-right text-sm">{fmtCurrency(Number(e.tips || 0))}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {e.payment_method === 'cash' ? '💵 Cash' : e.payment_method === 'maya' ? '💳 Maya' : e.payment_method || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={e.payout_status === 'paid' || e.payout_status === 'completed' ? 'default' : 'secondary'}
                          className="text-[10px]"
                        >
                          {e.payout_status || e.earnings_status || 'pending'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ═══ CASH BALANCES TAB ═══ */}
        <TabsContent value="cash" className="mt-4">
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Banknote className="h-4 w-4 text-green-500" />
                <CardTitle className="text-sm font-semibold">Cash Collection & Remittance</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Track cash on hand and pending remittances from COD deliveries
              </CardDescription>
            </CardHeader>
          </Card>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Driver</TableHead>
                  <TableHead className="text-right">Cash on Hand</TableHead>
                  <TableHead className="text-right">Pending Remittance</TableHead>
                  <TableHead className="text-right">Overdue</TableHead>
                  <TableHead>Next Due</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from(cashBalances.entries()).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No cash balance records
                    </TableCell>
                  </TableRow>
                ) : (
                  Array.from(cashBalances.entries()).map(([driverId, bal]) => (
                    <TableRow key={driverId}>
                      <TableCell className="font-medium text-sm">{driverNames.get(driverId) || 'Unknown'}</TableCell>
                      <TableCell className="text-right">{fmtCurrency(Number(bal.total_cash_on_hand || 0))}</TableCell>
                      <TableCell className="text-right text-orange-600 font-medium">
                        {fmtCurrency(Number(bal.pending_remittance || 0))}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(bal.overdue_amount || 0) > 0 ? (
                          <span className="text-red-600 font-bold">{fmtCurrency(Number(bal.overdue_amount))}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {bal.next_remittance_due
                          ? new Date(bal.next_remittance_due).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
                          : '—'}
                      </TableCell>
                      <TableCell>
                        {bal.is_suspended ? (
                          <Badge variant="destructive" className="text-[10px]">Suspended</Badge>
                        ) : bal.remittance_status === 'overdue' ? (
                          <Badge variant="destructive" className="text-[10px]">Overdue</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">{bal.remittance_status || 'Current'}</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
