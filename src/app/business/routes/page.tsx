'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserContext } from '@/lib/supabase/user-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  MapPin,
  Navigation,
  Search,
  RefreshCw,
  Loader2,
  Route,
  ArrowRight,
  TrendingUp,
  Zap,
  Timer,
  Ruler,
  BarChart3,
  Plus,
  Package,
} from 'lucide-react';

interface RouteRecord {
  id: string;
  tracking_number: string;
  pickup_address: string;
  delivery_address: string;
  distance_km: number;
  estimated_duration: number;
  status: string;
  created_at: string;
  delivery_type: string;
  dropoff_stops?: any[];
}

interface RouteStats {
  totalRoutes: number;
  avgDistanceKm: number;
  avgDurationMin: number;
  totalDistanceKm: number;
  shortestKm: number;
  longestKm: number;
  frequentPickups: { address: string; count: number }[];
  frequentDropoffs: { address: string; count: number }[];
}

export default function RoutesPage() {
  const supabase = createClient();
  const { businessId, loading: userLoading } = useUserContext();
  const [routes, setRoutes] = useState<RouteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [showOptimizeModal, setShowOptimizeModal] = useState(false);
  const [optimizeAddresses, setOptimizeAddresses] = useState<string[]>(['', '']);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizedResult, setOptimizedResult] = useState<any>(null);

  useEffect(() => {
    if (!userLoading && businessId) {
      fetchRoutes();
    }
  }, [userLoading, businessId]);

  const fetchRoutes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('deliveries')
        .select('id, tracking_number, pickup_address, delivery_address, distance_km, estimated_duration, status, created_at, delivery_type, dropoff_stops')
        .eq('business_id', businessId)
        .not('distance_km', 'is', null)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      setRoutes(data || []);
    } catch (err) {
      console.error('Error fetching routes:', err);
    } finally {
      setLoading(false);
    }
  };

  const stats: RouteStats = useMemo(() => {
    const withDistance = routes.filter(r => r.distance_km && r.distance_km > 0);
    const distances = withDistance.map(r => r.distance_km);
    const durations = withDistance.filter(r => r.estimated_duration).map(r => r.estimated_duration);

    const pickupCounts: Record<string, number> = {};
    const dropoffCounts: Record<string, number> = {};
    routes.forEach(r => {
      if (r.pickup_address) {
        const short = r.pickup_address.split(',').slice(0, 2).join(',').trim();
        pickupCounts[short] = (pickupCounts[short] || 0) + 1;
      }
      if (r.delivery_address) {
        const short = r.delivery_address.split(',').slice(0, 2).join(',').trim();
        dropoffCounts[short] = (dropoffCounts[short] || 0) + 1;
      }
    });

    const sortByCount = (obj: Record<string, number>) =>
      Object.entries(obj)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([address, count]) => ({ address, count }));

    return {
      totalRoutes: withDistance.length,
      avgDistanceKm: distances.length ? distances.reduce((a, b) => a + b, 0) / distances.length : 0,
      avgDurationMin: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      totalDistanceKm: distances.reduce((a, b) => a + b, 0),
      shortestKm: distances.length ? Math.min(...distances) : 0,
      longestKm: distances.length ? Math.max(...distances) : 0,
      frequentPickups: sortByCount(pickupCounts),
      frequentDropoffs: sortByCount(dropoffCounts),
    };
  }, [routes]);

  const filteredRoutes = useMemo(() => {
    if (!searchQuery) return routes;
    const q = searchQuery.toLowerCase();
    return routes.filter(
      r =>
        r.tracking_number?.toLowerCase().includes(q) ||
        r.pickup_address?.toLowerCase().includes(q) ||
        r.delivery_address?.toLowerCase().includes(q)
    );
  }, [routes, searchQuery]);

  const handleOptimizeRoute = async () => {
    const addresses = optimizeAddresses.filter(a => a.trim());
    if (addresses.length < 2) {
      alert('Enter at least 2 addresses to optimize');
      return;
    }
    try {
      setOptimizing(true);
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      const coords: { lat: number; lng: number; address: string }[] = [];

      for (const addr of addresses) {
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addr)}&key=${apiKey}`
        );
        const data = await res.json();
        if (data.status === 'OK' && data.results?.length > 0) {
          const loc = data.results[0].geometry.location;
          coords.push({ lat: loc.lat, lng: loc.lng, address: addr });
        } else {
          alert(`Could not geocode: ${addr}`);
          setOptimizing(false);
          return;
        }
      }

      const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
      const coordStr = coords.map(c => `${c.lng},${c.lat}`).join(';');
      const url = `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coordStr}?source=first&destination=last&roundtrip=false&geometries=geojson&overview=full&access_token=${mapboxToken}`;

      const routeRes = await fetch(url);
      const routeData = await routeRes.json();

      if (routeData.trips && routeData.trips.length > 0) {
        const trip = routeData.trips[0];
        const waypoints = routeData.waypoints;
        setOptimizedResult({
          distance: (trip.distance / 1000).toFixed(1),
          duration: Math.round(trip.duration / 60),
          optimizedOrder: waypoints.map((w: any) => ({
            index: w.waypoint_index,
            address: coords[w.waypoint_index]?.address || `Stop ${w.waypoint_index + 1}`,
          })),
          originalOrder: coords.map((c, i) => ({
            index: i,
            address: c.address,
          })),
        });
      } else {
        alert('Could not find optimized route. Check addresses.');
      }
    } catch (err) {
      console.error('Optimization error:', err);
      alert('Route optimization failed');
    } finally {
      setOptimizing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'in_transit':
      case 'going_to_pickup':
      case 'package_collected':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  if (loading || userLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading route data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Routes</h1>
          <p className="text-muted-foreground mt-2">
            Analyze delivery routes, optimize multi-stop trips, and view route analytics
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchRoutes}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => { setOptimizedResult(null); setShowOptimizeModal(true); }}>
            <Zap className="h-4 w-4 mr-2" />
            Optimize Route
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Routes</CardTitle>
            <Route className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRoutes}</div>
            <p className="text-xs text-muted-foreground mt-1">With distance data</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Distance</CardTitle>
            <Ruler className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgDistanceKm.toFixed(1)} km</div>
            <p className="text-xs text-muted-foreground mt-1">Per delivery</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Timer className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgDurationMin.toFixed(0)} min</div>
            <p className="text-xs text-muted-foreground mt-1">Per delivery</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Distance</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDistanceKm.toFixed(0)} km</div>
            <p className="text-xs text-muted-foreground mt-1">All deliveries</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Range</CardTitle>
            <Ruler className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.shortestKm.toFixed(1)} – {stats.longestKm.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground mt-1">Shortest → Longest (km)</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Route History</TabsTrigger>
          <TabsTrigger value="hotspots">Hotspots & Lanes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Delivery Routes</CardTitle>
                  <CardDescription>All routes with distance and duration data</CardDescription>
                </div>
              </div>
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by tracking #, pickup, or dropoff..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tracking #</TableHead>
                    <TableHead>Pickup</TableHead>
                    <TableHead>Dropoff</TableHead>
                    <TableHead>Distance</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRoutes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        <Route className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No routes found</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRoutes.slice(0, 50).map(route => (
                      <TableRow key={route.id}>
                        <TableCell className="font-mono font-medium text-sm">
                          {route.tracking_number}
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate text-sm">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-green-600 flex-shrink-0" />
                            {route.pickup_address}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate text-sm">
                          <div className="flex items-center gap-1">
                            <Navigation className="h-3 w-3 text-red-600 flex-shrink-0" />
                            {route.delivery_address}
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">{route.distance_km?.toFixed(1)} km</TableCell>
                        <TableCell>{route.estimated_duration ? `${route.estimated_duration} min` : '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {route.delivery_type === 'multi' ? (
                              <><Package className="h-3 w-3 mr-1" />Multi</>
                            ) : 'Single'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(route.status)}`}>
                            {route.status?.replace(/_/g, ' ')}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(route.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {filteredRoutes.length > 50 && (
                <p className="text-xs text-muted-foreground text-center mt-4">
                  Showing 50 of {filteredRoutes.length} routes
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hotspots" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Frequent Pickups */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-green-500" />
                  Top Pickup Locations
                </CardTitle>
                <CardDescription>Most frequently used pickup addresses</CardDescription>
              </CardHeader>
              <CardContent>
                {stats.frequentPickups.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No data yet</p>
                ) : (
                  <div className="space-y-3">
                    {stats.frequentPickups.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 flex items-center justify-center text-xs font-bold">
                            {idx + 1}
                          </span>
                          <span className="text-sm truncate">{item.address}</span>
                        </div>
                        <Badge variant="secondary" className="flex-shrink-0">{item.count}×</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Frequent Dropoffs */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-red-500" />
                  Top Dropoff Locations
                </CardTitle>
                <CardDescription>Most frequently used delivery addresses</CardDescription>
              </CardHeader>
              <CardContent>
                {stats.frequentDropoffs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No data yet</p>
                ) : (
                  <div className="space-y-3">
                    {stats.frequentDropoffs.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 flex items-center justify-center text-xs font-bold">
                            {idx + 1}
                          </span>
                          <span className="text-sm truncate">{item.address}</span>
                        </div>
                        <Badge variant="secondary" className="flex-shrink-0">{item.count}×</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Distance Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Distance Distribution
              </CardTitle>
              <CardDescription>How your delivery distances are distributed</CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const buckets = [
                  { label: '0–2 km', min: 0, max: 2, count: 0 },
                  { label: '2–5 km', min: 2, max: 5, count: 0 },
                  { label: '5–10 km', min: 5, max: 10, count: 0 },
                  { label: '10–20 km', min: 10, max: 20, count: 0 },
                  { label: '20+ km', min: 20, max: 9999, count: 0 },
                ];
                routes.forEach(r => {
                  if (!r.distance_km) return;
                  const bucket = buckets.find(b => r.distance_km >= b.min && r.distance_km < b.max);
                  if (bucket) bucket.count++;
                });
                const maxCount = Math.max(...buckets.map(b => b.count), 1);
                return (
                  <div className="space-y-3">
                    {buckets.map((bucket, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <span className="text-sm font-medium w-20 text-right flex-shrink-0">{bucket.label}</span>
                        <div className="flex-1 bg-muted rounded-full h-6 overflow-hidden">
                          <div
                            className="h-full bg-primary/80 rounded-full flex items-center justify-end pr-2 transition-all duration-500"
                            style={{ width: `${Math.max((bucket.count / maxCount) * 100, bucket.count > 0 ? 8 : 0)}%` }}
                          >
                            {bucket.count > 0 && (
                              <span className="text-xs font-medium text-primary-foreground">{bucket.count}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Optimize Route Modal */}
      <Dialog open={showOptimizeModal} onOpenChange={setShowOptimizeModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Route Optimizer
            </DialogTitle>
            <DialogDescription>
              Enter addresses and we&apos;ll find the optimal order using Mapbox Optimization API
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {optimizeAddresses.map((addr, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                  {idx + 1}
                </span>
                <Input
                  value={addr}
                  onChange={e => {
                    const updated = [...optimizeAddresses];
                    updated[idx] = e.target.value;
                    setOptimizeAddresses(updated);
                  }}
                  placeholder={idx === 0 ? 'Start address (e.g., Makati City)' : `Stop ${idx} address`}
                  className="flex-1"
                />
                {optimizeAddresses.length > 2 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setOptimizeAddresses(optimizeAddresses.filter((_, i) => i !== idx))}
                    className="px-2"
                  >
                    ×
                  </Button>
                )}
              </div>
            ))}

            {optimizeAddresses.length < 12 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOptimizeAddresses([...optimizeAddresses, ''])}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Stop
              </Button>
            )}

            {optimizedResult && (
              <Card className="border-primary/50 bg-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    Optimized Result
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-2 bg-background rounded-lg">
                      <p className="text-xs text-muted-foreground">Distance</p>
                      <p className="text-lg font-bold">{optimizedResult.distance} km</p>
                    </div>
                    <div className="text-center p-2 bg-background rounded-lg">
                      <p className="text-xs text-muted-foreground">Duration</p>
                      <p className="text-lg font-bold">{optimizedResult.duration} min</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Optimized Order:</p>
                    <div className="space-y-1.5">
                      {optimizedResult.optimizedOrder.map((stop: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {idx + 1}
                          </span>
                          <span className="truncate">{stop.address}</span>
                          {idx < optimizedResult.optimizedOrder.length - 1 && (
                            <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0 ml-auto" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOptimizeModal(false)}>
              Close
            </Button>
            <Button onClick={handleOptimizeRoute} disabled={optimizing}>
              {optimizing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Optimizing...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Optimize
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
