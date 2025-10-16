'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { 
  getDashboardMetrics, 
  getDeliveryStats, 
  getDriverStats,
  getRevenueChartData,
  getUserChartData,
  subscribeToDeliveries,
  subscribeToDriverStatus,
  subscribeToRemittances,
  type DashboardMetrics,
  type DeliveryStats,
  type DriverStats,
  type RevenueChartData,
  type UserChartData
} from '@/lib/supabase/admin-queries'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface UseDashboardDataReturn {
  metrics: DashboardMetrics
  deliveryStats: DeliveryStats
  driverStats: DriverStats
  revenueChartData: RevenueChartData[]
  userChartData: UserChartData[]
  isLoading: boolean
  error: string | null
  refreshData: () => Promise<void>
  lastUpdated: Date | null
}

export function useDashboardData(): UseDashboardDataReturn {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    activeDeliveries: 0,
    totalRevenue: 0,
    dailyRevenue: 0,
    weeklyRevenue: 0,
    activeUsers: 0,
    activeDrivers: 0,
    totalUsers: 0,
    pendingVerifications: 0,
    pendingRemittances: 0,
    failedPayments: 0
  })

  const [deliveryStats, setDeliveryStats] = useState<DeliveryStats>({
    pending: 0,
    driver_assigned: 0,
    pickup_arrived: 0,
    package_collected: 0,
    in_transit: 0,
    delivered: 0,
    cancelled: 0,
    failed: 0
  })

  const [driverStats, setDriverStats] = useState<DriverStats>({
    total: 0,
    verified: 0,
    online: 0,
    available: 0,
    suspended: 0
  })

  const [revenueChartData, setRevenueChartData] = useState<RevenueChartData[]>([])
  const [userChartData, setUserChartData] = useState<UserChartData[]>([])

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Fetch all dashboard data
  const fetchDashboardData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const [metricsData, deliveryStatsData, driverStatsData, revenueData, userData] = await Promise.all([
        getDashboardMetrics(),
        getDeliveryStats(),
        getDriverStats(),
        getRevenueChartData(7),
        getUserChartData(7)
      ])

      setMetrics(metricsData)
      setDeliveryStats(deliveryStatsData)
      setDriverStats(driverStatsData)
      setRevenueChartData(revenueData)
      setUserChartData(userData)
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Error fetching dashboard data:', err)
      setError('Failed to fetch dashboard data')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Real-time subscription handlers
  const handleDeliveryChange = useCallback(async (payload: any) => {
    console.log('Delivery change detected:', payload)
    
    // Refresh delivery-related metrics and revenue chart
    try {
      const [newMetrics, newDeliveryStats, newRevenueData] = await Promise.all([
        getDashboardMetrics(),
        getDeliveryStats(),
        getRevenueChartData(7)
      ])
      
      setMetrics(newMetrics)
      setDeliveryStats(newDeliveryStats)
      setRevenueChartData(newRevenueData)
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Error updating delivery data:', err)
    }
  }, [])

  const handleDriverStatusChange = useCallback(async (payload: any) => {
    console.log('Driver status change detected:', payload)
    
    // Refresh driver-related metrics
    try {
      const [newMetrics, newDriverStats] = await Promise.all([
        getDashboardMetrics(),
        getDriverStats()
      ])
      
      setMetrics(prev => ({ ...prev, activeDrivers: newMetrics.activeDrivers }))
      setDriverStats(newDriverStats)
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Error updating driver data:', err)
    }
  }, [])

  const handleRemittanceChange = useCallback(async (payload: any) => {
    console.log('Remittance change detected:', payload)
    
    // Refresh remittance-related metrics
    try {
      const newMetrics = await getDashboardMetrics()
      setMetrics(prev => ({ 
        ...prev, 
        pendingRemittances: newMetrics.pendingRemittances 
      }))
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Error updating remittance data:', err)
    }
  }, [])

  // Set up real-time subscriptions and polling
  useEffect(() => {
    // Initial data fetch
    fetchDashboardData()

    // Set up real-time subscriptions
    const deliverySubscription = subscribeToDeliveries(handleDeliveryChange)
    const driverSubscription = subscribeToDriverStatus(handleDriverStatusChange)
    const remittanceSubscription = subscribeToRemittances(handleRemittanceChange)
    
    // Subscribe to user profile changes for user chart updates
    const userSubscription = supabase
      .channel('user-profile-changes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'user_profiles'
      }, async () => {
        try {
          const [newMetrics, newUserData] = await Promise.all([
            getDashboardMetrics(),
            getUserChartData(7)
          ])
          setMetrics(prev => ({ 
            ...prev, 
            totalUsers: newMetrics.totalUsers,
            activeUsers: newMetrics.activeUsers
          }))
          setUserChartData(newUserData)
          setLastUpdated(new Date())
        } catch (err) {
          console.error('Error updating user data:', err)
        }
      })
      .subscribe()

    // Set up polling for summary metrics (every 60 seconds)
    const pollingInterval = setInterval(async () => {
      try {
        const newMetrics = await getDashboardMetrics()
        setMetrics(prev => ({
          ...prev,
          totalRevenue: newMetrics.totalRevenue,
          dailyRevenue: newMetrics.dailyRevenue,
          weeklyRevenue: newMetrics.weeklyRevenue,
          activeUsers: newMetrics.activeUsers,
          totalUsers: newMetrics.totalUsers
        }))
        setLastUpdated(new Date())
      } catch (err) {
        console.error('Error polling metrics:', err)
      }
    }, 60000) // 60 seconds

    // Cleanup
    return () => {
      deliverySubscription.unsubscribe()
      driverSubscription.unsubscribe()
      remittanceSubscription.unsubscribe()
      userSubscription.unsubscribe()
      clearInterval(pollingInterval)
    }
  }, [fetchDashboardData, handleDeliveryChange, handleDriverStatusChange, handleRemittanceChange])

  return {
    metrics,
    deliveryStats,
    driverStats,
    revenueChartData,
    userChartData,
    isLoading,
    error,
    refreshData: fetchDashboardData,
    lastUpdated
  }
}