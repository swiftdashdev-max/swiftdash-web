'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUserContext } from '@/lib/supabase/user-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import {
  User,
  Building2,
  Phone,
  Mail,
  Shield,
  Lock,
  Save,
  Loader2,
  Calendar,
  BadgeCheck,
  Eye,
  EyeOff,
} from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  dispatcher: 'Dispatcher',
  viewer: 'Viewer',
};

const TIER_LABELS: Record<string, string> = {
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
};

const TIER_COLORS: Record<string, string> = {
  starter: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  professional: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  enterprise: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
};

export default function ProfilePage() {
  const { user, businessId, loading: userLoading } = useUserContext();
  const { toast } = useToast();
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Profile fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [businessRole, setBusinessRole] = useState('');

  // Business info (read-only)
  const [businessName, setBusinessName] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [subscriptionTier, setSubscriptionTier] = useState('starter');
  const [accountStatus, setAccountStatus] = useState('active');
  const [memberSince, setMemberSince] = useState('');

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  useEffect(() => {
    if (userLoading) return;
    if (!user) { router.push('/business/login'); return; }
    if (!businessId) return;
    fetchProfile();
  }, [user, businessId, userLoading]);

  const fetchProfile = async () => {
    try {
      setLoading(true);

      const [profileRes, businessRes] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('first_name, last_name, phone_number, business_role, created_at')
          .eq('id', user!.id)
          .single(),
        supabase
          .from('business_accounts')
          .select('business_name, business_email, business_phone, business_address, subscription_tier, account_status, created_at')
          .eq('id', businessId!)
          .single(),
      ]);

      if (profileRes.data) {
        setFirstName(profileRes.data.first_name || '');
        setLastName(profileRes.data.last_name || '');
        setPhone(profileRes.data.phone_number || '');
        setBusinessRole(profileRes.data.business_role || '');
        setMemberSince(profileRes.data.created_at
          ? new Date(profileRes.data.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
          : '');
      }

      if (businessRes.data) {
        setBusinessName(businessRes.data.business_name || '');
        setBusinessEmail(businessRes.data.business_email || '');
        setBusinessPhone(businessRes.data.business_phone || '');
        setBusinessAddress(businessRes.data.business_address || '');
        setSubscriptionTier(businessRes.data.subscription_tier || 'starter');
        setAccountStatus(businessRes.data.account_status || 'active');
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = () => {
    if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
    if (firstName) return firstName.substring(0, 2).toUpperCase();
    return user?.email?.substring(0, 2).toUpperCase() || 'BZ';
  };

  const handleSaveProfile = async () => {
    try {
      setSavingProfile(true);
      const { error } = await supabase
        .from('user_profiles')
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone_number: phone.trim() || null,
        })
        .eq('id', user!.id);

      if (error) throw error;
      toast({ title: 'Profile updated', description: 'Your personal information has been saved.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to save profile.', variant: 'destructive' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword) return;
    if (newPassword !== confirmPassword) {
      toast({ title: 'Passwords do not match', description: 'New password and confirmation must match.', variant: 'destructive' });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: 'Password too short', description: 'Password must be at least 8 characters.', variant: 'destructive' });
      return;
    }

    try {
      setSavingPassword(true);
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast({ title: 'Password changed', description: 'Your password has been updated successfully.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to change password.', variant: 'destructive' });
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading || userLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarFallback className="text-lg font-bold bg-gradient-to-br from-[#1CB8F7] to-[#3B4CCA] text-white">
            {getInitials()}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold">
            {firstName && lastName ? `${firstName} ${lastName}` : user?.email}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            {businessRole && (
              <Badge variant="secondary">{ROLE_LABELS[businessRole] || businessRole}</Badge>
            )}
            <span className="text-sm text-muted-foreground">{user?.email}</span>
          </div>
          {memberSince && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <Calendar className="h-3 w-3" />
              Member since {memberSince}
            </p>
          )}
        </div>
      </div>

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            Personal Information
          </CardTitle>
          <CardDescription>Update your name and contact number</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Juan"
              />
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Dela Cruz"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              Email Address
            </Label>
            <Input value={user?.email || ''} disabled className="bg-muted cursor-not-allowed" />
            <p className="text-xs text-muted-foreground">Email cannot be changed here. Contact support if needed.</p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              Phone Number
            </Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+63 9XX XXX XXXX"
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveProfile} disabled={savingProfile} size="sm">
              {savingProfile ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Business Account */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4" />
            Business Account
          </CardTitle>
          <CardDescription>Your business details — manage these in Settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">{businessName}</p>
              <p className="text-xs text-muted-foreground">{businessEmail}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={TIER_COLORS[subscriptionTier] || TIER_COLORS.starter}>
                {TIER_LABELS[subscriptionTier] || subscriptionTier}
              </Badge>
              {accountStatus === 'active' && (
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 flex items-center gap-1">
                  <BadgeCheck className="h-3 w-3" />
                  Active
                </Badge>
              )}
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {businessPhone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                <span>{businessPhone}</span>
              </div>
            )}
            {businessAddress && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{businessAddress}</span>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => router.push('/business/settings')}>
              Manage in Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Role & Permissions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" />
            Role & Permissions
          </CardTitle>
          <CardDescription>Your access level within this business account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{ROLE_LABELS[businessRole] || businessRole || 'Member'}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {businessRole === 'owner' && 'Full access to all features and settings'}
                {businessRole === 'admin' && 'Can manage orders, team, and most settings'}
                {businessRole === 'dispatcher' && 'Can create and manage deliveries'}
                {businessRole === 'viewer' && 'Read-only access to orders and reports'}
                {!businessRole && 'Contact your account owner to assign a role'}
              </p>
            </div>
            {businessRole && (
              <Badge variant="outline">{ROLE_LABELS[businessRole] || businessRole}</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4" />
            Change Password
          </CardTitle>
          <CardDescription>Choose a strong password of at least 8 characters</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>New Password</Label>
            <div className="relative">
              <Input
                type={showNewPw ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 8 characters"
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowNewPw(v => !v)}
              >
                {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Confirm New Password</Label>
            <div className="relative">
              <Input
                type={showConfirmPw ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowConfirmPw(v => !v)}
              >
                {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-destructive">Passwords do not match</p>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleChangePassword}
              disabled={savingPassword || !newPassword || newPassword !== confirmPassword}
              size="sm"
            >
              {savingPassword ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
              Update Password
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
