'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Users, CheckCircle, Clock, Star, Truck, Plus, MapPin } from 'lucide-react'
import AdminLayout from '@/components/admin-layout'
import { DriversTable } from '@/components/drivers-table'
import { DriversSearch } from '@/components/drivers-search'
import { MetricCard } from '@/components/ui/metric-card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import {
  searchDrivers,
  getDriverStats,
  updateDriverVerification,
  updateDriverOnlineStatus,
  getDriverDeliveryStats,
  type DriverProfile,
  type DriverFilters,
  type PaginatedDriverResponse
} from '@/lib/supabase/driver-queries'

interface TopPerformer {
  user_id: string
  rating: number
  total_deliveries: number
  user_profiles: {
    first_name: string
    last_name: string
  }
}

interface DriverStats {
  totalDrivers: number
  verifiedDrivers: number
  onlineDrivers: number
  pendingDrivers: number
  averageRating: number
  topPerformers: TopPerformer[]
}

export default function DriversPage() {
  const { toast } = useToast()
  
  // State management
  const [drivers, setDrivers] = useState<DriverProfile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filters, setFilters] = useState<DriverFilters>({})
  const [totalCount, setTotalCount] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedDriver, setSelectedDriver] = useState<DriverProfile | null>(null)
  const [showDriverDetails, setShowDriverDetails] = useState(false)
  const [driverDeliveryStats, setDriverDeliveryStats] = useState<any>(null)
  
  // Stats state
  const [stats, setStats] = useState<DriverStats>({
    totalDrivers: 0,
    verifiedDrivers: 0,
    onlineDrivers: 0,
    pendingDrivers: 0,
    averageRating: 0,
    topPerformers: []
  })

  // Fetch drivers data
  const fetchDrivers = useCallback(async (page = 1, resetDrivers = true) => {
    try {
      setIsLoading(true)
      const response: PaginatedDriverResponse = await searchDrivers(filters, page, 50)
      
      if (resetDrivers) {
        setDrivers(response.drivers)
      } else {
        setDrivers(prev => [...prev, ...response.drivers])
      }
      
      setTotalCount(response.totalCount)
      setHasMore(response.hasMore)
      setCurrentPage(page)
    } catch (error) {
      console.error('Error fetching drivers:', error)
      toast({
        title: "Error",
        description: "Failed to fetch drivers. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [filters, toast])

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const statsData = await getDriverStats()
      setStats(statsData)
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }, [])

  // Load more drivers (pagination)
  const loadMore = () => {
    if (hasMore && !isLoading) {
      fetchDrivers(currentPage + 1, false)
    }
  }

  // Handle filter changes
  const handleFiltersChange = (newFilters: DriverFilters) => {
    setFilters(newFilters)
    setCurrentPage(1)
  }

  // Handle driver verification update
  const handleUpdateVerification = async (userId: string, isVerified: boolean) => {
    try {
      const result = await updateDriverVerification(userId, isVerified)
      
      if (result.success) {
        toast({
          title: "Success",
          description: `Driver ${isVerified ? 'verified' : 'verification revoked'} successfully`,
        })
        
        // Update local state
        setDrivers(prev => prev.map(driver => 
          driver.user_id === userId ? { ...driver, is_verified: isVerified } : driver
        ))
        
        // Refresh stats
        fetchStats()
      } else {
        throw new Error('Failed to update driver verification')
      }
    } catch (error) {
      console.error('Error updating driver verification:', error)
      toast({
        title: "Error",
        description: "Failed to update driver verification. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Handle driver online status update
  const handleUpdateOnlineStatus = async (userId: string, isOnline: boolean) => {
    try {
      const result = await updateDriverOnlineStatus(userId, isOnline)
      
      if (result.success) {
        toast({
          title: "Success",
          description: `Driver status updated to ${isOnline ? 'online' : 'offline'}`,
        })
        
        // Update local state
        setDrivers(prev => prev.map(driver => 
          driver.user_id === userId ? { ...driver, is_online: isOnline } : driver
        ))
        
        // Refresh stats
        fetchStats()
      } else {
        throw new Error('Failed to update driver online status')
      }
    } catch (error) {
      console.error('Error updating driver online status:', error)
      toast({
        title: "Error",
        description: "Failed to update driver status. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Handle view driver details
  const handleViewDriver = async (driver: DriverProfile) => {
    setSelectedDriver(driver)
    setShowDriverDetails(true)
    
    // Fetch driver delivery stats
    try {
      const deliveryStats = await getDriverDeliveryStats(driver.user_id)
      setDriverDeliveryStats(deliveryStats)
    } catch (error) {
      console.error('Error fetching driver delivery stats:', error)
    }
  }

  // Export drivers data
  const handleExport = async () => {
    try {
      toast({
        title: "Export",
        description: "Export functionality will be implemented soon.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export data.",
        variant: "destructive",
      })
    }
  }

  // Initial data fetch
  useEffect(() => {
    fetchDrivers()
    fetchStats()
  }, [fetchDrivers, fetchStats])

  return (
    <AdminLayout currentPath="/admin/drivers">
      <div className="flex-1 space-y-6 p-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Driver Management</h1>
              <p className="text-muted-foreground">
                Manage drivers, verification status, and performance metrics
              </p>
            </div>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Driver
            </Button>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-6"
        >
          <MetricCard
            title="Total Drivers"
            value={stats.totalDrivers}
            icon={Users}
            iconColor="text-blue-600"
            description="All registered drivers"
          />
          
          <MetricCard
            title="Verified"
            value={stats.verifiedDrivers}
            icon={CheckCircle}
            iconColor="text-green-600"
            description="Verified drivers"
          />
          
          <MetricCard
            title="Online Now"
            value={stats.onlineDrivers}
            icon={MapPin}
            iconColor="text-[#1CB8F7]"
            description="Currently online"
          />
          
          <MetricCard
            title="Pending"
            value={stats.pendingDrivers}
            icon={Clock}
            iconColor="text-yellow-600"
            description="Awaiting verification"
            badge={stats.pendingDrivers > 0 ? { text: "Review", variant: "secondary" } : undefined}
          />
          
          <MetricCard
            title="Avg Rating"
            value={`${stats.averageRating}/5`}
            icon={Star}
            iconColor="text-yellow-500"
            description="Platform average"
          />
          
          <MetricCard
            title="Top Performers"
            value={stats.topPerformers.length}
            icon={Truck}
            iconColor="text-purple-600"
            description="4.5+ rating drivers"
          />
        </motion.div>

        {/* Search and Filters */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <DriversSearch
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onExport={handleExport}
            isLoading={isLoading}
            totalResults={totalCount}
          />
        </motion.div>

        {/* Drivers Table */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="space-y-4"
        >
          <DriversTable
            drivers={drivers}
            isLoading={isLoading}
            onViewDriver={handleViewDriver}
            onUpdateVerification={handleUpdateVerification}
            onUpdateOnlineStatus={handleUpdateOnlineStatus}
          />

          {/* Load More Button */}
          {hasMore && !isLoading && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={loadMore}>
                Load More Drivers
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

        {/* Driver Details Dialog */}
        <Dialog open={showDriverDetails} onOpenChange={setShowDriverDetails}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Driver Details</DialogTitle>
              <DialogDescription>
                Detailed information about the selected driver
              </DialogDescription>
            </DialogHeader>
            
            {selectedDriver && (
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-medium">Personal Information</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Name</label>
                        <p className="text-sm">
                          {selectedDriver.user_profile ? 
                            `${selectedDriver.user_profile.first_name} ${selectedDriver.user_profile.last_name}` : 
                            'N/A'
                          }
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Phone</label>
                        <p className="text-sm font-mono">{selectedDriver.user_profile?.phone_number || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Status</label>
                        <p className="text-sm capitalize">{selectedDriver.user_profile?.status || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Verification</label>
                        <p className="text-sm">{selectedDriver.is_verified ? 'Verified' : 'Pending'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium">Performance Metrics</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Rating</label>
                        <p className="text-sm">{selectedDriver.rating.toFixed(1)} / 5.0</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Total Deliveries</label>
                        <p className="text-sm">{selectedDriver.total_deliveries}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Total Earnings</label>
                        <p className="text-sm">₱{selectedDriver.total_earnings?.toLocaleString() || '0'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Online Status</label>
                        <p className="text-sm">{selectedDriver.is_online ? 'Online' : 'Offline'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Vehicle Information */}
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Vehicle Information</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Vehicle Type</label>
                      <p className="text-sm">{selectedDriver.vehicle_type?.name || 'Not set'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Plate Number</label>
                      <p className="text-sm font-mono">{selectedDriver.vehicle_plate_number || 'Not set'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">License Number</label>
                      <p className="text-sm font-mono">{selectedDriver.driver_license_number || 'Not set'}</p>
                    </div>
                  </div>
                </div>

                {/* Delivery Statistics */}
                {driverDeliveryStats && (
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-3">Delivery Statistics</h4>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Total Deliveries</label>
                        <p className="text-sm font-medium">{driverDeliveryStats.totalDeliveries}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Completed</label>
                        <p className="text-sm font-medium text-green-600">{driverDeliveryStats.completedDeliveries}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Cancelled</label>
                        <p className="text-sm font-medium text-red-600">{driverDeliveryStats.cancelledDeliveries}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Success Rate</label>
                        <p className="text-sm font-medium">
                          {driverDeliveryStats.totalDeliveries > 0 
                            ? `${Math.round((driverDeliveryStats.completedDeliveries / driverDeliveryStats.totalDeliveries) * 100)}%`
                            : 'N/A'
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Account Dates */}
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Account Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Joined</label>
                      <p className="text-sm">{new Date(selectedDriver.created_at).toLocaleString()}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Last Updated</label>
                      <p className="text-sm">{new Date(selectedDriver.updated_at).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  )
}