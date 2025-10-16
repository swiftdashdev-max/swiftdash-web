'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3 } from 'lucide-react';
import Link from 'next/link';

export default function ReportsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Reports & Analytics</h1>
        <p className="text-muted-foreground">
          Access detailed reports and business insights
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Business Reports</CardTitle>
          <CardDescription>
            Generate and view custom reports for your business
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center min-h-[400px]">
          <BarChart3 className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">Coming Soon</h3>
          <p className="text-muted-foreground text-center mb-6 max-w-md">
            This page will provide comprehensive reporting capabilities including delivery performance,
            driver efficiency, customer satisfaction, and cost analysis. You'll be able to generate
            custom reports and export data for further analysis.
          </p>
          <Button asChild>
            <Link href="/business/dashboard">
              ← Back to Dashboard
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
