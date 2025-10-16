'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, User, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { Reveal } from '@/components/animations';
import { ThemeToggle } from '@/components/theme-toggle';
import { useRouter } from 'next/navigation';
import { useDriverAuth } from '@/hooks/use-driver-auth';

export default function DriverLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const { user, isLoading: authLoading, login } = useDriverAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      router.push('/driver-verification');
    }
  }, [user, authLoading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const result = await login(email, password);
    
    if (result.success) {
      router.push('/driver-verification');
    } else {
      setError(result.error || 'Login failed');
    }
  };

  // Show loading while checking existing auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if user is already logged in (will redirect)
  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/assets/images/swiftdash_logo.png"
              alt="SwiftDash Logo"
              width={32}
              height={32}
            />
            <span className="text-xl font-bold text-foreground">SwiftDash</span>
          </Link>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Button asChild variant="ghost">
              <Link href="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <Reveal>
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Driver Portal
              </h1>
              <p className="text-muted-foreground">
                Sign in to complete your verification process
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.2}>
            <Card>
              <CardHeader>
                <CardTitle>Sign In</CardTitle>
                <CardDescription>
                  Use the same credentials from your SwiftDash mobile app
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                        disabled={authLoading}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10"
                        required
                        disabled={authLoading}
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={authLoading}>
                    {authLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing In...
                      </>
                    ) : (
                      'Sign In'
                    )}
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    Don't have an account?{' '}
                    <Link href="#" className="text-primary hover:underline">
                      Download the SwiftDash app
                    </Link>
                  </p>
                </div>

                <div className="mt-4 text-center">
                  <Link href="#" className="text-sm text-primary hover:underline">
                    Forgot your password?
                  </Link>
                </div>
              </CardContent>
            </Card>
          </Reveal>

          <Reveal delay={0.4}>
            <div className="mt-8 p-6 bg-muted/50 rounded-lg">
              <h3 className="font-medium text-foreground mb-2">Need Help?</h3>
              <p className="text-sm text-muted-foreground mb-3">
                If you're having trouble accessing your account, please contact our support team.
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link href="#contact">Contact Support</Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </main>
    </div>
  );
}