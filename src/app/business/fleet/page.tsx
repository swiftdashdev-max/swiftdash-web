'use client';

import React, { useState, useEffect } from 'react';
import {
  Truck, Plus, Edit, Trash2, Copy, Check, X, Users,
  Ticket, Settings, TrendingUp, Package, Star,
  AlertCircle, CheckCircle, Clock, Phone,
  ChevronRight, BarChart2, Zap, Activity, Calendar,
  Navigation, Loader2, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface VehicleType { id: string; name: string; }

interface Vehicle {
  id: string;
  vehicle_type_id: string;
  plate_number: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: number;
  vehicle_color: string;
  access_mode: 'private' | 'public';
  current_status: 'idle' | 'busy' | 'offline' | 'maintenance';
  assigned_driver_id: string | null;
  total_deliveries: number;
  total_distance_km: number;
  average_rating: number | null;
  vehicle_type?: { name: string };
  assigned_driver?: { id: string; user_profile?: { full_name: string } | null };
}

interface DriverStats {
  deliveries_today: number;
  deliveries_week: number;
  deliveries_total: number;
  completion_rate: number;
  earnings_week: number;
  recent_deliveries: { id: string; status: string; created_at: string; total_amount: number; delivery_address: string }[];
}

interface FleetDriver {
  id: string;
  employment_type: string;
  current_status: 'online' | 'offline' | 'busy';
  vehicle_type_id: string;
  rating: number;
  total_deliveries: number;
  is_online: boolean;
  is_available: boolean;
  location_updated_at: string | null;
  current_latitude: number | null;
  current_longitude: number | null;
  vehicle_model: string | null;
  plate_number: string | null;
  user_profile?: { full_name: string; phone: string } | null;
  assigned_vehicle?: { plate_number: string; vehicle_make: string; vehicle_model: string } | null;
  stats?: DriverStats;
}

interface InvitationCode {
  id: string;
  code: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  max_uses: number;
  current_uses: number;
  is_active: boolean;
  used_by_driver_id: string | null;
  driver_name?: string;
}

export default function FleetPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<FleetDriver[]>([]);
  const [invitationCodes, setInvitationCodes] = useState<InvitationCode[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [deliveriesToday, setDeliveriesToday] = useState(0);
  const [avgFleetRating, setAvgFleetRating] = useState(0);

  // Driver profile sheet
  const [selectedDriver, setSelectedDriver] = useState<FleetDriver | null>(null);
  const [driverSheetOpen, setDriverSheetOpen] = useState(false);
  const [loadingDriverStats, setLoadingDriverStats] = useState(false);

  // Vehicle form
  const [isAddVehicleOpen, setIsAddVehicleOpen] = useState(false);
  const [isEditVehicleOpen, setIsEditVehicleOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [vehicleForm, setVehicleForm] = useState({
    vehicle_type_id: '', plate_number: '', vehicle_make: '', vehicle_model: '',
    vehicle_year: new Date().getFullYear(), vehicle_color: '', access_mode: 'private' as 'private' | 'public',
  });

  // Invitation
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [codeExpiryDays, setCodeExpiryDays] = useState(7);
  const [maxUses, setMaxUses] = useState(1);

  // Driver form
  const [isAddDriverOpen, setIsAddDriverOpen] = useState(false);
  const [isEditDriverOpen, setIsEditDriverOpen] = useState(false);
  const [isAddingDriver, setIsAddingDriver] = useState(false);
  const [editingDriverForm, setEditingDriverForm] = useState<FleetDriver | null>(null);
  const [driverForm, setDriverForm] = useState({ full_name: '', email: '', phone: '', password: '', vehicle_type_id: '' });
  const [editDriverEmail, setEditDriverEmail] = useState('');
  const [editDriverPassword, setEditDriverPassword] = useState('');
  const [editDriverOriginalEmail, setEditDriverOriginalEmail] = useState('');
  const [loadingDriverEmail, setLoadingDriverEmail] = useState(false);
  const [editDriverName, setEditDriverName] = useState('');
  const [editDriverPhone, setEditDriverPhone] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => { initializePage(); }, []);

  const initializePage = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/business/login'); return; }
      const { data: profile } = await supabase.from('user_profiles').select('business_id').eq('id', user.id).single();
      if (!profile?.business_id) { setError('No business account found'); setLoading(false); return; }
      setBusinessId(profile.business_id);
      await Promise.all([
        fetchVehicles(profile.business_id),
        fetchDrivers(profile.business_id),
        fetchInvitationCodes(profile.business_id),
        fetchVehicleTypes(),
        fetchFleetKPIs(profile.business_id),
      ]);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to load fleet'); }
    finally { setLoading(false); }
  };

  const handleRefresh = async () => {
    if (!businessId) return;
    setRefreshing(true);
    await Promise.all([
      fetchVehicles(businessId),
      fetchDrivers(businessId),
      fetchFleetKPIs(businessId),
    ]);
    setRefreshing(false);
  };

  const fetchFleetKPIs = async (bizId: string) => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const { count } = await supabase.from('deliveries').select('id', { count: 'exact', head: true })
      .eq('business_id', bizId).gte('created_at', todayStart.toISOString()).eq('status', 'delivered');
    setDeliveriesToday(count || 0);
  };

  const fetchVehicles = async (bizId: string) => {
    const { data, error: fetchError } = await supabase.from('business_fleet')
      .select('*, vehicle_type:vehicle_type_id(name), assigned_driver:assigned_driver_id(id)')
      .eq('business_id', bizId).order('created_at', { ascending: false });
    if (fetchError) throw fetchError;
    const withDrivers = await Promise.all((data || []).map(async (v) => {
      if (v.assigned_driver?.id) {
        const { data: up } = await supabase.from('user_profiles').select('first_name,last_name').eq('id', v.assigned_driver.id).single();
        return { ...v, assigned_driver: { ...v.assigned_driver, user_profile: up ? { full_name: `${up.first_name || ''} ${up.last_name || ''}`.trim() } : null } };
      }
      return v;
    }));
    setVehicles(withDrivers);
    const ratings = withDrivers.filter(v => v.average_rating).map(v => v.average_rating as number);
    setAvgFleetRating(ratings.length ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length : 0);
  };

  const fetchDriverStats = async (driverId: string): Promise<DriverStats> => {
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - 7);

    const [todayRes, weekRes, totalRes, earningsRes, recentRes] = await Promise.all([
      supabase.from('deliveries').select('id', { count: 'exact', head: true }).eq('driver_id', driverId).gte('created_at', todayStart.toISOString()),
      supabase.from('deliveries').select('id', { count: 'exact', head: true }).eq('driver_id', driverId).gte('created_at', weekStart.toISOString()),
      supabase.from('deliveries').select('id,status'),
      supabase.from('driver_earnings').select('total_earnings,driver_net_earnings').eq('driver_id', driverId).gte('created_at', weekStart.toISOString()),
      supabase.from('deliveries').select('id,status,created_at,total_amount,delivery_address').eq('driver_id', driverId).order('created_at', { ascending: false }).limit(5),
    ]);

    const allDeliveries = totalRes.data || [];
    const delivered = allDeliveries.filter(d => d.status === 'delivered').length;
    const completionRate = allDeliveries.length > 0 ? Math.round((delivered / allDeliveries.length) * 100) : 0;
    const earningsWeek = (earningsRes.data || []).reduce((s: number, e: { total_earnings?: number }) => s + (e.total_earnings || 0), 0);

    return {
      deliveries_today: todayRes.count || 0,
      deliveries_week: weekRes.count || 0,
      deliveries_total: totalRes.count || 0,
      completion_rate: completionRate,
      earnings_week: earningsWeek,
      recent_deliveries: recentRes.data || [],
    };
  };

  const fetchDrivers = async (bizId: string) => {
    const { data: driverProfiles, error: fetchError } = await supabase.from('driver_profiles')
      .select('id,employment_type,current_status,vehicle_type_id,rating,total_deliveries,is_online,is_available,location_updated_at,current_latitude,current_longitude,vehicle_model,plate_number')
      .eq('managed_by_business_id', bizId).eq('employment_type', 'fleet_driver');
    if (fetchError) throw fetchError;

    const withData = await Promise.all((driverProfiles || []).map(async (driver) => {
      const { data: up } = await supabase.from('user_profiles').select('first_name,last_name,phone_number').eq('id', driver.id).single();
      const { data: vehicle } = await supabase.from('business_fleet').select('plate_number,vehicle_make,vehicle_model').eq('assigned_driver_id', driver.id).maybeSingle();
      return {
        ...driver,
        user_profile: up ? { full_name: `${up.first_name || ''} ${up.last_name || ''}`.trim(), phone: up.phone_number } : null,
        assigned_vehicle: vehicle || null,
      };
    }));
    setDrivers(withData);
  };

  const openDriverSheet = async (driver: FleetDriver) => {
    setSelectedDriver(driver);
    setDriverSheetOpen(true);
    if (!driver.stats) {
      setLoadingDriverStats(true);
      try {
        const stats = await fetchDriverStats(driver.id);
        setSelectedDriver(prev => prev ? { ...prev, stats } : prev);
        setDrivers(prev => prev.map(d => d.id === driver.id ? { ...d, stats } : d));
      } finally { setLoadingDriverStats(false); }
    }
  };

  const fetchInvitationCodes = async (bizId: string) => {
    const { data, error: fetchError } = await supabase.from('fleet_invitation_codes').select('*').eq('business_id', bizId).order('created_at', { ascending: false });
    if (fetchError) throw fetchError;
    const withNames = await Promise.all((data || []).map(async (code) => {
      if (code.used_by_driver_id) {
        const { data: up } = await supabase.from('user_profiles').select('first_name,last_name').eq('id', code.used_by_driver_id).single();
        return { ...code, driver_name: up ? `${up.first_name || ''} ${up.last_name || ''}`.trim() : 'Unknown' };
      }
      return code;
    }));
    setInvitationCodes(withNames);
  };

  const fetchVehicleTypes = async () => {
    const { data, error: fetchError } = await supabase.from('vehicle_types').select('*').order('name');
    if (fetchError) throw fetchError;
    setVehicleTypes(data || []);
  };

  // ── Vehicle CRUD ─────────────────────────────────────────────────────────
  const handleAddVehicle = async () => {
    if (!businessId) return;
    setError(''); setSuccess('');
    try {
      const { error: insertError } = await supabase.from('business_fleet').insert([{ business_id: businessId, ...vehicleForm, current_status: 'idle' }]);
      if (insertError) throw insertError;
      setSuccess('Vehicle added successfully'); setIsAddVehicleOpen(false); resetVehicleForm(); await fetchVehicles(businessId);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to add vehicle'); }
  };

  const handleEditVehicle = async () => {
    if (!businessId || !editingVehicle) return;
    setError(''); setSuccess('');
    try {
      const { error: updateError } = await supabase.from('business_fleet').update(vehicleForm).eq('id', editingVehicle.id).eq('business_id', businessId);
      if (updateError) throw updateError;
      setSuccess('Vehicle updated'); setIsEditVehicleOpen(false); setEditingVehicle(null); resetVehicleForm(); await fetchVehicles(businessId);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to update vehicle'); }
  };

  const handleDeleteVehicle = async (vehicleId: string) => {
    if (!businessId || !confirm('Delete this vehicle?')) return;
    try {
      const { error: deleteError } = await supabase.from('business_fleet').delete().eq('id', vehicleId).eq('business_id', businessId);
      if (deleteError) throw deleteError;
      setSuccess('Vehicle deleted'); await fetchVehicles(businessId);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to delete vehicle'); }
  };

  const handleAssignDriver = async (vehicleId: string, driverId: string | null) => {
    if (!businessId) return;
    try {
      const { error: updateError } = await supabase.from('business_fleet').update({ assigned_driver_id: driverId }).eq('id', vehicleId).eq('business_id', businessId);
      if (updateError) throw updateError;
      setSuccess(driverId ? 'Driver assigned' : 'Driver unassigned'); await fetchVehicles(businessId); await fetchDrivers(businessId);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to assign driver'); }
  };

  const handleToggleAccessMode = async (vehicleId: string, currentMode: 'private' | 'public') => {
    if (!businessId) return;
    const newMode = currentMode === 'private' ? 'public' : 'private';
    try {
      const { error: updateError } = await supabase.from('business_fleet').update({ access_mode: newMode }).eq('id', vehicleId).eq('business_id', businessId);
      if (updateError) throw updateError;
      setSuccess(`Access mode → ${newMode}`); await fetchVehicles(businessId);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to toggle access mode'); }
  };

  const openEditVehicle = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setVehicleForm({ vehicle_type_id: vehicle.vehicle_type_id, plate_number: vehicle.plate_number, vehicle_make: vehicle.vehicle_make, vehicle_model: vehicle.vehicle_model, vehicle_year: vehicle.vehicle_year, vehicle_color: vehicle.vehicle_color, access_mode: vehicle.access_mode });
    setIsEditVehicleOpen(true);
  };

  const resetVehicleForm = () => setVehicleForm({ vehicle_type_id: '', plate_number: '', vehicle_make: '', vehicle_model: '', vehicle_year: new Date().getFullYear(), vehicle_color: '', access_mode: 'private' });

  // ── Driver CRUD ───────────────────────────────────────────────────────────
  const handleAddDriver = async () => {
    if (!businessId) return;
    setIsAddingDriver(true); setError(''); setSuccess('');
    try {
      if (!driverForm.full_name || !driverForm.email || !driverForm.phone || !driverForm.password || !driverForm.vehicle_type_id) throw new Error('Please fill in all required fields');
      if (driverForm.password.length < 6) throw new Error('Password must be at least 6 characters');
      const nameParts = driverForm.full_name.trim().split(' ');
      const response = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone_number: driverForm.phone, first_name: nameParts[0] || '', last_name: nameParts.slice(1).join(' ') || '', user_type: 'driver', email: driverForm.email, password: driverForm.password, status: 'active', vehicle_type_id: driverForm.vehicle_type_id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to create driver account');
      const { error: updateError } = await supabase.from('driver_profiles').update({ employment_type: 'fleet_driver', managed_by_business_id: businessId }).eq('id', result.user.id);
      if (updateError) throw updateError;
      setSuccess('Driver added to your fleet!'); setIsAddDriverOpen(false); resetDriverForm(); await fetchDrivers(businessId);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to add driver'); }
    finally { setIsAddingDriver(false); }
  };

  const handleUpdateDriver = async () => {
    if (!businessId || !editingDriverForm) return;
    setIsAddingDriver(true); setError(''); setSuccess('');
    try {
      // Update vehicle type in driver_profiles
      const { error: profileError } = await supabase.from('driver_profiles').update({ vehicle_type_id: driverForm.vehicle_type_id, updated_at: new Date().toISOString() }).eq('id', editingDriverForm.id);
      if (profileError) throw profileError;

      // Update name and phone in user_profiles
      const nameParts = editDriverName.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      const { error: upError } = await supabase.from('user_profiles').update({
        first_name: firstName,
        last_name: lastName,
        phone_number: editDriverPhone.trim(),
        updated_at: new Date().toISOString(),
      }).eq('id', editingDriverForm.id);
      if (upError) throw upError;

      // Update email and/or password if changed
      const emailChanged = editDriverEmail.trim() && editDriverEmail.trim() !== editDriverOriginalEmail;
      const passwordChanged = editDriverPassword.trim().length > 0;
      if (emailChanged || passwordChanged) {
        if (passwordChanged && editDriverPassword.length < 6) throw new Error('Password must be at least 6 characters');
        const response = await fetch('/api/admin/users', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: editingDriverForm.id,
            ...(emailChanged ? { email: editDriverEmail.trim() } : {}),
            ...(passwordChanged ? { password: editDriverPassword } : {}),
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to update credentials');
      }

      setSuccess('Driver updated!'); setIsEditDriverOpen(false); setEditingDriverForm(null); resetDriverForm(); setEditDriverEmail(''); setEditDriverPassword(''); setEditDriverOriginalEmail(''); setEditDriverName(''); setEditDriverPhone(''); await fetchDrivers(businessId);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to update driver'); }
    finally { setIsAddingDriver(false); }
  };

  const fetchDriverEmail = async (driverId: string) => {
    setLoadingDriverEmail(true);
    try {
      // Fetch the auth user's email via a lightweight API call
      const response = await fetch(`/api/admin/users/${driverId}`);
      if (response.ok) {
        const result = await response.json();
        const email = result.email || '';
        setEditDriverEmail(email);
        setEditDriverOriginalEmail(email);
      } else {
        setEditDriverEmail('');
        setEditDriverOriginalEmail('');
      }
    } catch {
      setEditDriverEmail('');
      setEditDriverOriginalEmail('');
    } finally {
      setLoadingDriverEmail(false);
    }
  };

  const handleRemoveDriver = async (driverId: string) => {
    if (!confirm('Remove this driver from your fleet?')) return;
    try {
      await supabase.from('business_fleet').update({ assigned_driver_id: null }).eq('assigned_driver_id', driverId);
      const { error: updateError } = await supabase.from('driver_profiles').update({ employment_type: 'independent', managed_by_business_id: null }).eq('id', driverId);
      if (updateError) throw updateError;
      setSuccess('Driver removed'); if (businessId) { await fetchDrivers(businessId); await fetchVehicles(businessId); }
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to remove driver'); }
  };

  const resetDriverForm = () => setDriverForm({ full_name: '', email: '', phone: '', password: '', vehicle_type_id: '' });

  // ── Invitation CRUD ───────────────────────────────────────────────────────
  const handleGenerateCode = async () => {
    if (!businessId) return;
    setIsGeneratingCode(true); setError(''); setSuccess('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data: codeData, error: codeError } = await supabase.rpc('generate_invitation_code');
      if (codeError) throw codeError;
      const expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + codeExpiryDays);
      const { error: insertError } = await supabase.from('fleet_invitation_codes').insert([{ business_id: businessId, code: codeData, created_by: user.id, expires_at: expiresAt.toISOString(), max_uses: maxUses, is_active: true }]);
      if (insertError) throw insertError;
      setSuccess('Invitation code generated'); await fetchInvitationCodes(businessId);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to generate code'); }
    finally { setIsGeneratingCode(false); }
  };

  const handleCopyCode = (code: string) => { navigator.clipboard.writeText(code); setCopiedCode(code); setTimeout(() => setCopiedCode(null), 2000); };

  const handleDeactivateCode = async (codeId: string) => {
    if (!businessId) return;
    try {
      const { error: updateError } = await supabase.from('fleet_invitation_codes').update({ is_active: false }).eq('id', codeId).eq('business_id', businessId);
      if (updateError) throw updateError;
      setSuccess('Code deactivated'); await fetchInvitationCodes(businessId);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to deactivate code'); }
  };

  const handleDeleteCode = async (codeId: string) => {
    if (!businessId || !confirm('Delete this invitation code?')) return;
    try {
      const { error: deleteError } = await supabase.from('fleet_invitation_codes').delete().eq('id', codeId).eq('business_id', businessId);
      if (deleteError) throw deleteError;
      setSuccess('Code deleted'); await fetchInvitationCodes(businessId);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed to delete code'); }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getVehicleStatusConfig = (status: string) => ({
    idle: { label: 'Idle', bg: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-400' },
    busy: { label: 'On Delivery', bg: 'bg-blue-100 text-blue-700', bar: 'bg-blue-400' },
    offline: { label: 'Offline', bg: 'bg-gray-100 text-gray-600', bar: 'bg-gray-300' },
    maintenance: { label: 'Maintenance', bg: 'bg-amber-100 text-amber-700', bar: 'bg-amber-400' },
  }[status] || { label: status, bg: 'bg-gray-100 text-gray-600', bar: 'bg-gray-300' });

  const getDriverStatusConfig = (driver: FleetDriver) => {
    if (driver.is_online && driver.current_status === 'busy') return { label: 'On Delivery', bg: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500 animate-pulse' };
    if (driver.is_online) return { label: 'Online', bg: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' };
    return { label: 'Offline', bg: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' };
  };

  const getCodeStatus = (code: InvitationCode) => {
    if (!code.is_active) return <Badge className="bg-red-100 text-red-700 text-xs">Inactive</Badge>;
    if (code.current_uses >= code.max_uses) return <Badge className="bg-gray-100 text-gray-600 text-xs">Used</Badge>;
    if (new Date(code.expires_at) < new Date()) return <Badge className="bg-amber-100 text-amber-700 text-xs">Expired</Badge>;
    return <Badge className="bg-emerald-100 text-emerald-700 text-xs">Active</Badge>;
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const formatRelative = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const secs = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    if (secs < 60) return `${secs}s ago`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
    return `${Math.floor(secs / 86400)}d ago`;
  };

  const StarRating = ({ rating }: { rating: number }) => (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={`h-3 w-3 ${i <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'fill-gray-200 text-gray-200'}`} />
      ))}
      <span className="ml-1 text-xs font-medium text-gray-600">{(rating || 0).toFixed(1)}</span>
    </div>
  );

  const onlineDrivers = drivers.filter(d => d.is_online);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="animate-spin h-10 w-10 text-blue-600 mx-auto" />
          <p className="mt-3 text-gray-600">Loading fleet data...</p>
        </div>
      </div>
    );
  }

  const VehicleFormFields = () => (
    <div className="space-y-4">
      <div>
        <Label>Vehicle Type</Label>
        <Select value={vehicleForm.vehicle_type_id} onValueChange={v => setVehicleForm({ ...vehicleForm, vehicle_type_id: v })}>
          <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
          <SelectContent>{vehicleTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <Label>Plate Number</Label>
        <Input value={vehicleForm.plate_number} onChange={e => setVehicleForm({ ...vehicleForm, plate_number: e.target.value })} placeholder="ABC-1234" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Make</Label><Input value={vehicleForm.vehicle_make} onChange={e => setVehicleForm({ ...vehicleForm, vehicle_make: e.target.value })} placeholder="Toyota" /></div>
        <div><Label>Model</Label><Input value={vehicleForm.vehicle_model} onChange={e => setVehicleForm({ ...vehicleForm, vehicle_model: e.target.value })} placeholder="Vios" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Year</Label><Input type="number" value={vehicleForm.vehicle_year} onChange={e => setVehicleForm({ ...vehicleForm, vehicle_year: parseInt(e.target.value) })} /></div>
        <div><Label>Color</Label><Input value={vehicleForm.vehicle_color} onChange={e => setVehicleForm({ ...vehicleForm, vehicle_color: e.target.value })} placeholder="White" /></div>
      </div>
      <div className="flex items-center justify-between rounded-lg border p-3 bg-gray-50 dark:bg-gray-800">
        <div>
          <p className="text-sm font-medium">Access Mode</p>
          <p className="text-xs text-gray-500">{vehicleForm.access_mode === 'private' ? 'Only for your deliveries' : 'Available to global pool when idle'}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Private</span>
          <Switch checked={vehicleForm.access_mode === 'public'} onCheckedChange={c => setVehicleForm({ ...vehicleForm, access_mode: c ? 'public' : 'private' })} />
          <span className="text-xs text-gray-500">Public</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
        <div className="container mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Fleet Management</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Vehicles, drivers &amp; invitations</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Refresh
            </Button>
          </div>

          {/* KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
            {[
              { label: 'Total Vehicles', value: vehicles.length, icon: Truck, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
              { label: 'Online Drivers', value: onlineDrivers.length, sub: `of ${drivers.length} total`, icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
              { label: 'Delivered Today', value: deliveriesToday, icon: Package, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
              { label: 'Avg Fleet Rating', value: avgFleetRating > 0 ? avgFleetRating.toFixed(1) : '—', icon: Star, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
            ].map(({ label, value, sub, icon: Icon, color, bg }) => (
              <div key={label} className="bg-white dark:bg-gray-700 rounded-xl border dark:border-gray-600 p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                  <p className={`text-xl font-bold ${color}`}>{value}</p>
                  {sub && <p className="text-xs text-gray-400">{sub}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-6">
        {error && <Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
        {success && <Alert className="mb-4 bg-emerald-50 text-emerald-800 border-emerald-200"><CheckCircle className="h-4 w-4" /><AlertDescription>{success}</AlertDescription></Alert>}

        <Tabs defaultValue="vehicles" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-[480px]">
            <TabsTrigger value="vehicles"><Truck className="mr-2 h-4 w-4" />My Fleet <span className="ml-1.5 text-xs opacity-60">({vehicles.length})</span></TabsTrigger>
            <TabsTrigger value="drivers"><Users className="mr-2 h-4 w-4" />Drivers <span className="ml-1.5 text-xs opacity-60">({drivers.length})</span></TabsTrigger>
            <TabsTrigger value="invitations"><Ticket className="mr-2 h-4 w-4" />Invitations</TabsTrigger>
          </TabsList>

          {/* ── VEHICLES TAB ──────────────────────────────────────────────── */}
          <TabsContent value="vehicles" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Your Vehicles</h2>
              <Dialog open={isAddVehicleOpen} onOpenChange={setIsAddVehicleOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="mr-2 h-4 w-4" />Add Vehicle</Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader><DialogTitle>Add New Vehicle</DialogTitle><DialogDescription>Add a vehicle to your fleet</DialogDescription></DialogHeader>
                  <div className="py-4"><VehicleFormFields /></div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddVehicleOpen(false)}>Cancel</Button>
                    <Button onClick={handleAddVehicle}>Add Vehicle</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {vehicles.length === 0 ? (
              <Card><CardContent className="flex flex-col items-center justify-center py-16">
                <Truck className="h-14 w-14 text-gray-300 mb-4" />
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">No vehicles yet</h3>
                <p className="text-sm text-gray-500 mb-4">Add your first vehicle to get started</p>
                <Button onClick={() => setIsAddVehicleOpen(true)}><Plus className="mr-2 h-4 w-4" />Add Vehicle</Button>
              </CardContent></Card>
            ) : (
              <div className="grid gap-4">
                {vehicles.map((vehicle) => {
                  const sc = getVehicleStatusConfig(vehicle.current_status);
                  const utilPct = Math.min(100, Math.round(((vehicle.total_deliveries || 0) / 30) * 100));
                  return (
                    <Card key={vehicle.id} className="overflow-hidden">
                      <CardContent className="p-0">
                        <div className="flex">
                          <div className={`w-1.5 flex-shrink-0 ${sc.bar}`} />
                          <div className="flex-1 p-5">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex gap-4">
                                <div className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                                  <Truck className="h-7 w-7 text-gray-500 dark:text-gray-300" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="font-semibold text-gray-900 dark:text-white">{vehicle.vehicle_make} {vehicle.vehicle_model}</h3>
                                    <Badge className={`text-xs ${sc.bg}`}>{sc.label}</Badge>
                                    <Badge variant={vehicle.access_mode === 'public' ? 'default' : 'outline'} className="text-xs">{vehicle.access_mode}</Badge>
                                  </div>
                                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                                    {vehicle.plate_number} · {vehicle.vehicle_year} · {vehicle.vehicle_color || '—'}
                                  </p>
                                  <p className="text-xs text-gray-400 mt-0.5">{vehicle.vehicle_type?.name || 'N/A'}</p>

                                  {/* Stats row */}
                                  <div className="flex items-center gap-5 mt-3">
                                    <div>
                                      <p className="text-lg font-bold text-gray-900 dark:text-white">{vehicle.total_deliveries || 0}</p>
                                      <p className="text-xs text-gray-400">Deliveries</p>
                                    </div>
                                    {(vehicle.total_distance_km || 0) > 0 && (
                                      <div>
                                        <p className="text-lg font-bold text-gray-900 dark:text-white">{(vehicle.total_distance_km || 0).toFixed(0)}</p>
                                        <p className="text-xs text-gray-400">km Total</p>
                                      </div>
                                    )}
                                    {vehicle.average_rating && (
                                      <div>
                                        <p className="text-lg font-bold text-amber-500">{vehicle.average_rating.toFixed(1)}</p>
                                        <p className="text-xs text-gray-400">Rating</p>
                                      </div>
                                    )}
                                  </div>

                                  {/* Utilisation bar */}
                                  {(vehicle.total_deliveries || 0) > 0 && (
                                    <div className="mt-3 max-w-xs">
                                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                                        <span>Utilisation (30-delivery baseline)</span>
                                        <span>{utilPct}%</span>
                                      </div>
                                      <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${utilPct}%` }} />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <div className="flex items-center gap-1.5 text-xs text-gray-400 mr-1">
                                  <span>{vehicle.access_mode === 'private' ? '🔒' : '🌐'}</span>
                                  <Switch checked={vehicle.access_mode === 'public'} onCheckedChange={() => handleToggleAccessMode(vehicle.id, vehicle.access_mode)} disabled={vehicle.current_status === 'busy'} />
                                </div>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm"><Settings className="h-4 w-4" /></Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => openEditVehicle(vehicle)}><Edit className="mr-2 h-4 w-4" />Edit Details</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleDeleteVehicle(vehicle.id)} className="text-red-600"><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>

                            {/* Assign driver */}
                            <div className="mt-4 pt-4 border-t dark:border-gray-700 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-gray-400" />
                                <span className="text-sm text-gray-500">Assigned Driver</span>
                              </div>
                              <Select value={vehicle.assigned_driver_id || 'none'} onValueChange={v => handleAssignDriver(vehicle.id, v === 'none' ? null : v)}>
                                <SelectTrigger className="w-[200px] h-8 text-sm">
                                  <SelectValue>{vehicle.assigned_driver?.user_profile?.full_name || 'No driver assigned'}</SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">No driver</SelectItem>
                                  {drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.user_profile?.full_name || 'Unknown'}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── DRIVERS TAB ───────────────────────────────────────────────── */}
          <TabsContent value="drivers" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Fleet Drivers</h2>
              <div className="flex gap-2">
                <Dialog open={isAddDriverOpen} onOpenChange={setIsAddDriverOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm"><Plus className="mr-2 h-4 w-4" />Add Driver</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Add Fleet Driver</DialogTitle><DialogDescription>Create a driver account and add to your fleet</DialogDescription></DialogHeader>
                    <div className="space-y-4 py-4">
                      <div><Label>Full Name *</Label><Input value={driverForm.full_name} onChange={e => setDriverForm({ ...driverForm, full_name: e.target.value })} placeholder="John Doe" /></div>
                      <div><Label>Email *</Label><Input type="email" value={driverForm.email} onChange={e => setDriverForm({ ...driverForm, email: e.target.value })} placeholder="driver@example.com" /></div>
                      <div><Label>Phone *</Label><Input type="tel" value={driverForm.phone} onChange={e => setDriverForm({ ...driverForm, phone: e.target.value })} placeholder="+63 912 345 6789" /></div>
                      <div>
                        <Label>Password *</Label>
                        <Input type="password" value={driverForm.password} onChange={e => setDriverForm({ ...driverForm, password: e.target.value })} placeholder="Min. 6 characters" />
                        <p className="text-xs text-gray-400 mt-1">Driver will use this to login to the mobile app</p>
                      </div>
                      <div>
                        <Label>Vehicle Type *</Label>
                        <Select value={driverForm.vehicle_type_id} onValueChange={v => setDriverForm({ ...driverForm, vehicle_type_id: v })}>
                          <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                          <SelectContent>{vehicleTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddDriverOpen(false)}>Cancel</Button>
                      <Button onClick={handleAddDriver} disabled={isAddingDriver}>{isAddingDriver ? 'Adding...' : 'Add Driver'}</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={isEditDriverOpen} onOpenChange={(open) => { setIsEditDriverOpen(open); if (!open) { setEditDriverPassword(''); } }}>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Edit Driver</DialogTitle>
                      <DialogDescription>
                        {editingDriverForm?.user_profile?.full_name || 'Update driver settings'}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Profile</p>
                        <div className="space-y-3">
                          <div>
                            <Label>Full Name</Label>
                            <Input
                              placeholder="Juan Dela Cruz"
                              value={editDriverName}
                              onChange={e => setEditDriverName(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label>Phone Number</Label>
                            <Input
                              placeholder="+639..."
                              value={editDriverPhone}
                              onChange={e => setEditDriverPhone(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label>Vehicle Type</Label>
                            <Select value={driverForm.vehicle_type_id} onValueChange={v => setDriverForm({ ...driverForm, vehicle_type_id: v })}>
                              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                              <SelectContent>{vehicleTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                      <div className="border-t pt-4 dark:border-gray-700">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Login Credentials</p>
                        <div className="space-y-3">
                          <div>
                            <Label>Email</Label>
                            {loadingDriverEmail ? (
                              <div className="flex items-center gap-2 mt-1 h-10 px-3 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                              </div>
                            ) : (
                              <Input
                                type="email"
                                placeholder="driver@example.com"
                                value={editDriverEmail}
                                onChange={e => setEditDriverEmail(e.target.value)}
                              />
                            )}
                          </div>
                          <div>
                            <Label>New Password</Label>
                            <Input
                              type="password"
                              placeholder="Leave blank to keep current"
                              value={editDriverPassword}
                              onChange={e => setEditDriverPassword(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground mt-1">Min 6 characters. Leave blank to keep current password.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsEditDriverOpen(false)}>Cancel</Button>
                      <Button onClick={handleUpdateDriver} disabled={isAddingDriver}>{isAddingDriver ? 'Updating...' : 'Update'}</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {drivers.length === 0 ? (
              <Card><CardContent className="flex flex-col items-center justify-center py-16">
                <Users className="h-14 w-14 text-gray-300 mb-4" />
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">No fleet drivers yet</h3>
                <p className="text-sm text-gray-500 mb-4">Add drivers or invite partner drivers</p>
                <div className="flex gap-2">
                  <Button onClick={() => setIsAddDriverOpen(true)}><Plus className="mr-2 h-4 w-4" />Add Driver</Button>
                </div>
              </CardContent></Card>
            ) : (
              <div className="grid gap-3">
                {drivers.map((driver) => {
                  const sc = getDriverStatusConfig(driver);
                  const initials = (driver.user_profile?.full_name || 'DX').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
                  const cachedStats = driver.stats;
                  return (
                    <Card key={driver.id} className="cursor-pointer hover:shadow-md transition-all" onClick={() => openDriverSheet(driver)}>
                      <CardContent className="p-5">
                        <div className="flex items-start gap-4">
                          {/* Avatar with status dot */}
                          <div className="relative flex-shrink-0">
                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                              {initials}
                            </div>
                            <span className={`absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-gray-800 ${sc.dot}`} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold text-gray-900 dark:text-white">{driver.user_profile?.full_name || 'Unknown Driver'}</h3>
                                  <Badge className={`text-xs ${sc.bg}`}>{sc.label}</Badge>
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <Phone className="h-3 w-3 text-gray-400" />
                                  <span className="text-xs text-gray-500">{driver.user_profile?.phone || 'No phone'}</span>
                                </div>
                              </div>
                              <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0 mt-1" />
                            </div>

                            <div className="mt-2">
                              <StarRating rating={driver.rating || 0} />
                            </div>

                            {/* Stats pills */}
                            <div className="flex flex-wrap gap-2 mt-3">
                              <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-700 rounded-full px-3 py-1">
                                <Package className="h-3 w-3 text-blue-500" />
                                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{driver.total_deliveries || 0} deliveries</span>
                              </div>
                              {cachedStats && (
                                <>
                                  <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-700 rounded-full px-3 py-1">
                                    <Zap className="h-3 w-3 text-emerald-500" />
                                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{cachedStats.deliveries_today} today</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-700 rounded-full px-3 py-1">
                                    <TrendingUp className="h-3 w-3 text-purple-500" />
                                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{cachedStats.completion_rate}% complete</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-700 rounded-full px-3 py-1">
                                    <BarChart2 className="h-3 w-3 text-amber-500" />
                                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">₱{cachedStats.earnings_week.toFixed(0)} this week</span>
                                  </div>
                                </>
                              )}
                              {driver.assigned_vehicle && (
                                <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-full px-3 py-1">
                                  <Truck className="h-3 w-3 text-blue-500" />
                                  <span className="text-xs font-medium text-blue-700 dark:text-blue-300">{driver.assigned_vehicle.plate_number}</span>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-1 mt-2">
                              <Clock className="h-3 w-3 text-gray-400" />
                              <span className="text-xs text-gray-400">Last seen {formatRelative(driver.location_updated_at)}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── INVITATIONS TAB ──────────────────────────────────────────── */}
          <TabsContent value="invitations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Generate Invitation Code</CardTitle>
                <CardDescription>Create codes for partner drivers to join your fleet</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-3 flex-wrap">
                  <div className="flex-1 min-w-[140px]">
                    <Label>Expires In</Label>
                    <Select value={codeExpiryDays.toString()} onValueChange={v => setCodeExpiryDays(parseInt(v))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">7 days</SelectItem>
                        <SelectItem value="14">14 days</SelectItem>
                        <SelectItem value="30">30 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <Label>Max Uses</Label>
                    <Select value={maxUses.toString()} onValueChange={v => setMaxUses(parseInt(v))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Single use</SelectItem>
                        <SelectItem value="5">5 uses</SelectItem>
                        <SelectItem value="10">10 uses</SelectItem>
                        <SelectItem value="999">Unlimited</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleGenerateCode} disabled={isGeneratingCode}>
                    {isGeneratingCode ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                    Generate Code
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Invitation Codes</CardTitle><CardDescription>Manage your fleet invitation codes</CardDescription></CardHeader>
              <CardContent>
                {invitationCodes.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">No invitation codes generated yet</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead>Uses</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Used By</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invitationCodes.map((code) => (
                        <TableRow key={code.id}>
                          <TableCell className="font-mono font-medium">
                            <div className="flex items-center gap-2">
                              {code.code}
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleCopyCode(code.code)}>
                                {copiedCode === code.code ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">{formatDate(code.created_at)}</TableCell>
                          <TableCell className="text-sm text-gray-500">{formatDate(code.expires_at)}</TableCell>
                          <TableCell className="text-sm">{code.current_uses}/{code.max_uses}</TableCell>
                          <TableCell>{getCodeStatus(code)}</TableCell>
                          <TableCell className="text-sm text-gray-500">{code.driver_name || '—'}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {code.is_active && code.current_uses < code.max_uses && (
                                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleDeactivateCode(code.id)}>Deactivate</Button>
                              )}
                              <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-red-600" onClick={() => handleDeleteCode(code.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Edit Vehicle Dialog ─────────────────────────────────────────── */}
      <Dialog open={isEditVehicleOpen} onOpenChange={setIsEditVehicleOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Vehicle</DialogTitle><DialogDescription>Update vehicle information</DialogDescription></DialogHeader>
          <div className="py-4"><VehicleFormFields /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditVehicleOpen(false)}>Cancel</Button>
            <Button onClick={handleEditVehicle}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Driver Profile Sheet ────────────────────────────────────────── */}
      <Sheet open={driverSheetOpen} onOpenChange={setDriverSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedDriver && (() => {
            const driver = selectedDriver;
            const sc = getDriverStatusConfig(driver);
            const initials = (driver.user_profile?.full_name || 'DX').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
            const stats = driver.stats;
            return (
              <>
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-3 mt-2">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl">
                        {initials}
                      </div>
                      <span className={`absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${sc.dot}`} />
                    </div>
                    <div>
                      <div className="text-xl">{driver.user_profile?.full_name || 'Unknown Driver'}</div>
                      <Badge className={`text-xs mt-0.5 ${sc.bg}`}>{sc.label}</Badge>
                    </div>
                  </SheetTitle>
                  <SheetDescription asChild>
                    <div><StarRating rating={driver.rating || 0} /></div>
                  </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-5">
                  {loadingDriverStats && (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-500 mr-2" />
                      <span className="text-sm text-gray-500">Loading stats…</span>
                    </div>
                  )}

                  {/* Contact */}
                  <Card>
                    <CardContent className="p-4 space-y-2">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2"><Phone className="h-4 w-4 text-blue-500" />Contact</h3>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{driver.user_profile?.phone || 'Not available'}</p>
                    </CardContent>
                  </Card>

                  {/* Stats grid */}
                  {stats && !loadingDriverStats && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2"><BarChart2 className="h-4 w-4 text-blue-500" />Performance Stats</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: 'Today', value: stats.deliveries_today, unit: 'deliveries', icon: Zap, color: 'text-emerald-600' },
                          { label: 'This Week', value: stats.deliveries_week, unit: 'deliveries', icon: Calendar, color: 'text-blue-600' },
                          { label: 'All Time', value: stats.deliveries_total, unit: 'deliveries', icon: Package, color: 'text-purple-600' },
                          { label: 'Completion', value: `${stats.completion_rate}%`, unit: 'rate', icon: CheckCircle, color: 'text-emerald-600' },
                        ].map(({ label, value, unit, icon: Icon, color }) => (
                          <div key={label} className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Icon className={`h-3.5 w-3.5 ${color}`} />
                              <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
                            </div>
                            <p className={`text-2xl font-bold ${color}`}>{value}</p>
                            <p className="text-xs text-gray-400">{unit}</p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 bg-gray-50 dark:bg-gray-700 rounded-xl p-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-2">
                          <span>Completion Rate</span>
                          <span className="font-semibold text-emerald-600">{stats.completion_rate}%</span>
                        </div>
                        <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all" style={{ width: `${stats.completion_rate}%` }} />
                        </div>
                      </div>

                      {stats.earnings_week > 0 && (
                        <div className="mt-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="h-4 w-4 text-amber-600" />
                            <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">Earnings This Week</span>
                          </div>
                          <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">₱{stats.earnings_week.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Vehicle */}
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2"><Truck className="h-4 w-4 text-blue-500" />Assigned Vehicle</h3>
                      {driver.assigned_vehicle ? (
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                            <Truck className="h-5 w-5 text-blue-500" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{driver.assigned_vehicle.vehicle_make} {driver.assigned_vehicle.vehicle_model}</p>
                            <p className="text-xs text-gray-500 font-mono">{driver.assigned_vehicle.plate_number}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400">No vehicle assigned</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Location */}
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2"><Navigation className="h-4 w-4 text-blue-500" />Last Known Location</h3>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${driver.is_online ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                        <span className="text-sm text-gray-600 dark:text-gray-400">Updated {formatRelative(driver.location_updated_at)}</span>
                      </div>
                      {driver.current_latitude && driver.current_longitude && (
                        <p className="text-xs font-mono text-gray-400 mt-1">{driver.current_latitude.toFixed(5)}, {driver.current_longitude.toFixed(5)}</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Recent deliveries */}
                  {stats?.recent_deliveries && stats.recent_deliveries.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2"><Clock className="h-4 w-4 text-blue-500" />Recent Deliveries</h3>
                      <div className="space-y-2">
                        {stats.recent_deliveries.map(d => (
                          <div key={d.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                            <div className="min-w-0">
                              <p className="text-xs text-gray-500 truncate">{d.delivery_address}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{formatRelative(d.created_at)}</p>
                            </div>
                            <div className="text-right flex-shrink-0 ml-3">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">₱{(d.total_amount || 0).toFixed(2)}</p>
                              <Badge className={`text-[10px] mt-0.5 ${d.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' : d.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{d.status}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="pt-4 border-t dark:border-gray-700 space-y-2">
                    <Button variant="outline" className="w-full" onClick={() => {
                      setEditingDriverForm(driver);
                      setDriverForm({ ...driverForm, vehicle_type_id: driver.vehicle_type_id });
                      setEditDriverName(driver.user_profile?.full_name || '');
                      setEditDriverPhone(driver.user_profile?.phone || '');
                      setEditDriverPassword('');
                      setDriverSheetOpen(false);
                      setIsEditDriverOpen(true);
                      fetchDriverEmail(driver.id);
                    }}>
                      <Edit className="h-4 w-4 mr-2" />Edit Driver
                    </Button>
                    <Button variant="outline" className="w-full text-red-600 hover:text-red-700" onClick={() => {
                      setDriverSheetOpen(false);
                      handleRemoveDriver(driver.id);
                    }}>
                      <X className="h-4 w-4 mr-2" />Remove from Fleet
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
}
