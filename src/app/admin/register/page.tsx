'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createClient } from '@/lib/supabase/client';
import { Shield, CheckCircle2 } from 'lucide-react';

export default function AdminRegister() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    phoneNumber: '',
    secretKey: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Secret key for admin registration - change this in production
  const ADMIN_SECRET_KEY = process.env.NEXT_PUBLIC_ADMIN_REGISTRATION_KEY || 'swiftdash-admin-2025';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validate inputs
      if (!formData.email || !formData.password || !formData.fullName || !formData.secretKey) {
        setError('Please fill in all required fields');
        setLoading(false);
        return;
      }

      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        setLoading(false);
        return;
      }

      if (formData.password.length < 8) {
        setError('Password must be at least 8 characters long');
        setLoading(false);
        return;
      }

      if (formData.secretKey !== ADMIN_SECRET_KEY) {
        setError('Invalid admin secret key');
        setLoading(false);
        return;
      }

      // Create user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            user_type: 'admin',
          }
        }
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('Failed to create user account');
      }

      // Wait a moment for the database trigger to create the profile
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Split full name into first and last name
      const nameParts = formData.fullName.trim().split(' ');
      const firstName = nameParts[0] || 'Admin';
      const lastName = nameParts.slice(1).join(' ') || 'User';

      // Update the profile to set admin type (use upsert to avoid conflicts)
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          id: authData.user.id,
          phone_number: formData.phoneNumber || '+63000000000',
          first_name: firstName,
          last_name: lastName,
          user_type: 'admin',
        }, {
          onConflict: 'id'
        });

      if (profileError) {
        console.error('Profile update error:', profileError);
        throw new Error('Failed to update admin profile: ' + profileError.message);
      }

      setSuccess(true);
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push('/admin/login');
      }, 2000);

    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || 'An error occurred during registration');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50/50 via-white to-blue-50/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md rounded-3xl shadow-xl border border-green-200 bg-green-50">
          <CardContent className="pt-12 pb-8 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-green-900 mb-2">Registration Successful!</h2>
            <p className="text-green-700 mb-4">
              Your admin account has been created successfully.
            </p>
            <p className="text-sm text-green-600">
              Redirecting to login page...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50/50 via-white to-blue-50/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-6">
            <Image 
              src="/assets/images/swiftdash_logo.png" 
              alt="SwiftDash" 
              width={48} 
              height={48}
              className="mr-3 transition-transform duration-300 hover:scale-105"
            />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-[#1CB8F7] to-[#3B4CCA] bg-clip-text text-transparent">SwiftDash</h1>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Admin Registration</h2>
          <p className="text-gray-600">Create a new admin account</p>
        </div>

        {/* Registration Form */}
        <Card className="rounded-3xl shadow-xl border border-gray-100 backdrop-blur-sm bg-white/95 transition-all duration-300 hover:shadow-2xl">
          <CardHeader className="pb-6">
            <CardTitle className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Shield className="h-6 w-6 text-blue-600" />
              Register Admin
            </CardTitle>
            <CardDescription className="text-gray-600">
              Enter your details and admin secret key
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="John Doe"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@swiftdash.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number *</Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  placeholder="+63 912 345 6789"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Required for admin profile (format: +63XXXXXXXXXX)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Min. 8 characters"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password *</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Re-enter password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="secretKey">Admin Secret Key *</Label>
                <Input
                  id="secretKey"
                  type="password"
                  placeholder="Enter admin secret key"
                  value={formData.secretKey}
                  onChange={(e) => setFormData({ ...formData, secretKey: e.target.value })}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Contact your system administrator for the secret key
                </p>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-[#1CB8F7] to-[#3B4CCA] hover:from-[#0FA5E4] hover:to-[#2C3BA0] transition-all duration-300 font-medium py-3 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5" 
                disabled={loading}
              >
                {loading ? 'Creating Account...' : 'Create Admin Account'}
              </Button>

              <div className="text-center pt-4">
                <Link 
                  href="/admin/login" 
                  className="text-sm text-blue-600 hover:text-blue-500"
                >
                  Already have an account? Sign In
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Security Notice */}
        <Card className="mt-4 rounded-2xl border border-amber-200 bg-amber-50">
          <CardContent className="pt-4">
            <p className="text-sm text-amber-800">
              <strong>⚠️ Security Notice:</strong> The admin secret key is required to create admin accounts. Keep it confidential.
            </p>
          </CardContent>
        </Card>

        {/* Back to Home */}
        <div className="text-center mt-6">
          <Link href="/" className="text-sm text-gray-600 hover:text-gray-500">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
