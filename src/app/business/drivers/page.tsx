'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Truck, UserPlus } from 'lucide-react';
import Link from 'next/link';

export default function DriversPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Driver Management</h1>
        <p className="text-muted-foreground">
          Manage your fleet and driver performance
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fleet Management</CardTitle>
          <CardDescription>
            View driver profiles, performance metrics, and manage availability
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center min-h-[400px]">
          <Truck className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">Coming Soon</h3>
          <p className="text-muted-foreground text-center mb-6 max-w-md">
            This page will display a list of all drivers with their availability status, performance metrics
            (completed deliveries, ratings), and assigned areas. You'll be able to view detailed driver profiles,
            add new drivers, remove drivers, and invite new drivers to join your fleet.
          </p>
          <div className="flex gap-4">
            <Button asChild>
              <Link href="/business/dashboard">
                ← Back to Dashboard
              </Link>
            </Button>
            <Button variant="outline" disabled>
              <UserPlus className="h-4 w-4 mr-2" />
              Invite Driver
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
