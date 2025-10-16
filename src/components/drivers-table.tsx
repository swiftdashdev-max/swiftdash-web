'use client'

import React from 'react'
import { MoreHorizontal, Eye, CheckCircle, X, Star, MapPin, Phone, Truck, Calendar, DollarSign } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { DriverProfile } from '@/lib/supabase/driver-queries'

interface DriversTableProps {
  drivers: DriverProfile[]
  isLoading: boolean
  onViewDriver: (driver: DriverProfile) => void
  onUpdateVerification: (userId: string, isVerified: boolean) => void
  onUpdateOnlineStatus: (userId: string, isOnline: boolean) => void
}

export function DriversTable({
  drivers,
  isLoading,
  onViewDriver,
  onUpdateVerification,
  onUpdateOnlineStatus
}: DriversTableProps) {
  
  const getStatusBadge = (driver: DriverProfile) => {
    if (driver.user_profile?.status === 'suspended') {
      return <Badge variant="destructive">Suspended</Badge>
    }
    if (!driver.is_verified) {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending</Badge>
    }
    return <Badge variant="default" className="bg-green-100 text-green-800">Verified</Badge>
  }

  const getOnlineBadge = (isOnline: boolean) => {
    return (
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-green-600' : 'bg-gray-400'}`} />
        <span className="text-sm">{isOnline ? 'Online' : 'Offline'}</span>
      </div>
    )
  }

  const getRatingStars = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
        <span className="text-sm font-medium">{rating.toFixed(1)}</span>
      </div>
    )
  }

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount)
  }

  if (isLoading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Driver</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Online</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Deliveries</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead>Earnings</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 10 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <div className="flex items-center space-x-3 animate-pulse">
                    <div className="h-10 w-10 bg-muted rounded-full"></div>
                    <div className="space-y-1">
                      <div className="h-4 bg-muted rounded w-24"></div>
                      <div className="h-3 bg-muted rounded w-32"></div>
                    </div>
                  </div>
                </TableCell>
                <TableCell><div className="h-6 bg-muted rounded w-20 animate-pulse"></div></TableCell>
                <TableCell><div className="h-4 bg-muted rounded w-16 animate-pulse"></div></TableCell>
                <TableCell><div className="h-4 bg-muted rounded w-16 animate-pulse"></div></TableCell>
                <TableCell><div className="h-4 bg-muted rounded w-12 animate-pulse"></div></TableCell>
                <TableCell><div className="h-4 bg-muted rounded w-20 animate-pulse"></div></TableCell>
                <TableCell><div className="h-4 bg-muted rounded w-16 animate-pulse"></div></TableCell>
                <TableCell><div className="h-4 bg-muted rounded w-20 animate-pulse"></div></TableCell>
                <TableCell><div className="h-8 w-8 bg-muted rounded animate-pulse"></div></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (drivers.length === 0) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Driver</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Online</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Deliveries</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead>Earnings</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={9} className="text-center py-12">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Truck className="h-8 w-8" />
                  <p>No drivers found</p>
                  <p className="text-sm">Try adjusting your search or filters</p>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Driver</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Online</TableHead>
            <TableHead>Rating</TableHead>
            <TableHead>Deliveries</TableHead>
            <TableHead>Vehicle</TableHead>
            <TableHead>Earnings</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {drivers.map((driver) => (
            <TableRow key={driver.id} className="cursor-pointer hover:bg-muted/50">
              <TableCell>
                <div className="flex items-center space-x-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage 
                      src={driver.user_profile?.profile_image_url} 
                      alt={`${driver.user_profile?.first_name} ${driver.user_profile?.last_name}`}
                    />
                    <AvatarFallback>
                      {driver.user_profile ? 
                        getInitials(driver.user_profile.first_name, driver.user_profile.last_name) : 
                        'DR'
                      }
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {driver.user_profile ? 
                        `${driver.user_profile.first_name} ${driver.user_profile.last_name}` : 
                        'Unknown Driver'
                      }
                    </p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      {driver.user_profile?.phone_number || 'No phone'}
                    </div>
                  </div>
                </div>
              </TableCell>

              <TableCell>
                {getStatusBadge(driver)}
              </TableCell>

              <TableCell>
                {getOnlineBadge(driver.is_online)}
              </TableCell>

              <TableCell>
                {getRatingStars(driver.rating)}
              </TableCell>

              <TableCell>
                <div className="text-sm font-medium">
                  {driver.total_deliveries}
                </div>
              </TableCell>

              <TableCell>
                <div className="flex items-center gap-1">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {driver.vehicle_type?.name || 'Not set'}
                  </span>
                </div>
                {driver.vehicle_plate_number && (
                  <div className="text-xs text-muted-foreground font-mono">
                    {driver.vehicle_plate_number}
                  </div>
                )}
              </TableCell>

              <TableCell>
                <div className="text-sm font-medium">
                  {formatCurrency(driver.total_earnings || 0)}
                </div>
              </TableCell>

              <TableCell>
                <div className="text-sm">
                  {new Date(driver.created_at).toLocaleDateString()}
                </div>
              </TableCell>

              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    
                    <DropdownMenuItem onClick={() => onViewDriver(driver)}>
                      <Eye className="mr-2 h-4 w-4" />
                      View Details
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    {/* Verification Actions */}
                    {!driver.is_verified ? (
                      <DropdownMenuItem 
                        onClick={() => onUpdateVerification(driver.user_id, true)}
                        className="text-green-600"
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Verify Driver
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem 
                        onClick={() => onUpdateVerification(driver.user_id, false)}
                        className="text-orange-600"
                      >
                        <X className="mr-2 h-4 w-4" />
                        Revoke Verification
                      </DropdownMenuItem>
                    )}

                    {/* Online Status Actions */}
                    {driver.is_online ? (
                      <DropdownMenuItem 
                        onClick={() => onUpdateOnlineStatus(driver.user_id, false)}
                        className="text-gray-600"
                      >
                        <MapPin className="mr-2 h-4 w-4" />
                        Set Offline
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem 
                        onClick={() => onUpdateOnlineStatus(driver.user_id, true)}
                        className="text-green-600"
                      >
                        <MapPin className="mr-2 h-4 w-4" />
                        Set Online
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}