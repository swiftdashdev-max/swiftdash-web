import {
  File,
  ListFilter,
  MoreHorizontal,
  PlusCircle,
  Search,
  Users,
  MessageSquare,
} from 'lucide-react';

import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {Input} from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs';
import {mockTickets} from '@/lib/data';
import {Avatar, AvatarFallback, AvatarImage} from '@/components/ui/avatar';
import {PlaceHolderImages} from '@/lib/placeholder-images';
import {formatDistanceToNow} from 'date-fns';

const priorityVariant: {[key: string]: 'default' | 'secondary' | 'destructive'} = {
  High: 'destructive',
  Medium: 'secondary',
  Low: 'default',
};

export default function CrmPage() {
  return (
    <div className="grid flex-1 items-start gap-4 md:gap-8">
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle>Avg. Response Time</CardTitle>
            <CardDescription className="text-xs">Last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">34 mins</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle>Resolution Rate</CardTitle>
            <CardDescription className="text-xs">Last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">92%</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle>New Tickets</CardTitle>
            <CardDescription className="text-xs">Today</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle>Open Tickets</CardTitle>
            <CardDescription className="text-xs">Total</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">45</div>
          </CardContent>
        </Card>
      </div>
      <Tabs defaultValue="tickets">
        <div className="flex items-center">
          <TabsList>
            <TabsTrigger value="tickets">
              <MessageSquare className="mr-2 h-4 w-4" /> Tickets
            </TabsTrigger>
            <TabsTrigger value="customers">
              <Users className="mr-2 h-4 w-4" /> Customers
            </TabsTrigger>
          </TabsList>
          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1">
                  <ListFilter className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Filter</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Filter by</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem checked>Open</DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem>In Progress</DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem>Closed</DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" variant="outline" className="h-8 gap-1">
              <File className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Export</span>
            </Button>
            <Button size="sm" className="h-8 gap-1">
              <PlusCircle className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">New Ticket</span>
            </Button>
          </div>
        </div>
        <TabsContent value="tickets">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="px-7">
              <CardTitle>Support Tickets</CardTitle>
              <CardDescription>Recent customer inquiries and issues.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead className="hidden sm:table-cell">Subject</TableHead>
                    <TableHead className="hidden sm:table-cell">Status</TableHead>
                    <TableHead className="hidden md:table-cell">Priority</TableHead>
                    <TableHead className="text-right">Last Update</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockTickets.map(ticket => {
                    const customerAvatar = PlaceHolderImages.find(
                      img => img.id === ticket.customer.avatar
                    );
                    return (
                      <TableRow key={ticket.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              {customerAvatar && (
                                <AvatarImage
                                  src={customerAvatar.imageUrl}
                                  alt={ticket.customer.name}
                                />
                              )}
                              <AvatarFallback>{ticket.customer.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="font-medium">{ticket.customer.name}</div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">{ticket.subject}</TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge className="text-xs" variant="outline">
                            {ticket.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant={priorityVariant[ticket.priority]}>{ticket.priority}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatDistanceToNow(ticket.lastUpdate, {addSuffix: true})}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="customers">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle>Customers</CardTitle>
              <CardDescription>Manage your customers.</CardDescription>
            </CardHeader>
            <CardContent>
              <p>Customer management interface goes here.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
