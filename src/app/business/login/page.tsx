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

export default function BusinessLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        throw signInError;
      }

      if (!data.user) {
        throw new Error('No user data returned');
      }

      // Verify user is a business user
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('user_type')
        .eq('id', data.user.id)
        .single();

      if (profileError) {
        throw new Error('Failed to fetch user profile');
      }

      if (profile.user_type !== 'business') {
        await supabase.auth.signOut();
        throw new Error('This account is not a business account. Please use the correct login portal.');
      }

      // Redirect to dashboard
      router.push('/business/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

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
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Business Portal</h2>
          <p className="text-gray-600">Sign in to your business account</p>
        </div>

        {/* Login Form */}
        <Card className="rounded-3xl shadow-xl border border-gray-100 backdrop-blur-sm bg-white/95 transition-all duration-300 hover:shadow-2xl">
          <CardHeader className="pb-6">
            <CardTitle className="text-2xl font-bold text-gray-900">Business Login</CardTitle>
            <CardDescription className="text-gray-600">
              Enter your credentials to access the business portal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="business@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-[#1CB8F7] to-[#3B4CCA] hover:from-[#0FA5E4] hover:to-[#2C3BA0] transition-all duration-300 font-medium py-3 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5" 
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>

              <div className="text-center">
                <Link 
                  href="/business/forgot-password" 
                  className="text-sm text-blue-600 hover:text-blue-500"
                >
                  Forgot your password?
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Sign Up Link */}
        <div className="text-center mt-6">
          <p className="text-sm text-gray-600">
            Don't have a business account?{' '}
            <Link href="/business/signup" className="text-[#3B4CCA] hover:text-[#1CB8F7] font-medium transition-colors duration-300">
              Sign up here
            </Link>
          </p>
        </div>

        {/* Back to Home */}
        <div className="text-center mt-4">
          <Link href="/" className="text-sm text-gray-600 hover:text-gray-500">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}