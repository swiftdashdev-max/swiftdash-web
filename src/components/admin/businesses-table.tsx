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
import { 
  MoreHorizontal, 
  CheckCircle,
  XCircle,
  Building2
} from 'lucide-react'
import { BusinessAccount } from '@/lib/supabase/businesses-queries'

interface BusinessesTableProps {
  businesses: BusinessAccount[]
  isLoading?: boolean
  onUpdateStatus?: (businessId: string, status: BusinessAccount['account_status']) => void
}

export function BusinessesTable({ 
  businesses, 
  isLoading = false, 
  onUpdateStatus
}: BusinessesTableProps) {
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">Active</Badge>
      case 'pending_approval':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">Pending Approval</Badge>
      case 'suspended':
        return <Badge variant="destructive">Suspended</Badge>
      case 'trial':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">Trial</Badge>
      case 'cancelled':
        return <Badge variant="secondary">Cancelled</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Business</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 10 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <div className="flex items-center space-x-3 animate-pulse">
                    <div className="space-y-1">
                      <div className="h-4 bg-muted rounded w-32"></div>
                      <div className="h-3 bg-muted rounded w-24"></div>
                    </div>
                  </div>
                </TableCell>
                <TableCell><div className="h-4 bg-muted rounded w-32 animate-pulse"></div></TableCell>
                <TableCell><div className="h-6 bg-muted rounded w-24 animate-pulse"></div></TableCell>
                <TableCell><div className="h-4 bg-muted rounded w-24 animate-pulse"></div></TableCell>
                <TableCell><div className="h-8 w-8 bg-muted rounded animate-pulse"></div></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (businesses.length === 0) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Business</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={5} className="text-center py-12">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Building2 className="h-8 w-8" />
                  <p>No businesses found</p>
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
            <TableHead>Business</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {businesses.map((business) => (
            <TableRow key={business.id} className="hover:bg-muted/50">
              <TableCell>
                <div>
                  <div className="font-medium text-primary">
                    {business.business_name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {business.business_email}
                  </div>
                </div>
              </TableCell>
              
              <TableCell>
                <div>
                  <div className="font-medium">
                    {business.primary_contact_name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {business.primary_contact_phone}
                  </div>
                </div>
              </TableCell>
              
              <TableCell>
                {getStatusBadge(business.account_status)}
              </TableCell>
              
              <TableCell className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(business.created_at), { addSuffix: true })}
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
                    {business.account_status === 'pending_approval' && (
                      <DropdownMenuItem onClick={() => onUpdateStatus?.(business.id, 'active')}>
                        <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                        <span className="text-green-600 font-medium">Approve</span>
                      </DropdownMenuItem>
                    )}
                    {business.account_status !== 'pending_approval' && business.account_status !== 'active' && (
                      <DropdownMenuItem onClick={() => onUpdateStatus?.(business.id, 'active')}>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Set Active
                      </DropdownMenuItem>
                    )}
                    {business.account_status !== 'suspended' && (
                      <DropdownMenuItem onClick={() => onUpdateStatus?.(business.id, 'suspended')}>
                        <XCircle className="mr-2 h-4 w-4 text-red-600" />
                        <span className="text-red-600">Suspend</span>
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
