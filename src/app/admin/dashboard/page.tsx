import * as React from 'react';
import Image from 'next/image';
import {
  Activity,
  ArrowUpRight,
  CircleUser,
  CreditCard,
  DollarSign,
  Menu,
  Package2,
  Search,
  Users,
  Truck,
  UserCheck,
} from 'lucide-react';

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {mockDeliveries, mockDrivers} from '@/lib/data';
import {PlaceHolderImages} from '@/lib/placeholder-images';
import Link from 'next/link';

export default function Dashboard() {
  const mapImage = PlaceHolderImages.find(img => img.id === 'map-widget');
  const onlineDrivers = mockDrivers.filter(d => d.online).length;
  const pendingVerifications = mockDrivers.filter(d => d.status === 'Pending').length;
  const activeDeliveries = mockDeliveries.filter(
    d => d.status === 'In Transit' || d.status === 'Pending Pickup'
  ).length;

  return (
    <div className="flex min-h-screen w-full flex-col">
      <main className="flex flex-1 flex-col gap-4 md:gap-8">
        <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">$45,231.89</div>
              <p className="text-xs text-muted-foreground">+20.1% from last month</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Deliveries</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">+{activeDeliveries}</div>
              <p className="text-xs text-muted-foreground">Currently on the road</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Online Drivers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">+{onlineDrivers}</div>
              <p className="text-xs text-muted-foreground">{mockDrivers.length} total drivers</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Verifications</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">+{pendingVerifications}</div>
              <p className="text-xs text-muted-foreground">New drivers to approve</p>
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
          <Card className="xl:col-span-2 rounded-2xl shadow-sm">
            <CardHeader className="flex flex-row items-center">
              <div className="grid gap-2">
                <CardTitle>Recent Deliveries</CardTitle>
                <CardDescription>An overview of the latest deliveries.</CardDescription>
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
                    <TableHead>Customer</TableHead>
                    <TableHead className="hidden xl:table-column">Driver</TableHead>
                    <TableHead className="hidden xl:table-column">Status</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockDeliveries.slice(0, 5).map(delivery => {
                    const driverAvatar =
                      delivery.driver && PlaceHolderImages.find(img => img.id === delivery.driver.avatar);
                    return (
                      <TableRow key={delivery.id}>
                        <TableCell>
                          <div className="font-medium">{delivery.customerName}</div>
                          <div className="hidden text-sm text-muted-foreground md:inline">
                            {delivery.dropoffAddress}
                          </div>
                        </TableCell>
                        <TableCell className="hidden xl:table-column">
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
                            <span className="text-muted-foreground">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden xl:table-column">
                          <Badge className="text-xs" variant="outline">
                            {delivery.status}
                          </Badge>
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
              <CardDescription>Real-time driver and delivery distribution.</CardDescription>
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
