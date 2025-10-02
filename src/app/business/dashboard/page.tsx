import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {ArrowUpRight, PlusCircle, Calendar, Truck, DollarSign} from 'lucide-react';
import {Avatar, AvatarFallback, AvatarImage} from '@/components/ui/avatar';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {mockDeliveries} from '@/lib/data';
import {PlaceHolderImages} from '@/lib/placeholder-images';

export default function BusinessDashboard() {
  const mapImage = PlaceHolderImages.find(img => img.id === 'map-widget');
  const deliveriesToday = mockDeliveries.filter(
    d => new Date(d.scheduledTime).toDateString() === new Date().toDateString()
  ).length;
  const scheduledJobs = mockDeliveries.filter(d => d.status === 'Pending Pickup').length;

  return (
    <div className="flex min-h-screen w-full flex-col">
      <main className="flex flex-1 flex-col gap-4 md:gap-8">
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Button asChild size="lg" className="h-20 flex-col gap-1">
                <Link href="/business/deliveries/new">
                  <PlusCircle className="h-6 w-6" />
                  <span className="text-base">New Delivery</span>
                </Link>
              </Button>
              <Button asChild variant="secondary" size="lg" className="h-20 flex-col gap-1">
                <Link href="/business/deliveries/new">
                  <Calendar className="h-6 w-6" />
                  <span className="text-base">Schedule Job</span>
                </Link>
              </Button>
            </CardContent>
          </Card>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Deliveries Today</CardTitle>
                <Truck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{deliveriesToday}</div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Scheduled Jobs</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{scheduledJobs}</div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Monthly Spend</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$2,450.60</div>
              </CardContent>
            </Card>
          </div>
        </div>
        <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
          <Card className="xl:col-span-2 rounded-2xl shadow-sm">
            <CardHeader className="flex flex-row items-center">
              <div className="grid gap-2">
                <CardTitle>Recent Deliveries</CardTitle>
                <CardDescription>An overview of your latest deliveries.</CardDescription>
              </div>
              <Button asChild size="sm" className="ml-auto gap-1">
                <Link href="#">
                  View All
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Delivery ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Driver</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockDeliveries.slice(0, 5).map(delivery => {
                    const driverAvatar =
                      delivery.driver &&
                      PlaceHolderImages.find(img => img.id === delivery.driver?.avatar);
                    return (
                      <TableRow key={delivery.id}>
                        <TableCell>
                          <div className="font-medium">{delivery.id}</div>
                          <div className="text-sm text-muted-foreground">
                            to {delivery.dropoffAddress}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className="text-xs" variant="outline">
                            {delivery.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {delivery.driver ? (
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                {driverAvatar && (
                                  <AvatarImage src={driverAvatar.imageUrl} alt={delivery.driver.name} />
                                )}
                                <AvatarFallback>{delivery.driver.name.charAt(0)}</AvatarFallback>
                              </Avatar>
                              <span>{delivery.driver.name}</span>
                            </div>
                          ) : (
                            'Unassigned'
                          )}
                        </TableCell>
                        <TableCell className="text-right">${delivery.price.toFixed(2)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card className="rounded-2xl shadow-sm overflow-hidden">
            <CardHeader>
              <CardTitle>Active Delivery Map</CardTitle>
              <CardDescription>Track your active deliveries in real-time.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {mapImage && (
                <Image
                  alt="Map of active deliveries"
                  className="aspect-[16/9] w-full object-cover"
                  data-ai-hint={mapImage.imageHint}
                  height="400"
                  src={mapImage.imageUrl}
                  width="600"
                />
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
