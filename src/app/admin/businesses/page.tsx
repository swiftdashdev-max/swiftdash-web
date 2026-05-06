'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Building2, Building, BuildingIcon, Clock, CheckCircle } from 'lucide-react'
import AdminLayout from '@/components/admin-layout'
import { BusinessesTable } from '@/components/admin/businesses-table'
import { MetricCard } from '@/components/ui/metric-card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import {
  searchBusinesses,
  getBusinessStats,
  updateBusinessStatus,
  type BusinessAccount,
  type BusinessFilters,
  type PaginatedBusinessResponse
} from '@/lib/supabase/businesses-queries'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function BusinessesPage() {
  const { toast } = useToast()
  
  // State management
  const [businesses, setBusinesses] = useState<BusinessAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filters, setFilters] = useState<BusinessFilters>({})
  const [totalCount, setTotalCount] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  
  // Stats state
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    active: 0
  })

  // Fetch businesses data
  const fetchBusinesses = useCallback(async (page = 1, reset = true) => {
    try {
      setIsLoading(true)
      const response: PaginatedBusinessResponse = await searchBusinesses(filters, page, 50)
      
      if (reset) {
        setBusinesses(response.businesses)
      } else {
        setBusinesses(prev => [...prev, ...response.businesses])
      }
      
      setTotalCount(response.totalCount)
      setHasMore(response.hasMore)
      setCurrentPage(page)
    } catch (error) {
      console.error('Error fetching businesses:', error)
      toast({
        title: "Error",
        description: "Failed to fetch businesses. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [filters, toast])

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const statsData = await getBusinessStats()
      setStats(statsData)
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }, [])

  // Load more users (pagination)
  const loadMore = () => {
    if (hasMore && !isLoading) {
      fetchBusinesses(currentPage + 1, false)
    }
  }

  // Handle status update
  const handleUpdateStatus = async (businessId: string, status: BusinessAccount['account_status']) => {
    try {
      const result = await updateBusinessStatus(businessId, status)
      
      if (result.success) {
        toast({
          title: "Success",
          description: `Business account updated to ${status}`,
        })
        
        // Update local state
        setBusinesses(prev => prev.map(bus => 
          bus.id === businessId ? { ...bus, account_status: status } : bus
        ))
        
        // Refresh stats
        fetchStats()
      } else {
        throw new Error('Failed to update status')
      }
    } catch (error) {
      console.error('Error updating status:', error)
      toast({
        title: "Error",
        description: "Failed to update business status. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Initial data fetch
  useEffect(() => {
    fetchBusinesses()
    fetchStats()
  }, [fetchBusinesses, fetchStats])

  return (
    <AdminLayout currentPath="/admin/businesses">
      <div className="flex-1 space-y-6 p-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Business Accounts</h1>
              <p className="text-muted-foreground">
                Manage business registrations and approvals
              </p>
            </div>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid gap-4 md:grid-cols-3 lg:grid-cols-3"
        >
          <MetricCard
            title="Total Businesses"
            value={stats.total}
            icon={Building2}
            iconColor="text-blue-600"
            description="All registered businesses"
          />
          
          <MetricCard
            title="Pending Approval"
            value={stats.pending}
            icon={Clock}
            iconColor="text-yellow-600"
            description="Awaiting admin review"
            badge={stats.pending > 0 ? { text: "Action Needed", variant: "default" } : undefined}
          />
          
          <MetricCard
            title="Active Accounts"
            value={stats.active}
            icon={CheckCircle}
            iconColor="text-green-600"
            description="Currently active"
          />
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-4 mb-6"
        >
          <div className="flex-1 max-w-sm">
             <Input
                placeholder="Search businesses..."
                value={filters.search || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
             />
          </div>
          <Select 
            value={filters.status || 'all'} 
            onValueChange={(val) => setFilters(prev => ({ ...prev, status: val }))}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending_approval">Pending</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </motion.div>

        {/* Businesses Table */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="space-y-4"
        >
          <BusinessesTable
            businesses={businesses}
            isLoading={isLoading}
            onUpdateStatus={handleUpdateStatus}
          />

          {/* Load More Button */}
          {hasMore && !isLoading && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={loadMore}>
                Load More Businesses
              </Button>
            </div>
          )}

          {/* Loading More Indicator */}
          {isLoading && currentPage > 1 && (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          )}
        </motion.div>
      </div>
    </AdminLayout>
  )
}
