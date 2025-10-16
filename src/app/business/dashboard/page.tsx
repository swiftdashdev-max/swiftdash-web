'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Package, Calendar, DollarSign, Truck, Plus, Map, Download, TrendingUp, Clock, CheckCircle, AlertCircle
} from 'lucide-react';

// Mock data
const mockStats = {
  deliveriesToday: 12,
  deliveriesThisWeek: 47,
  monthlySpend: 45230.50,
  activeDrivers: 8,
  scheduledDeliveries: 15,
  activeDeliveries: 5,
};

const mockActiveDeliveries = [
  {
    id: 'DEL-001',
    status: 'in_transit',
    pickup: 'Makati City',
    dropoff: 'Quezon City',
    driver: 'Juan Dela Cruz',
    price: 250.00,
    estimatedTime: '25 mins',
  },
  {
    id: 'DEL-002',
    status: 'picking_up',
    pickup: 'BGC, Taguig',
    dropoff: 'Pasig City',
    driver: 'Maria Santos',
    price: 180.00,
    estimatedTime: '15 mins',
  },
  {
    id: 'DEL-003',
    status: 'in_transit',
    pickup: 'Manila',
    dropoff: 'Paranaque',
    driver: 'Pedro Reyes',
    price: 320.00,
    estimatedTime: '40 mins',
  },
];

const mockRecentDeliveries = [
  {
    id: 'DEL-098',
    date: '2025-10-16 10:30 AM',
    status: 'delivered',
    pickup: 'Makati',
    dropoff: 'Mandaluyong',
    price: 150.00,
  },
  {
    id: 'DEL-097',
    date: '2025-10-16 09:15 AM',
    status: 'delivered',
    pickup: 'QC',
    dropoff: 'BGC',
    price: 280.00,
  },
  {
    id: 'DEL-096',
    date: '2025-10-15 04:45 PM',
    status: 'delivered',
    pickup: 'Pasig',
    dropoff: 'Alabang',
    price: 420.00,
  },
];



export default function BusinessDashboard() {
  const [stats] = useState(mockStats);
  const [activeDeliveries] = useState(mockActiveDeliveries);
  const [recentDeliveries] = useState(mockRecentDeliveries);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'text-green-600 bg-green-50';
      case 'in_transit': return 'text-blue-600 bg-blue-50';
      case 'picking_up': return 'text-yellow-600 bg-yellow-50';
      case 'cancelled': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered': return <CheckCircle className="h-4 w-4" />;
      case 'in_transit': return <Truck className="h-4 w-4" />;
      case 'picking_up': return <Clock className="h-4 w-4" />;
      case 'cancelled': return <AlertCircle className="h-4 w-4" />;
      default: return <Package className="h-4 w-4" />;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Welcome Message */}
      <Card className="rounded-2xl shadow-lg border border-gray-100 mb-8">
          <CardHeader>
            <CardTitle className="text-2xl">Welcome to SwiftDash Business</CardTitle>
            <CardDescription>
              Manage your deliveries, track shipments, and grow your business with our comprehensive platform.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <p className="text-gray-600 mb-4">
              Create and manage deliveries, track your fleet, and access detailed analytics.
            </p>
            <div className="flex gap-4">
              <Button className="bg-green-600 hover:bg-green-700" asChild>
                <Link href="/business/deliveries/create">Create Delivery</Link>
              </Button>
              <Button variant="outline">View Reports</Button>
            </div>
          </CardContent>
        </Card>

        {/* Key Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8"
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Deliveries Today</CardTitle>

              <Package className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.deliveriesToday}</div>
              <p className="text-xs text-muted-foreground">
                {stats.deliveriesThisWeek} this week
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
              <Calendar className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.scheduledDeliveries}</div>
              <p className="text-xs text-muted-foreground">
                Upcoming deliveries
              </p>
            </CardContent>
          </Card>
          <Card>

            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Spend</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₱{stats.monthlySpend.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                <TrendingUp className="inline h-3 w-3 mr-1" />
                +12% from last month
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Drivers</CardTitle>
              <Truck className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeDrivers}</div>
              <p className="text-xs text-muted-foreground">
                {stats.activeDeliveries} deliveries in progress

              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks and shortcuts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Button
                  variant="outline"
                  className="h-auto py-4 flex-col gap-2"
                  asChild
                >
                  <Link href="/business/deliveries/create">
                    <Package className="h-6 w-6 text-blue-600" />
                    <span className="text-sm font-medium">New Delivery</span>
                  </Link>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-auto py-4 flex-col gap-2"
                  asChild
                >
                  <Link href="/business/deliveries/schedule">
                    <Calendar className="h-6 w-6 text-purple-600" />
                    <span className="text-sm font-medium">Schedule</span>
                  </Link>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-auto py-4 flex-col gap-2"
                  asChild
                >
                  <Link href="/business/deliveries/map">
                    <Map className="h-6 w-6 text-green-600" />
                    <span className="text-sm font-medium">Live Map</span>
                  </Link>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-auto py-4 flex-col gap-2"
                  asChild
                >
                  <Link href="/business/invoices">
                    <Download className="h-6 w-6 text-orange-600" />
                    <span className="text-sm font-medium">Invoices</span>
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Active & Recent Deliveries */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Tabs defaultValue="active" className="space-y-4">
            <TabsList>
              <TabsTrigger value="active">
                Active Deliveries ({activeDeliveries.length})
              </TabsTrigger>

              <TabsTrigger value="recent">
                Recent Deliveries
              </TabsTrigger>
            </TabsList>
            <TabsContent value="active" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Active Deliveries</CardTitle>
                      <CardDescription>Track your ongoing deliveries</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/business/deliveries/map">
                        <Map className="mr-2 h-4 w-4" />
                        View Map
                      </Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {activeDeliveries.map((delivery) => (
                      <div

                        key={delivery.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-lg ${getStatusColor(delivery.status)}`}>
                            {getStatusIcon(delivery.status)}
                          </div>
                          <div>
                            <div className="font-medium">{delivery.id}</div>
                            <div className="text-sm text-gray-600">
                              {delivery.pickup} → {delivery.dropoff}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              Driver: {delivery.driver} • ETA: {delivery.estimatedTime}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">₱{delivery.price.toFixed(2)}</div>
                          <Button variant="ghost" size="sm" className="mt-1">
                            Track
                          </Button>
                        </div>
                      </div>

                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="recent" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Deliveries</CardTitle>
                  <CardDescription>Your delivery history</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {recentDeliveries.map((delivery) => (
                      <div 
                        key={delivery.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-lg ${getStatusColor(delivery.status)}`}>
                            {getStatusIcon(delivery.status)}
                          </div>
                          <div>
                            <div className="font-medium">{delivery.id}</div>

                            <div className="text-sm text-gray-600">
                              {delivery.pickup} → {delivery.dropoff}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {delivery.date}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">₱{delivery.price.toFixed(2)}</div>
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(delivery.status)}`}>
                            {getStatusIcon(delivery.status)}
                            {delivery.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 text-center">
                    <Button variant="outline" asChild>
                      <Link href="/business/deliveries">View All Deliveries</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
  );
}
