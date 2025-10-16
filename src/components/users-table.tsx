'use client'

import React from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  MoreHorizontal, 
  Eye, 
  UserCheck, 
  UserX, 
  Shield, 
  Star,
  Truck,
  User,
  Building2,
  Crown
} from 'lucide-react'
import { UserProfile } from '@/lib/supabase/users-queries'

interface UsersTableProps {
  users: UserProfile[]
  isLoading?: boolean
  onViewUser?: (user: UserProfile) => void
  onUpdateStatus?: (userId: string, status: 'active' | 'inactive' | 'suspended') => void
  onDeleteUser?: (userId: string) => void
}

export function UsersTable({ 
  users, 
  isLoading = false, 
  onViewUser, 
  onUpdateStatus, 
  onDeleteUser 
}: UsersTableProps) {
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">Active</Badge>
      case 'inactive':
        return <Badge variant="secondary">Inactive</Badge>
      case 'suspended':
        return <Badge variant="destructive">Suspended</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getUserTypeIcon = (userType: string) => {
    switch (userType) {
      case 'driver':
        return <Truck className="h-4 w-4" />
      case 'customer':
        return <User className="h-4 w-4" />
      case 'business':
        return <Building2 className="h-4 w-4" />
      case 'admin':
        return <Crown className="h-4 w-4" />
      case 'crm':
        return <Shield className="h-4 w-4" />
      default:
        return <User className="h-4 w-4" />
    }
  }

  const getUserTypeBadge = (userType: string) => {
    const colors = {
      driver: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      customer: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
      business: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      admin: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
      crm: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
    }

    return (
      <Badge variant="outline" className={colors[userType as keyof typeof colors] || colors.customer}>
        <div className="flex items-center gap-1">
          {getUserTypeIcon(userType)}
          {userType.charAt(0).toUpperCase() + userType.slice(1)}
        </div>
      </Badge>
    )
  }

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
  }

  if (isLoading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Driver Info</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 10 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <div className="flex items-center space-x-3 animate-pulse">
                    <div className="h-8 w-8 bg-muted rounded-full"></div>
                    <div className="space-y-1">
                      <div className="h-4 bg-muted rounded w-24"></div>
                      <div className="h-3 bg-muted rounded w-32"></div>
                    </div>
                  </div>
                </TableCell>
                <TableCell><div className="h-6 bg-muted rounded w-16 animate-pulse"></div></TableCell>
                <TableCell><div className="h-6 bg-muted rounded w-16 animate-pulse"></div></TableCell>
                <TableCell><div className="h-4 bg-muted rounded w-24 animate-pulse"></div></TableCell>
                <TableCell><div className="h-4 bg-muted rounded w-20 animate-pulse"></div></TableCell>
                <TableCell><div className="h-4 bg-muted rounded w-16 animate-pulse"></div></TableCell>
                <TableCell><div className="h-8 w-8 bg-muted rounded animate-pulse"></div></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (users.length === 0) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Driver Info</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={7} className="text-center py-12">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <User className="h-8 w-8" />
                  <p>No users found</p>
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
            <TableHead>User</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Driver Info</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id} className="hover:bg-muted/50">
              <TableCell>
                <div className="flex items-center space-x-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.profile_image_url} />
                    <AvatarFallback className="text-xs">
                      {getInitials(user.first_name, user.last_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">
                      {user.first_name} {user.last_name}
                    </div>
                    {user.business_name && (
                      <div className="text-sm text-muted-foreground">
                        {user.business_name}
                      </div>
                    )}
                  </div>
                </div>
              </TableCell>
              
              <TableCell>
                {getUserTypeBadge(user.user_type)}
              </TableCell>
              
              <TableCell>
                {getStatusBadge(user.status)}
              </TableCell>
              
              <TableCell className="font-mono text-sm">
                {user.phone_number}
              </TableCell>
              
              <TableCell>
                {user.driver_profile ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {user.driver_profile.is_verified ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          <UserCheck className="h-3 w-3 mr-1" />
                          Verified
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                          <UserX className="h-3 w-3 mr-1" />
                          Pending
                        </Badge>
                      )}
                      {user.driver_profile.is_online && (
                        <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Star className="h-3 w-3" />
                      {user.driver_profile.rating?.toFixed(1) || 'N/A'} ({user.driver_profile.total_deliveries || 0} trips)
                    </div>
                    {user.driver_profile.vehicle_type && (
                      <div className="text-xs text-muted-foreground">
                        {user.driver_profile.vehicle_type}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              
              <TableCell className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
              </TableCell>
              
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => onViewUser?.(user)}>
                      <Eye className="mr-2 h-4 w-4" />
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {user.status !== 'active' && (
                      <DropdownMenuItem onClick={() => onUpdateStatus?.(user.id, 'active')}>
                        <UserCheck className="mr-2 h-4 w-4" />
                        Activate
                      </DropdownMenuItem>
                    )}
                    {user.status !== 'suspended' && (
                      <DropdownMenuItem onClick={() => onUpdateStatus?.(user.id, 'suspended')}>
                        <UserX className="mr-2 h-4 w-4" />
                        Suspend
                      </DropdownMenuItem>
                    )}
                    {user.status !== 'inactive' && (
                      <DropdownMenuItem onClick={() => onUpdateStatus?.(user.id, 'inactive')}>
                        <Shield className="mr-2 h-4 w-4" />
                        Deactivate
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