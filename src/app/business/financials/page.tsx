'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign } from 'lucide-react';
import Link from 'next/link';

export default function FinancialsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Financials</h1>
        <p className="text-muted-foreground">
          Track your spending, invoices, and financial performance
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Financial Overview</CardTitle>
          <CardDescription>
            Monitor your spending, revenue, and payment history
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center min-h-[400px]">
          <DollarSign className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">Coming Soon</h3>
          <p className="text-muted-foreground text-center mb-6 max-w-md">
            This page will provide detailed financial analytics including spending trends,
            invoices, payment history, and cost per delivery. You'll be able to download
            financial reports and track your budget.
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
