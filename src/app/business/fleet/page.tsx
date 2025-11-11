'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Truck, Plus, Edit, Trash2, Copy, Check, X, Users, 
  Ticket, Calendar, Settings, MapPin, TrendingUp, Package,
  AlertCircle, CheckCircle, Clock, Power
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface VehicleType {
  id: string;
  name: string;
}

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
  average_rating: number | null;
  vehicle_type?: { name: string };
  assigned_driver?: {
    id: string;
    user_profile: {
      full_name: string;
    };
  };
}

interface FleetDriver {
  id: string;
  employment_type: string;
  current_status: 'online' | 'offline' | 'busy';
  vehicle_type_id: string;
  rating: number;
  total_deliveries: number;
  user_profile: {
    full_name: string;
    phone: string;
  };
  assigned_vehicle?: {
    plate_number: string;
    vehicle_make: string;
    vehicle_model: string;
  };
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
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<FleetDriver[]>([]);
  const [invitationCodes, setInvitationCodes] = useState<InvitationCode[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  
  // Vehicle form state
  const [isAddVehicleOpen, setIsAddVehicleOpen] = useState(false);
  const [isEditVehicleOpen, setIsEditVehicleOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [vehicleForm, setVehicleForm] = useState({
    vehicle_type_id: '',
    plate_number: '',
    vehicle_make: '',
    vehicle_model: '',
    vehicle_year: new Date().getFullYear(),
    vehicle_color: '',
    access_mode: 'private' as 'private' | 'public',
  });

  // Invitation code form state
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [codeExpiryDays, setCodeExpiryDays] = useState(7);
  const [maxUses, setMaxUses] = useState(1);

  // Driver form state
  const [isAddDriverOpen, setIsAddDriverOpen] = useState(false);
  const [isEditDriverOpen, setIsEditDriverOpen] = useState(false);
  const [isAddingDriver, setIsAddingDriver] = useState(false);
  const [editingDriver, setEditingDriver] = useState<FleetDriver | null>(null);
  const [driverForm, setDriverForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    vehicle_type_id: '',
  });
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    initializePage();
  }, []);

  const initializePage = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/business/login');
        return;
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('business_id')
        .eq('id', user.id)
        .single();

      if (!profile?.business_id) {
        setError('No business account found');
        setLoading(false);
        return;
      }

      setBusinessId(profile.business_id);
      
      // Fetch all data in parallel
      await Promise.all([
        fetchVehicles(profile.business_id),
        fetchDrivers(profile.business_id),
        fetchInvitationCodes(profile.business_id),
        fetchVehicleTypes(),
      ]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchVehicles = async (bizId: string) => {
    const { data, error } = await supabase
      .from('business_fleet')
      .select(`
        *,
        vehicle_type:vehicle_type_id(name),
        assigned_driver:assigned_driver_id(id)
      `)
      .eq('business_id', bizId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Fetch user profiles for assigned drivers
    const vehiclesWithDrivers = await Promise.all((data || []).map(async (vehicle) => {
      if (vehicle.assigned_driver?.id) {
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('full_name')
          .eq('id', vehicle.assigned_driver.id)
          .single();
        
        return {
          ...vehicle,
          assigned_driver: {
            ...vehicle.assigned_driver,
            user_profile: userProfile
          }
        };
      }
      return vehicle;
    }));

    setVehicles(vehiclesWithDrivers);
  };

  const fetchDrivers = async (bizId: string) => {
    try {
      const { data: driverProfiles, error } = await supabase
        .from('driver_profiles')
        .select('*')
        .eq('managed_by_business_id', bizId)
        .eq('employment_type', 'fleet_driver');

      if (error) {
        console.error('Error fetching driver profiles:', error);
        throw error;
      }

      // For each driver, fetch their user profile and check if they're assigned to a vehicle
      const driversWithData = await Promise.all((driverProfiles || []).map(async (driver) => {
      // Fetch user profile (driver_profiles.id = user_profiles.id)
      const { data: userProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('full_name, phone')
        .eq('id', driver.id)
        .single();

      if (profileError) {
        console.error(`Error fetching user profile for driver ${driver.id}:`, profileError);
      }        // Check if assigned to a vehicle
        const { data: vehicle, error: vehicleError } = await supabase
          .from('business_fleet')
          .select('plate_number, vehicle_make, vehicle_model')
          .eq('assigned_driver_id', driver.id)
          .single();

        if (vehicleError && vehicleError.code !== 'PGRST116') {
          // PGRST116 is "no rows returned", which is fine (driver not assigned to vehicle)
          console.error(`Error fetching vehicle for driver ${driver.id}:`, vehicleError);
        }

        return {
          ...driver,
          user_profile: userProfile,
          assigned_vehicle: vehicle
        };
      }));

      setDrivers(driversWithData);
    } catch (err) {
      console.error('Error in fetchDrivers:', err);
      setError('Failed to fetch drivers');
    }
  };

  const fetchInvitationCodes = async (bizId: string) => {
    const { data, error } = await supabase
      .from('fleet_invitation_codes')
      .select('*')
      .eq('business_id', bizId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // For used codes, fetch driver names
    const codesWithDrivers = await Promise.all((data || []).map(async (code) => {
      if (code.used_by_driver_id) {
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('full_name')
          .eq('id', code.used_by_driver_id)
          .single();

        return {
          ...code,
          driver_name: userProfile 
            ? userProfile.full_name
            : 'Unknown'
        };
      }
      return code;
    }));

    setInvitationCodes(codesWithDrivers);
  };

  const fetchVehicleTypes = async () => {
    const { data, error } = await supabase
      .from('vehicle_types')
      .select('*')
      .order('name');

    if (error) throw error;
    setVehicleTypes(data || []);
  };

  // Vehicle Management
  const handleAddVehicle = async () => {
    if (!businessId) return;
    
    setError('');
    setSuccess('');

    try {
      const { error } = await supabase
        .from('business_fleet')
        .insert([{
          business_id: businessId,
          ...vehicleForm,
          current_status: 'idle',
        }]);

      if (error) throw error;

      setSuccess('Vehicle added successfully');
      setIsAddVehicleOpen(false);
      resetVehicleForm();
      await fetchVehicles(businessId);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEditVehicle = async () => {
    if (!businessId || !editingVehicle) return;

    setError('');
    setSuccess('');

    try {
      const { error } = await supabase
        .from('business_fleet')
        .update(vehicleForm)
        .eq('id', editingVehicle.id)
        .eq('business_id', businessId);

      if (error) throw error;

      setSuccess('Vehicle updated successfully');
      setIsEditVehicleOpen(false);
      setEditingVehicle(null);
      resetVehicleForm();
      await fetchVehicles(businessId);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteVehicle = async (vehicleId: string) => {
    if (!businessId) return;
    if (!confirm('Are you sure you want to delete this vehicle?')) return;

    try {
      const { error } = await supabase
        .from('business_fleet')
        .delete()
        .eq('id', vehicleId)
        .eq('business_id', businessId);

      if (error) throw error;

      setSuccess('Vehicle deleted successfully');
      await fetchVehicles(businessId);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAssignDriver = async (vehicleId: string, driverId: string | null) => {
    if (!businessId) return;

    try {
      const { error } = await supabase
        .from('business_fleet')
        .update({ assigned_driver_id: driverId })
        .eq('id', vehicleId)
        .eq('business_id', businessId);

      if (error) throw error;

      setSuccess(driverId ? 'Driver assigned successfully' : 'Driver unassigned successfully');
      await fetchVehicles(businessId);
      await fetchDrivers(businessId);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleToggleAccessMode = async (vehicleId: string, currentMode: 'private' | 'public') => {
    if (!businessId) return;

    const newMode = currentMode === 'private' ? 'public' : 'private';

    try {
      const { error } = await supabase
        .from('business_fleet')
        .update({ access_mode: newMode })
        .eq('id', vehicleId)
        .eq('business_id', businessId);

      if (error) throw error;

      setSuccess(`Access mode changed to ${newMode}`);
      await fetchVehicles(businessId);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const openEditVehicle = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setVehicleForm({
      vehicle_type_id: vehicle.vehicle_type_id,
      plate_number: vehicle.plate_number,
      vehicle_make: vehicle.vehicle_make,
      vehicle_model: vehicle.vehicle_model,
      vehicle_year: vehicle.vehicle_year,
      vehicle_color: vehicle.vehicle_color,
      access_mode: vehicle.access_mode,
    });
    setIsEditVehicleOpen(true);
  };

  const resetVehicleForm = () => {
    setVehicleForm({
      vehicle_type_id: '',
      plate_number: '',
      vehicle_make: '',
      vehicle_model: '',
      vehicle_year: new Date().getFullYear(),
      vehicle_color: '',
      access_mode: 'private',
    });
  };

  // Driver Management
  const handleAddDriver = async () => {
    if (!businessId) return;

    setIsAddingDriver(true);
    setError('');
    setSuccess('');

    try {
      // Validate form
      if (!driverForm.full_name || !driverForm.email || 
          !driverForm.phone || !driverForm.password || !driverForm.vehicle_type_id) {
        throw new Error('Please fill in all required fields');
      }

      if (driverForm.password.length < 6) {
        throw new Error('Password must be at least 6 characters');
      }

      // Extract first and last name from full name
      const nameParts = driverForm.full_name.trim().split(' ');
      const first_name = nameParts[0] || '';
      const last_name = nameParts.slice(1).join(' ') || '';

      // Call admin API to create driver with auth account
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone_number: driverForm.phone,
          first_name,
          last_name,
          user_type: 'driver',
          email: driverForm.email,
          password: driverForm.password,
          status: 'active',
          vehicle_type_id: driverForm.vehicle_type_id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create driver account');
      }

      // Update driver to be fleet driver for this business
      // Note: driver_profiles.id = auth.users.id (same UUID)
      const { error: updateError } = await supabase
        .from('driver_profiles')
        .update({
          employment_type: 'fleet_driver',
          managed_by_business_id: businessId,
        })
        .eq('id', result.user.id);

      if (updateError) throw updateError;

      setSuccess('Driver added successfully to your fleet!');
      setIsAddDriverOpen(false);
      resetDriverForm();
      await fetchDrivers(businessId);
    } catch (err: any) {
      setError(err.message || 'Failed to add driver');
    } finally {
      setIsAddingDriver(false);
    }
  };

  const resetDriverForm = () => {
    setDriverForm({
      full_name: '',
      email: '',
      phone: '',
      password: '',
      vehicle_type_id: '',
    });
  };

  const handleEditDriver = (driver: FleetDriver) => {
    setEditingDriver(driver);
    setDriverForm({
      full_name: driver.user_profile.full_name,
      email: '', // Email not available in user_profiles, stored in auth.users
      phone: driver.user_profile.phone,
      password: '', // Don't populate password
      vehicle_type_id: driver.vehicle_type_id,
    });
    setIsEditDriverOpen(true);
  };

  const handleUpdateDriver = async () => {
    if (!businessId || !editingDriver) return;

    setIsAddingDriver(true);
    setError('');
    setSuccess('');

    try {
      // Update user_profiles
      const { error: userError } = await supabase
        .from('user_profiles')
        .update({
          full_name: driverForm.full_name,
          phone: driverForm.phone,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingDriver.id);

      if (userError) throw userError;

      // Update driver_profiles (vehicle type)
      const { error: driverError } = await supabase
        .from('driver_profiles')
        .update({
          vehicle_type_id: driverForm.vehicle_type_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingDriver.id);

      if (driverError) throw driverError;

      setSuccess('Driver updated successfully!');
      setIsEditDriverOpen(false);
      setEditingDriver(null);
      resetDriverForm();
      await fetchDrivers(businessId);
    } catch (err: any) {
      setError(err.message || 'Failed to update driver');
    } finally {
      setIsAddingDriver(false);
    }
  };

  // Invitation Code Management
  const handleGenerateCode = async () => {
    if (!businessId) return;

    setIsGeneratingCode(true);
    setError('');
    setSuccess('');

    try {
      // Get the current user for created_by
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Call the database function to generate a unique code
      const { data: codeData, error: codeError } = await supabase
        .rpc('generate_invitation_code');

      if (codeError) throw codeError;

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + codeExpiryDays);

      const { error } = await supabase
        .from('fleet_invitation_codes')
        .insert([{
          business_id: businessId,
          code: codeData,
          created_by: user.id,
          expires_at: expiresAt.toISOString(),
          max_uses: maxUses,
          is_active: true,
        }]);

      if (error) throw error;

      setSuccess('Invitation code generated successfully');
      await fetchInvitationCodes(businessId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleDeactivateCode = async (codeId: string) => {
    if (!businessId) return;

    try {
      const { error } = await supabase
        .from('fleet_invitation_codes')
        .update({ is_active: false })
        .eq('id', codeId)
        .eq('business_id', businessId);

      if (error) throw error;

      setSuccess('Code deactivated successfully');
      await fetchInvitationCodes(businessId);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteCode = async (codeId: string) => {
    if (!businessId) return;
    if (!confirm('Are you sure you want to delete this invitation code?')) return;

    try {
      const { error } = await supabase
        .from('fleet_invitation_codes')
        .delete()
        .eq('id', codeId)
        .eq('business_id', businessId);

      if (error) throw error;

      setSuccess('Code deleted successfully');
      await fetchInvitationCodes(businessId);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Driver Management
  const handleRemoveDriver = async (driverId: string) => {
    if (!confirm('Remove this driver from your fleet? They will become an independent driver.')) return;

    try {
      // First unassign from any vehicles
      await supabase
        .from('business_fleet')
        .update({ assigned_driver_id: null })
        .eq('assigned_driver_id', driverId);

      // Then update driver profile
      const { error } = await supabase
        .from('driver_profiles')
        .update({
          employment_type: 'independent',
          managed_by_business_id: null,
        })
        .eq('id', driverId);

      if (error) throw error;

      setSuccess('Driver removed from fleet');
      if (businessId) {
        await fetchDrivers(businessId);
        await fetchVehicles(businessId);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Utility functions
  const getStatusBadge = (status: string) => {
    const styles = {
      idle: 'bg-green-100 text-green-800',
      busy: 'bg-blue-100 text-blue-800',
      offline: 'bg-gray-100 text-gray-800',
      maintenance: 'bg-yellow-100 text-yellow-800',
      online: 'bg-green-100 text-green-800',
    };
    return <Badge className={styles[status as keyof typeof styles] || 'bg-gray-100'}>{status}</Badge>;
  };

  const getCodeStatus = (code: InvitationCode) => {
    if (!code.is_active) return <Badge className="bg-red-100 text-red-800">Inactive</Badge>;
    if (code.current_uses >= code.max_uses) return <Badge className="bg-gray-100 text-gray-800">Used</Badge>;
    if (new Date(code.expires_at) < new Date()) return <Badge className="bg-orange-100 text-orange-800">Expired</Badge>;
    return <Badge className="bg-green-100 text-green-800">Active</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading fleet data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Fleet Management</h1>
              <p className="text-gray-600 dark:text-gray-300 mt-1">Manage your vehicles, drivers, and invitations</p>
            </div>
            <div className="flex gap-2">
              <Card className="px-4 py-2">
                <div className="text-sm text-gray-600">Total Vehicles</div>
                <div className="text-2xl font-bold text-blue-600">{vehicles.length}</div>
              </Card>
              <Card className="px-4 py-2">
                <div className="text-sm text-gray-600">Fleet Drivers</div>
                <div className="text-2xl font-bold text-green-600">{drivers.length}</div>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-6">
        {/* Alerts */}
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-4 bg-green-50 text-green-800 border-green-200">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Tabs */}
        <Tabs defaultValue="vehicles" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-[500px]">
            <TabsTrigger value="vehicles">
              <Truck className="mr-2 h-4 w-4" />
              My Fleet
            </TabsTrigger>
            <TabsTrigger value="drivers">
              <Users className="mr-2 h-4 w-4" />
              Fleet Drivers
            </TabsTrigger>
            <TabsTrigger value="invitations">
              <Ticket className="mr-2 h-4 w-4" />
              Invitations
            </TabsTrigger>
          </TabsList>

          {/* My Fleet Tab */}
          <TabsContent value="vehicles" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Your Vehicles</h2>
              <Dialog open={isAddVehicleOpen} onOpenChange={setIsAddVehicleOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Vehicle
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add New Vehicle</DialogTitle>
                    <DialogDescription>Add a new vehicle to your fleet</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label>Vehicle Type</Label>
                      <Select
                        value={vehicleForm.vehicle_type_id}
                        onValueChange={(value) => setVehicleForm({ ...vehicleForm, vehicle_type_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select vehicle type" />
                        </SelectTrigger>
                        <SelectContent>
                          {vehicleTypes.map((type) => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Plate Number</Label>
                      <Input
                        value={vehicleForm.plate_number}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, plate_number: e.target.value })}
                        placeholder="ABC-1234"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Make</Label>
                        <Input
                          value={vehicleForm.vehicle_make}
                          onChange={(e) => setVehicleForm({ ...vehicleForm, vehicle_make: e.target.value })}
                          placeholder="Toyota"
                        />
                      </div>
                      <div>
                        <Label>Model</Label>
                        <Input
                          value={vehicleForm.vehicle_model}
                          onChange={(e) => setVehicleForm({ ...vehicleForm, vehicle_model: e.target.value })}
                          placeholder="Vios"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Year</Label>
                        <Input
                          type="number"
                          value={vehicleForm.vehicle_year}
                          onChange={(e) => setVehicleForm({ ...vehicleForm, vehicle_year: parseInt(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label>Color</Label>
                        <Input
                          value={vehicleForm.vehicle_color}
                          onChange={(e) => setVehicleForm({ ...vehicleForm, vehicle_color: e.target.value })}
                          placeholder="White"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Access Mode</Label>
                        <p className="text-xs text-gray-500">
                          {vehicleForm.access_mode === 'private' ? 'Only for your deliveries' : 'Available to global pool when idle'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Private</span>
                        <Switch
                          checked={vehicleForm.access_mode === 'public'}
                          onCheckedChange={(checked) => 
                            setVehicleForm({ ...vehicleForm, access_mode: checked ? 'public' : 'private' })
                          }
                        />
                        <span className="text-sm">Public</span>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddVehicleOpen(false)}>Cancel</Button>
                    <Button onClick={handleAddVehicle}>Add Vehicle</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {vehicles.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Truck className="h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No vehicles yet</h3>
                  <p className="text-gray-600 mb-4">Add your first vehicle to get started</p>
                  <Button onClick={() => setIsAddVehicleOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Vehicle
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {vehicles.map((vehicle) => (
                  <Card key={vehicle.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex gap-4">
                          <div className="h-16 w-16 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                            <Truck className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                {vehicle.vehicle_make} {vehicle.vehicle_model}
                              </h3>
                              {getStatusBadge(vehicle.current_status)}
                              <Badge variant={vehicle.access_mode === 'public' ? 'default' : 'secondary'}>
                                {vehicle.access_mode}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                              {vehicle.plate_number} • {vehicle.vehicle_year} • {vehicle.vehicle_color}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Type: {vehicle.vehicle_type?.name || 'N/A'}
                            </p>
                            <div className="flex items-center gap-4 mt-2">
                              <div className="text-xs">
                                <span className="text-gray-500 dark:text-gray-400">Deliveries:</span>{' '}
                                <span className="font-medium text-gray-900 dark:text-gray-100">{vehicle.total_deliveries}</span>
                              </div>
                              {vehicle.average_rating && (
                                <div className="text-xs">
                                  <span className="text-gray-500 dark:text-gray-400">Rating:</span>{' '}
                                  <span className="font-medium text-gray-900 dark:text-gray-100">{vehicle.average_rating.toFixed(1)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Switch
                            checked={vehicle.access_mode === 'public'}
                            onCheckedChange={() => handleToggleAccessMode(vehicle.id, vehicle.access_mode)}
                            disabled={vehicle.current_status === 'busy'}
                          />
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Settings className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditVehicle(vehicle)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit Details
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDeleteVehicle(vehicle.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Vehicle
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm">Assigned Driver</Label>
                          <Select
                            value={vehicle.assigned_driver_id || 'none'}
                            onValueChange={(value) => 
                              handleAssignDriver(vehicle.id, value === 'none' ? null : value)
                            }
                          >
                            <SelectTrigger className="w-[200px]">
                              <SelectValue>
                                {vehicle.assigned_driver?.user_profile 
                                  ? vehicle.assigned_driver.user_profile.full_name
                                  : 'No driver assigned'}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No driver</SelectItem>
                              {drivers.map((driver) => (
                                <SelectItem key={driver.id} value={driver.id}>
                                  {driver.user_profile.full_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Fleet Drivers Tab */}
          <TabsContent value="drivers" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Fleet Drivers</h2>
              <div className="flex gap-2">
                <Dialog open={isAddDriverOpen} onOpenChange={setIsAddDriverOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Driver
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Add Fleet Driver</DialogTitle>
                      <DialogDescription>
                        Create a new driver account and add them to your fleet
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label>Full Name *</Label>
                        <Input
                          value={driverForm.full_name}
                          onChange={(e) => setDriverForm({ ...driverForm, full_name: e.target.value })}
                          placeholder="John Doe"
                        />
                      </div>
                      <div>
                        <Label>Email *</Label>
                        <Input
                          type="email"
                          value={driverForm.email}
                          onChange={(e) => setDriverForm({ ...driverForm, email: e.target.value })}
                          placeholder="driver@example.com"
                        />
                      </div>
                      <div>
                        <Label>Phone Number *</Label>
                        <Input
                          type="tel"
                          value={driverForm.phone}
                          onChange={(e) => setDriverForm({ ...driverForm, phone: e.target.value })}
                          placeholder="+63 912 345 6789"
                        />
                      </div>
                      <div>
                        <Label>Password *</Label>
                        <Input
                          type="password"
                          value={driverForm.password}
                          onChange={(e) => setDriverForm({ ...driverForm, password: e.target.value })}
                          placeholder="Min. 6 characters"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Driver will use this to login to the mobile app
                        </p>
                      </div>
                      <div>
                        <Label>Vehicle Type *</Label>
                        <Select
                          value={driverForm.vehicle_type_id}
                          onValueChange={(value) => setDriverForm({ ...driverForm, vehicle_type_id: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select vehicle type" />
                          </SelectTrigger>
                          <SelectContent>
                            {vehicleTypes.map((type) => (
                              <SelectItem key={type.id} value={type.id}>
                                {type.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddDriverOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleAddDriver} disabled={isAddingDriver}>
                        {isAddingDriver ? 'Adding...' : 'Add Driver'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Edit Driver Dialog */}
                <Dialog open={isEditDriverOpen} onOpenChange={setIsEditDriverOpen}>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Edit Fleet Driver</DialogTitle>
                      <DialogDescription>
                        Update driver information and vehicle type
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label>Full Name *</Label>
                        <Input
                          value={driverForm.full_name}
                          onChange={(e) => setDriverForm({ ...driverForm, full_name: e.target.value })}
                          placeholder="John Doe"
                        />
                      </div>
                      <div>
                        <Label>Email</Label>
                        <Input
                          type="email"
                          value={driverForm.email}
                          disabled
                          className="bg-gray-50"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Email cannot be changed
                        </p>
                      </div>
                      <div>
                        <Label>Phone Number *</Label>
                        <Input
                          type="tel"
                          value={driverForm.phone}
                          onChange={(e) => setDriverForm({ ...driverForm, phone: e.target.value })}
                          placeholder="+63 912 345 6789"
                        />
                      </div>
                      <div>
                        <Label>Vehicle Type *</Label>
                        <Select
                          value={driverForm.vehicle_type_id}
                          onValueChange={(value) => setDriverForm({ ...driverForm, vehicle_type_id: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select vehicle type" />
                          </SelectTrigger>
                          <SelectContent>
                            {vehicleTypes.map((type) => (
                              <SelectItem key={type.id} value={type.id}>
                                {type.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsEditDriverOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleUpdateDriver} disabled={isAddingDriver}>
                        {isAddingDriver ? 'Updating...' : 'Update Driver'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Button onClick={() => {
                  // Switch to invitations tab
                  const invitationsTab = document.querySelector('[value="invitations"]') as HTMLElement;
                  invitationsTab?.click();
                }}>
                  <Ticket className="mr-2 h-4 w-4" />
                  Invite Partner Driver
                </Button>
              </div>
            </div>

            {drivers.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Users className="h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No fleet drivers yet</h3>
                  <p className="text-gray-600 mb-4">Add drivers to your fleet or invite partner drivers</p>
                  <div className="flex gap-2">
                    <Button onClick={() => setIsAddDriverOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Driver
                    </Button>
                    <Button variant="outline" onClick={() => {
                      const invitationsTab = document.querySelector('[value="invitations"]') as HTMLElement;
                      invitationsTab?.click();
                    }}>
                      <Ticket className="mr-2 h-4 w-4" />
                      Generate Invitation Code
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {drivers.map((driver) => (
                  <Card key={driver.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex gap-4">
                          <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
                            <Users className="h-8 w-8 text-blue-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                {driver.user_profile?.full_name || 'Unknown Driver'}
                              </h3>
                              {getStatusBadge(driver.current_status)}
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                              {driver.user_profile?.phone || 'No phone'}
                            </p>
                            <div className="flex items-center gap-4 mt-2">
                              <div className="text-xs">
                                <span className="text-gray-500 dark:text-gray-400">Rating:</span>{' '}
                                <span className="font-medium text-gray-900 dark:text-gray-100">{driver.rating?.toFixed(1) || '0.0'}</span>
                              </div>
                              <div className="text-xs">
                                <span className="text-gray-500 dark:text-gray-400">Deliveries:</span>{' '}
                                <span className="font-medium text-gray-900 dark:text-gray-100">{driver.total_deliveries || 0}</span>
                              </div>
                            </div>
                            {driver.assigned_vehicle && (
                              <div className="mt-2 flex items-center gap-2 text-xs">
                                <Truck className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                                <span className="text-gray-600 dark:text-gray-300">
                                  Assigned to: {driver.assigned_vehicle.plate_number} ({driver.assigned_vehicle.vehicle_make} {driver.assigned_vehicle.vehicle_model})
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditDriver(driver)}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveDriver(driver.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="mr-2 h-4 w-4" />
                            Remove from Fleet
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Invitation Codes Tab */}
          <TabsContent value="invitations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Generate Invitation Code</CardTitle>
                <CardDescription>
                  Create invitation codes for partner drivers to join your fleet
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <Label>Expires In (Days)</Label>
                    <Select
                      value={codeExpiryDays.toString()}
                      onValueChange={(value) => setCodeExpiryDays(parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">7 days</SelectItem>
                        <SelectItem value="14">14 days</SelectItem>
                        <SelectItem value="30">30 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <Label>Max Uses</Label>
                    <Select
                      value={maxUses.toString()}
                      onValueChange={(value) => setMaxUses(parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Single use</SelectItem>
                        <SelectItem value="5">5 uses</SelectItem>
                        <SelectItem value="10">10 uses</SelectItem>
                        <SelectItem value="999">Unlimited</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleGenerateCode} disabled={isGeneratingCode}>
                    {isGeneratingCode ? 'Generating...' : 'Generate Code'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Invitation Codes</CardTitle>
                <CardDescription>Manage your fleet invitation codes</CardDescription>
              </CardHeader>
              <CardContent>
                {invitationCodes.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No invitation codes generated yet
                  </div>
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
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopyCode(code.code)}
                              >
                                {copiedCode === code.code ? (
                                  <Check className="h-4 w-4 text-green-600" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {formatDate(code.created_at)}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {formatDate(code.expires_at)}
                          </TableCell>
                          <TableCell>
                            {code.current_uses}/{code.max_uses}
                          </TableCell>
                          <TableCell>{getCodeStatus(code)}</TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {code.driver_name || '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {code.is_active && code.current_uses < code.max_uses && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeactivateCode(code.id)}
                                >
                                  Deactivate
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteCode(code.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
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

      {/* Edit Vehicle Dialog */}
      <Dialog open={isEditVehicleOpen} onOpenChange={setIsEditVehicleOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Vehicle</DialogTitle>
            <DialogDescription>Update vehicle information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Vehicle Type</Label>
              <Select
                value={vehicleForm.vehicle_type_id}
                onValueChange={(value) => setVehicleForm({ ...vehicleForm, vehicle_type_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select vehicle type" />
                </SelectTrigger>
                <SelectContent>
                  {vehicleTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Plate Number</Label>
              <Input
                value={vehicleForm.plate_number}
                onChange={(e) => setVehicleForm({ ...vehicleForm, plate_number: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Make</Label>
                <Input
                  value={vehicleForm.vehicle_make}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, vehicle_make: e.target.value })}
                />
              </div>
              <div>
                <Label>Model</Label>
                <Input
                  value={vehicleForm.vehicle_model}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, vehicle_model: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Year</Label>
                <Input
                  type="number"
                  value={vehicleForm.vehicle_year}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, vehicle_year: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <Label>Color</Label>
                <Input
                  value={vehicleForm.vehicle_color}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, vehicle_color: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Access Mode</Label>
                <p className="text-xs text-gray-500">
                  {vehicleForm.access_mode === 'private' ? 'Only for your deliveries' : 'Available to global pool when idle'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm">Private</span>
                <Switch
                  checked={vehicleForm.access_mode === 'public'}
                  onCheckedChange={(checked) => 
                    setVehicleForm({ ...vehicleForm, access_mode: checked ? 'public' : 'private' })
                  }
                />
                <span className="text-sm">Public</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditVehicleOpen(false)}>Cancel</Button>
            <Button onClick={handleEditVehicle}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
