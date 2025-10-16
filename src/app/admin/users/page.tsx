'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Users, UserCheck, Building2, AlertTriangle, Plus } from 'lucide-react'
import AdminLayout from '@/components/admin-layout'
import { UsersTable } from '@/components/users-table'
import { UsersSearch } from '@/components/users-search'
import { AddUserDialog } from '@/components/add-user-dialog'
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
  searchUsers,
  getUserStats,
  updateUserStatus,
  type UserProfile,
  type UserFilters,
  type PaginatedUserResponse
} from '@/lib/supabase/users-queries'

export default function UsersPage() {
  const { toast } = useToast()
  
  // State management
  const [users, setUsers] = useState<UserProfile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filters, setFilters] = useState<UserFilters>({})
  const [totalCount, setTotalCount] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const [showUserDetails, setShowUserDetails] = useState(false)
  const [showAddUser, setShowAddUser] = useState(false)
  
  // Stats state
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    drivers: 0,
    customers: 0,
    businesses: 0,
    suspendedUsers: 0
  })

  // Fetch users data
  const fetchUsers = useCallback(async (page = 1, resetUsers = true) => {
    try {
      setIsLoading(true)
      const response: PaginatedUserResponse = await searchUsers(filters, page, 50)
      
      if (resetUsers) {
        setUsers(response.users)
      } else {
        setUsers(prev => [...prev, ...response.users])
      }
      
      setTotalCount(response.totalCount)
      setHasMore(response.hasMore)
      setCurrentPage(page)
    } catch (error) {
      console.error('Error fetching users:', error)
      toast({
        title: "Error",
        description: "Failed to fetch users. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [filters, toast])

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const statsData = await getUserStats()
      setStats(statsData)
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }, [])

  // Load more users (pagination)
  const loadMore = () => {
    if (hasMore && !isLoading) {
      fetchUsers(currentPage + 1, false)
    }
  }

  // Handle filter changes
  const handleFiltersChange = (newFilters: UserFilters) => {
    setFilters(newFilters)
    setCurrentPage(1)
  }

  // Handle user status update
  const handleUpdateStatus = async (userId: string, status: 'active' | 'inactive' | 'suspended') => {
    try {
      const result = await updateUserStatus(userId, status)
      
      if (result.success) {
        toast({
          title: "Success",
          description: `User status updated to ${status}`,
        })
        
        // Update local state
        setUsers(prev => prev.map(user => 
          user.id === userId ? { ...user, status } : user
        ))
        
        // Refresh stats
        fetchStats()
      } else {
        throw new Error('Failed to update user status')
      }
    } catch (error) {
      console.error('Error updating user status:', error)
      toast({
        title: "Error",
        description: "Failed to update user status. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Handle view user details
  const handleViewUser = (user: UserProfile) => {
    setSelectedUser(user)
    setShowUserDetails(true)
  }

  // Export users data
  const handleExport = async () => {
    try {
      // For now, we'll just show a toast. In production, you'd implement CSV/Excel export
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

  // Handle user added
  const handleUserAdded = () => {
    // Refresh the users list and stats
    fetchUsers()
    fetchStats()
  }

  // Initial data fetch
  useEffect(() => {
    fetchUsers()
    fetchStats()
  }, [fetchUsers, fetchStats])

  return (
    <AdminLayout currentPath="/admin/users">
      <div className="flex-1 space-y-6 p-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
              <p className="text-muted-foreground">
                Manage all platform users, their roles, and account status
              </p>
            </div>
            <Button onClick={() => setShowAddUser(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add User
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
            title="Total Users"
            value={stats.totalUsers}
            icon={Users}
            iconColor="text-blue-600"
            description="All registered users"
          />
          
          <MetricCard
            title="Active Users"
            value={stats.activeUsers}
            icon={UserCheck}
            iconColor="text-green-600"
            description="Currently active"
          />
          
          <MetricCard
            title="Drivers"
            value={stats.drivers}
            icon={Users}
            iconColor="text-[#1CB8F7]"
            description="Driver accounts"
          />
          
          <MetricCard
            title="Customers"
            value={stats.customers}
            icon={Users}
            iconColor="text-gray-600"
            description="Customer accounts"
          />
          
          <MetricCard
            title="Businesses"
            value={stats.businesses}
            icon={Building2}
            iconColor="text-purple-600"
            description="Business accounts"
          />
          
          <MetricCard
            title="Suspended"
            value={stats.suspendedUsers}
            icon={AlertTriangle}
            iconColor="text-red-600"
            description="Suspended accounts"
            badge={stats.suspendedUsers > 0 ? { text: "Review", variant: "destructive" } : undefined}
          />
        </motion.div>

        {/* Search and Filters */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <UsersSearch
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onExport={handleExport}
            isLoading={isLoading}
            totalResults={totalCount}
          />
        </motion.div>

        {/* Users Table */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="space-y-4"
        >
          <UsersTable
            users={users}
            isLoading={isLoading}
            onViewUser={handleViewUser}
            onUpdateStatus={handleUpdateStatus}
          />

          {/* Load More Button */}
          {hasMore && !isLoading && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={loadMore}>
                Load More Users
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

        {/* User Details Dialog */}
        <Dialog open={showUserDetails} onOpenChange={setShowUserDetails}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>User Details</DialogTitle>
              <DialogDescription>
                Detailed information about the selected user
              </DialogDescription>
            </DialogHeader>
            
            {selectedUser && (
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Name</label>
                    <p className="text-sm">{selectedUser.first_name} {selectedUser.last_name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Phone</label>
                    <p className="text-sm font-mono">{selectedUser.phone_number}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">User Type</label>
                    <p className="text-sm capitalize">{selectedUser.user_type}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Status</label>
                    <p className="text-sm capitalize">{selectedUser.status}</p>
                  </div>
                  {selectedUser.business_name && (
                    <div className="col-span-2">
                      <label className="text-sm font-medium text-muted-foreground">Business Name</label>
                      <p className="text-sm">{selectedUser.business_name}</p>
                    </div>
                  )}
                </div>

                {/* Driver Profile Info */}
                {selectedUser.driver_profile && (
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-3">Driver Information</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Verification Status</label>
                        <p className="text-sm">{selectedUser.driver_profile.is_verified ? 'Verified' : 'Pending'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Online Status</label>
                        <p className="text-sm">{selectedUser.driver_profile.is_online ? 'Online' : 'Offline'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Rating</label>
                        <p className="text-sm">{(selectedUser.driver_profile.rating || 0).toFixed(1)} / 5.0</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Total Deliveries</label>
                        <p className="text-sm">{selectedUser.driver_profile.total_deliveries}</p>
                      </div>
                      {selectedUser.driver_profile.vehicle_type && (
                        <div className="col-span-2">
                          <label className="text-sm font-medium text-muted-foreground">Vehicle Type</label>
                          <p className="text-sm">{selectedUser.driver_profile.vehicle_type}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Account Dates */}
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Account Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Created</label>
                      <p className="text-sm">{new Date(selectedUser.created_at).toLocaleString()}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Last Updated</label>
                      <p className="text-sm">{new Date(selectedUser.updated_at).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Add User Dialog */}
        <AddUserDialog
          open={showAddUser}
          onOpenChange={setShowAddUser}
          onUserAdded={handleUserAdded}
        />
      </div>
    </AdminLayout>
  )
}