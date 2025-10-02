import Image from 'next/image';
import {MoreHorizontal, PlusCircle} from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {mockDrivers} from '@/lib/data';
import {PlaceHolderImages} from '@/lib/placeholder-images';
import {Avatar, AvatarFallback, AvatarImage} from '@/components/ui/avatar';
import {Separator} from '@/components/ui/separator';

const statusVariant: {[key: string]: 'default' | 'secondary' | 'destructive'} = {
  Approved: 'default',
  Pending: 'secondary',
  Rejected: 'destructive',
};

export default function DriversPage() {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle>Driver Verification</CardTitle>
        <CardDescription>
          Review and manage driver applications.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="hidden w-[100px] sm:table-cell">
                <span className="sr-only">Avatar</span>
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Vehicle</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockDrivers.map(driver => {
              const driverAvatar = PlaceHolderImages.find(img => img.id === driver.avatar);
              const licenseImage = PlaceHolderImages.find(img => img.id === `license${driver.avatar}`);
              return (
                <TableRow key={driver.id}>
                  <TableCell className="hidden sm:table-cell">
                    <Avatar className="h-10 w-10">
                      {driverAvatar && <AvatarImage src={driverAvatar.imageUrl} alt={driver.name} />}
                      <AvatarFallback>{driver.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium">
                    {driver.name}
                    <div className="text-sm text-muted-foreground">{driver.email}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[driver.status]}>{driver.status}</Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{driver.vehicle}</TableCell>
                  <TableCell>
                    <Dialog>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button aria-haspopup="true" size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Toggle menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DialogTrigger asChild>
                            <DropdownMenuItem>Review</DropdownMenuItem>
                          </DialogTrigger>
                          <DropdownMenuItem>View History</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <DialogContent className="sm:max-w-[625px]">
                        <DialogHeader>
                          <DialogTitle>Review Driver Application</DialogTitle>
                          <DialogDescription>
                            Review the driver's details and approve or reject their application.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-6 py-4">
                          <div className="flex items-center gap-4">
                            <Avatar className="h-16 w-16">
                              {driverAvatar && (
                                <AvatarImage src={driverAvatar.imageUrl} alt={driver.name} />
                              )}
                              <AvatarFallback>{driver.name.substring(0, 2)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <h3 className="text-lg font-semibold">{driver.name}</h3>
                              <p className="text-muted-foreground">{driver.email}</p>
                              <p className="text-sm text-muted-foreground">Vehicle: {driver.vehicle}</p>
                            </div>
                          </div>
                          <Separator />
                          <div>
                            <h4 className="mb-2 font-semibold">Driver's License</h4>
                            {licenseImage && (
                              <Image
                                src={licenseImage.imageUrl}
                                alt={`License of ${driver.name}`}
                                width={575}
                                height={350}
                                data-ai-hint={licenseImage.imageHint}
                                className="rounded-lg border object-cover"
                              />
                            )}
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline">Reject</Button>
                          <Button>Approve</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
