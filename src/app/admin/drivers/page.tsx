'use client'

import React, { useState, useEffect, useCallback, memo, useMemo } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { Users, CheckCircle, Clock, Star, Truck, Plus, MapPin, FileText, Eye, Check, X, AlertCircle } from 'lucide-react'
import AdminLayout from '@/components/admin-layout'
import { DriversTable } from '@/components/drivers-table'
import { DriversSearch } from '@/components/drivers-search'
import { MetricCard } from '@/components/ui/metric-card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { createClient } from '@/lib/supabase/client'
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

interface VerificationSubmission {
  id: string
  user_id: string
  vehicle_type: string
  vehicle_type_id: string
  documents: any
  file_names: any
  status: string
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
  submitted_at: string
  created_at: string
  updated_at: string
  user_profiles: {
    first_name: string
    last_name: string
    phone_number: string
  }
}

export default function DriversPage() {
  const { toast } = useToast()
  const supabase = createClient()
  
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
  const [driverSubmission, setDriverSubmission] = useState<VerificationSubmission | null>(null)
  
  // Verification submissions state
  const [verificationSubmissions, setVerificationSubmissions] = useState<VerificationSubmission[]>([])
  const [selectedSubmission, setSelectedSubmission] = useState<VerificationSubmission | null>(null)
  const [showSubmissionReview, setShowSubmissionReview] = useState(false)
  const [showSubmissionsModal, setShowSubmissionsModal] = useState(false)
  const [reviewNotes, setReviewNotes] = useState('')
  const [isReviewing, setIsReviewing] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [previewDocument, setPreviewDocument] = useState<{ url: string; title: string } | null>(null)
  
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

  // Fetch verification submissions
  const fetchVerificationSubmissions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('driver_verification_submissions')
        .select(`
          *,
          user_profiles!driver_verification_submissions_user_id_fkey (
            first_name,
            last_name,
            phone_number
          )
        `)
        .order('submitted_at', { ascending: false })

      if (error) throw error

      setVerificationSubmissions(data || [])
      setPendingCount(data?.filter(s => s.status === 'pending').length || 0)
    } catch (error) {
      console.error('Error fetching verification submissions:', error)
      toast({
        title: "Error",
        description: "Failed to fetch verification submissions",
        variant: "destructive",
      })
    }
  }, [supabase, toast])

  // Handle review submission
  const handleReviewSubmission = async (submissionId: string, action: 'approve' | 'reject') => {
    if (!selectedSubmission) return

    try {
      setIsReviewing(true)

      const newStatus = action === 'approve' ? 'approved' : 'rejected'

      // Get current user (admin)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Update submission status
      const { error: updateError } = await supabase
        .from('driver_verification_submissions')
        .update({
          status: newStatus,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', submissionId)

      if (updateError) throw updateError

      // If approved, update driver profile
      if (action === 'approve') {
        const { error: driverError } = await supabase
          .from('driver_profiles')
          .upsert({
            id: selectedSubmission.user_id,
            vehicle_type_id: selectedSubmission.vehicle_type_id,
            is_verified: true,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'id'
          })

        if (driverError) throw driverError
      }

      toast({
        title: "Success",
        description: `Verification ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      })

      // Refresh data
      await fetchVerificationSubmissions()
      await fetchDrivers()
      await fetchStats()

      // Close modal
      setShowSubmissionReview(false)
      setSelectedSubmission(null)
      setReviewNotes('')
    } catch (error: any) {
      console.error('Error reviewing submission:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to review submission",
        variant: "destructive",
      })
    } finally {
      setIsReviewing(false)
    }
  }

  // Handle view submission
  // Fetch driver's verification submission
  const fetchDriverSubmission = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('driver_verification_submissions')
        .select(`
          *,
          user_profiles!inner(
            first_name,
            last_name,
            phone_number
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      if (error) {
        console.log('No submission found for driver:', userId)
        setDriverSubmission(null)
        return
      }
      
      setDriverSubmission(data)
    } catch (error) {
      console.error('Error fetching driver submission:', error)
      setDriverSubmission(null)
    }
  }

  const handleViewSubmission = (submission: VerificationSubmission) => {
    setSelectedSubmission(submission)
    setReviewNotes(submission.review_notes || '')
    setShowSubmissionReview(true)
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
    
    // Fetch driver's verification submission
    await fetchDriverSubmission(driver.user_id)
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

  // Memoize filtered drivers count for performance
  const filteredDriversCount = useMemo(() => drivers.length, [drivers.length])
  
  // Memoize top performers count
  const topPerformersCount = useMemo(() => 
    stats.topPerformers.length, 
    [stats.topPerformers.length]
  )

  // Initial data fetch
  useEffect(() => {
    fetchDrivers()
    fetchStats()
    fetchVerificationSubmissions()
  }, [fetchDrivers, fetchStats, fetchVerificationSubmissions])

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
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowSubmissionsModal(true)}
                className="relative"
              >
                <FileText className="mr-2 h-4 w-4" />
                Document Reviews
                {pendingCount > 0 && (
                  <Badge className="ml-2 bg-yellow-500 hover:bg-yellow-600">
                    {pendingCount}
                  </Badge>
                )}
              </Button>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Driver
              </Button>
            </div>
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
            value={pendingCount}
            icon={Clock}
            iconColor="text-yellow-600"
            description="Awaiting verification"
            badge={pendingCount > 0 ? { text: "Review", variant: "secondary" } : undefined}
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
            value={topPerformersCount}
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

                {/* Submitted Documents */}
                {driverSubmission && (
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">Submitted Documents</h4>
                      <Badge variant={driverSubmission.status === 'approved' ? 'default' : driverSubmission.status === 'rejected' ? 'destructive' : 'secondary'}>
                        {driverSubmission.status}
                      </Badge>
                    </div>
                    
                    {/* Vehicle Type Info */}
                    <div className="mb-4 p-3 bg-muted rounded-lg">
                      <label className="text-sm font-medium text-muted-foreground">Vehicle Type</label>
                      <p className="text-sm font-medium">{driverSubmission.vehicle_type}</p>
                      {driverSubmission.submitted_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Submitted on {new Date(driverSubmission.submitted_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>

                    {/* Documents Grid */}
                    {driverSubmission.documents && Object.keys(driverSubmission.documents).length > 0 && (
                      <div className="grid grid-cols-2 gap-3">
                        {Object.entries(driverSubmission.documents).map(([key, url]) => {
                          const fileName = driverSubmission.file_names?.[key] || key
                          const isImage = typeof url === 'string' && (url.match(/\.(jpg|jpeg|png|gif|webp)$/i) || url.includes('image'))
                          
                          return (
                            <Card key={key} className="overflow-hidden hover:shadow-md transition-shadow">
                              <CardContent className="p-0">
                                {isImage ? (
                                  <div 
                                    className="relative h-48 bg-muted cursor-pointer group"
                                    onClick={() => setPreviewDocument({ url: url as string, title: fileName })}
                                  >
                                    <Image 
                                      src={url as string} 
                                      alt={fileName}
                                      fill
                                      sizes="(max-width: 768px) 100vw, 50vw"
                                      className="object-cover"
                                      loading="lazy"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none'
                                      }}
                                    />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                                      <Eye className="w-8 h-8 text-white" />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="h-48 bg-muted flex items-center justify-center">
                                    <FileText className="w-12 h-12 text-muted-foreground" />
                                  </div>
                                )}
                                <div className="p-3">
                                  <p className="text-sm font-medium truncate">{fileName}</p>
                                  {!isImage && (
                                    <a 
                                      href={url as string} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-xs text-primary hover:underline mt-1 inline-block"
                                    >
                                      View Document →
                                    </a>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          )
                        })}
                      </div>
                    )}

                    {/* Review Information */}
                    {driverSubmission.review_notes && (
                      <div className="mt-4 p-3 bg-muted rounded-lg">
                        <label className="text-sm font-medium text-muted-foreground">Review Notes</label>
                        <p className="text-sm mt-1">{driverSubmission.review_notes}</p>
                        {driverSubmission.reviewed_at && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Reviewed on {new Date(driverSubmission.reviewed_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    )}

                    {(!driverSubmission.documents || Object.keys(driverSubmission.documents).length === 0) && (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No documents submitted yet</p>
                      </div>
                    )}
                  </div>
                )}

                {!driverSubmission && (
                  <div className="border-t pt-4">
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No verification submission found</p>
                      <p className="text-xs mt-1">Driver hasn't submitted verification documents yet</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Document Submissions Modal */}
        <Dialog open={showSubmissionsModal} onOpenChange={setShowSubmissionsModal}>
          <DialogContent className="max-w-6xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Driver Verification Submissions
              </DialogTitle>
              <DialogDescription>
                Review and approve/reject driver verification documents
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto">
              {verificationSubmissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle className="h-12 w-12 text-muted-foreground mb-3" />
                  <p className="text-lg font-medium">No submissions yet</p>
                  <p className="text-sm text-muted-foreground">Driver verification submissions will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {verificationSubmissions.map((submission) => (
                    <Card key={submission.id} className="hover:bg-muted/30 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <div>
                                <h4 className="font-semibold">
                                  {submission.user_profiles?.first_name} {submission.user_profiles?.last_name}
                                </h4>
                                <p className="text-sm text-muted-foreground">
                                  {submission.user_profiles?.phone_number}
                                </p>
                              </div>
                              <Badge variant={
                                submission.status === 'pending' ? 'secondary' :
                                submission.status === 'approved' ? 'default' :
                                submission.status === 'rejected' ? 'destructive' :
                                'outline'
                              }>
                                {submission.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Truck className="h-3 w-3" />
                                {submission.vehicle_type}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(submission.submitted_at).toLocaleDateString()}
                              </span>
                            </div>
                            {submission.review_notes && (
                              <p className="text-sm mt-2 text-muted-foreground">
                                <strong>Notes:</strong> {submission.review_notes}
                              </p>
                            )}
                          </div>
                          <Button 
                            size="sm" 
                            onClick={() => handleViewSubmission(submission)}
                            className="ml-4"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Review
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Individual Document Review Modal */}
        <Dialog open={showSubmissionReview} onOpenChange={setShowSubmissionReview}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Review Driver Verification</DialogTitle>
              <DialogDescription>
                Review submitted documents and approve or reject the verification
              </DialogDescription>
            </DialogHeader>
            
            {selectedSubmission && (
              <div className="space-y-6">
                {/* Driver Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Driver Information</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Name</label>
                      <p className="text-sm font-medium">
                        {selectedSubmission.user_profiles?.first_name} {selectedSubmission.user_profiles?.last_name}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Phone</label>
                      <p className="text-sm font-mono">{selectedSubmission.user_profiles?.phone_number}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Vehicle Type</label>
                      <p className="text-sm">{selectedSubmission.vehicle_type}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Status</label>
                      <Badge variant={
                        selectedSubmission.status === 'pending' ? 'secondary' :
                        selectedSubmission.status === 'approved' ? 'default' :
                        'destructive'
                      }>
                        {selectedSubmission.status}
                      </Badge>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Submitted</label>
                      <p className="text-sm">{new Date(selectedSubmission.submitted_at).toLocaleString()}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Documents */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Submitted Documents</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      {selectedSubmission.documents && Object.entries(selectedSubmission.documents).map(([key, url]: [string, any]) => (
                        <div key={key} className="border rounded-lg overflow-hidden">
                          <div className="p-3 bg-muted">
                            <label className="text-sm font-medium capitalize">
                              {key.replace(/_/g, ' ')}
                            </label>
                          </div>
                          {url ? (
                            <div className="relative group h-48">
                              <Image 
                                src={url} 
                                alt={key}
                                fill
                                sizes="(max-width: 768px) 50vw, 33vw"
                                className="object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                loading="lazy"
                                onClick={() => setPreviewDocument({ url, title: key.replace(/_/g, ' ') })}
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none'
                                }}
                              />
                              <div className="hidden h-48 flex items-center justify-center bg-muted">
                                <div className="text-center">
                                  <FileText className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                                  <a 
                                    href={url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-sm text-blue-600 hover:underline"
                                  >
                                    View Document
                                  </a>
                                </div>
                              </div>
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Eye className="h-8 w-8 text-white" />
                              </div>
                            </div>
                          ) : (
                            <div className="h-48 flex items-center justify-center bg-muted">
                              <p className="text-sm text-muted-foreground">Not provided</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Review Notes */}
                {selectedSubmission.status === 'pending' && (
                  <div className="space-y-2">
                    <Label htmlFor="review-notes">Review Notes (Optional)</Label>
                    <Textarea
                      id="review-notes"
                      placeholder="Add any notes about this verification review..."
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      rows={4}
                    />
                  </div>
                )}

                {/* Previous Review Info */}
                {selectedSubmission.status !== 'pending' && selectedSubmission.review_notes && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Review Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Reviewed At</label>
                        <p className="text-sm">{selectedSubmission.reviewed_at ? new Date(selectedSubmission.reviewed_at).toLocaleString() : 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Review Notes</label>
                        <p className="text-sm">{selectedSubmission.review_notes}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {selectedSubmission?.status === 'pending' && (
              <DialogFooter className="gap-2">
                <Button
                  variant="destructive"
                  onClick={() => handleReviewSubmission(selectedSubmission.id, 'reject')}
                  disabled={isReviewing}
                >
                  <X className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button
                  onClick={() => handleReviewSubmission(selectedSubmission.id, 'approve')}
                  disabled={isReviewing}
                >
                  {isReviewing ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Approve
                    </>
                  )}
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>

        {/* Document Preview Modal */}
        <Dialog open={!!previewDocument} onOpenChange={() => setPreviewDocument(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="capitalize">{previewDocument?.title}</DialogTitle>
            </DialogHeader>
            {previewDocument && (
              <div className="relative w-full h-[70vh] flex items-center justify-center bg-muted rounded-lg overflow-hidden">
                <Image 
                  src={previewDocument.url} 
                  alt={previewDocument.title}
                  fill
                  sizes="90vw"
                  className="object-contain"
                  priority
                />
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreviewDocument(null)}>
                Close
              </Button>
              <Button asChild>
                <a 
                  href={previewDocument?.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  download
                >
                  Download
                </a>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  )
}
