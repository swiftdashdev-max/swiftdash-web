'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Briefcase, Shield } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';

const roles = {
  business: {
    icon: <Briefcase className="h-5 w-5 mr-2" />,
    title: 'Business',
    dashboard: '/business/dashboard',
  },
  admin: {
    icon: <Shield className="h-5 w-5 mr-2" />,
    title: 'Admin',
    dashboard: '/admin/dashboard',
  },
  crm: {
    icon: <User className="h-5 w-5 mr-2" />,
    title: 'CRM',
    dashboard: '/crm/dashboard',
  },
};

type Role = keyof typeof roles;

export default function LoginPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<Role>('business');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // On successful login, Supabase sets a cookie and the middleware will handle the session.
    // We can now redirect to the appropriate dashboard.
    // A server component on the dashboard page should handle role verification.
    router.push(roles[selectedRole].dashboard);
    // No need to set loading to false here as we are navigating away.
  };

  return (
    <div className="relative min-h-screen w-full bg-background flex items-center justify-center p-4 overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 z-0">
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent"
          animate={{
            x: ['-100%', '100%'],
            y: ['-100%', '100%'],
            scale: [1, 1.5, 1],
            rotate: [0, 180, 360],
          }}
          transition={{
            duration: 40,
            ease: 'linear',
            repeat: Infinity,
            repeatType: 'reverse',
          }}
        />
        <motion.div
          className="absolute inset-0 bg-gradient-to-tl from-secondary/10 via-transparent to-transparent"
          animate={{
            x: ['100%', '-100%'],
            y: ['100%', '-100%'],
            scale: [1, 1.2, 1],
            rotate: [0, -180, -360],
          }}
          transition={{
            duration: 50,
            ease: 'linear',
            repeat: Infinity,
            repeatType: 'reverse',
            delay: 5,
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10"
      >
        <Card className="w-full max-w-md mx-auto shadow-2xl bg-background/80 backdrop-blur-lg">
          <CardHeader className="text-center">
            <Link href="/" className="flex justify-center mb-4">
              <Image
                src="/assets/images/swiftdash_logo.png"
                alt="SwiftDash Logo"
                width={48}
                height={48}
              />
            </Link>
            <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs
              value={selectedRole}
              onValueChange={(value) => setSelectedRole(value as Role)}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="business">
                  {roles.business.icon}
                  {roles.business.title}
                </TabsTrigger>
                <TabsTrigger value="admin">
                  {roles.admin.icon}
                  {roles.admin.title}
                </TabsTrigger>
                <TabsTrigger value="crm">
                  {roles.crm.icon}
                  {roles.crm.title}
                </TabsTrigger>
              </TabsList>
              <form onSubmit={handleLogin}>
                <div className="space-y-4 mt-6">
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
                      placeholder="you@example.com" 
                      required 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input 
                      id="password" 
                      type="password" 
                      required 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full mt-8" disabled={loading}>
                  {loading ? 'Logging in...' : `Login as ${roles[selectedRole].title}`}
                </Button>
                <div className="mt-4 text-center text-sm">
                  {selectedRole === 'business' && (
                    <p>
                      Don&apos;t have an account?{' '}
                      <Link href="/business/signup" className="underline">
                        Sign up
                      </Link>
                    </p>
                  )}
                   {selectedRole !== 'business' && (
                    <p className="text-muted-foreground">Internal access only.</p>
                  )}
                </div>
              </form>
            </Tabs>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}