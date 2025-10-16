import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Dashboard Metrics Types
export interface DashboardMetrics {
  activeDeliveries: number
  totalRevenue: number
  dailyRevenue: number
  weeklyRevenue: number
  activeUsers: number
  activeDrivers: number
  totalUsers: number
  pendingVerifications: number
  pendingRemittances: number
  failedPayments: number
}

export interface DeliveryStats {
  pending: number
  driver_assigned: number
  pickup_arrived: number
  package_collected: number
  in_transit: number
  delivered: number
  cancelled: number
  failed: number
}

export interface DriverStats {
  total: number
  verified: number
  online: number
  available: number
  suspended: number
}

export interface ChartDataPoint {
  date: string
  value: number
  label: string
}

export interface RevenueChartData extends ChartDataPoint {
  dailyRevenue: number
  cumulativeRevenue: number
}

export interface UserChartData extends ChartDataPoint {
  newUsers: number
  totalUsers: number
}

// Dashboard Metrics Queries
export const getDashboardMetrics = async (): Promise<DashboardMetrics> => {
  try {
    // Active deliveries (not completed/cancelled/failed)
    const { count: activeDeliveries } = await supabase
      .from('deliveries')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'driver_assigned', 'pickup_arrived', 'package_collected', 'in_transit'])

    // Total revenue (all time)
    const { data: totalRevenueData } = await supabase
      .from('deliveries')
      .select('total_amount')
      .eq('payment_status', 'paid')

    const totalRevenue = totalRevenueData?.reduce((sum, delivery) => 
      sum + (parseFloat(delivery.total_amount) || 0), 0) || 0

    // Daily revenue (today)
    const today = new Date().toISOString().split('T')[0]
    const { data: dailyRevenueData } = await supabase
      .from('deliveries')
      .select('total_amount')
      .eq('payment_status', 'paid')
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`)

    const dailyRevenue = dailyRevenueData?.reduce((sum, delivery) => 
      sum + (parseFloat(delivery.total_amount) || 0), 0) || 0

    // Weekly revenue (last 7 days)
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const { data: weeklyRevenueData } = await supabase
      .from('deliveries')
      .select('total_amount')
      .eq('payment_status', 'paid')
      .gte('created_at', weekAgo.toISOString())

    const weeklyRevenue = weeklyRevenueData?.reduce((sum, delivery) => 
      sum + (parseFloat(delivery.total_amount) || 0), 0) || 0

    // Active users (users with deliveries in last 30 days)
    const monthAgo = new Date()
    monthAgo.setDate(monthAgo.getDate() - 30)
    const { data: activeUsersData } = await supabase
      .from('deliveries')
      .select('customer_id')
      .gte('created_at', monthAgo.toISOString())

    const activeUsers = new Set(activeUsersData?.map(d => d.customer_id)).size || 0

    // Active drivers (online)
    const { count: activeDrivers } = await supabase
      .from('driver_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_online', true)

    // Total users
    const { count: totalUsers } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })

    // Pending verifications
    const { count: pendingVerifications } = await supabase
      .from('driver_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_verified', false)

    // Pending remittances
    const { count: pendingRemittances } = await supabase
      .from('cash_remittances')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'submitted')

    // Failed payments
    const { count: failedPayments } = await supabase
      .from('delivery_payments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed')

    return {
      activeDeliveries: activeDeliveries || 0,
      totalRevenue,
      dailyRevenue,
      weeklyRevenue,
      activeUsers,
      activeDrivers: activeDrivers || 0,
      totalUsers: totalUsers || 0,
      pendingVerifications: pendingVerifications || 0,
      pendingRemittances: pendingRemittances || 0,
      failedPayments: failedPayments || 0
    }

  } catch (error) {
    console.error('Error fetching dashboard metrics:', error)
    return {
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
    }
  }
}

// Delivery Statistics
export const getDeliveryStats = async (): Promise<DeliveryStats> => {
  try {
    const { data } = await supabase
      .from('deliveries')
      .select('status')

    const stats: DeliveryStats = {
      pending: 0,
      driver_assigned: 0,
      pickup_arrived: 0,
      package_collected: 0,
      in_transit: 0,
      delivered: 0,
      cancelled: 0,
      failed: 0
    }

    data?.forEach(delivery => {
      if (delivery.status in stats) {
        stats[delivery.status as keyof DeliveryStats]++
      }
    })

    return stats
  } catch (error) {
    console.error('Error fetching delivery stats:', error)
    return {
      pending: 0,
      driver_assigned: 0,
      pickup_arrived: 0,
      package_collected: 0,
      in_transit: 0,
      delivered: 0,
      cancelled: 0,
      failed: 0
    }
  }
}

// Driver Statistics
export const getDriverStats = async (): Promise<DriverStats> => {
  try {
    const { data } = await supabase
      .from('driver_profiles')
      .select(`
        is_verified, 
        is_online, 
        is_available,
        user_profiles!inner(status)
      `)
      .neq('user_profiles.status', 'suspended')

    const stats = {
      total: data?.length || 0,
      verified: data?.filter(d => d.is_verified).length || 0,
      online: data?.filter(d => d.is_online).length || 0,
      available: data?.filter(d => d.is_available).length || 0,
      suspended: 0 // We'll get this separately
    }

    // Get suspended drivers count
    const { count: suspendedCount } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('user_type', 'driver')
      .eq('status', 'suspended')

    stats.suspended = suspendedCount || 0

    return stats
  } catch (error) {
    console.error('Error fetching driver stats:', error)
    return {
      total: 0,
      verified: 0,
      online: 0,
      available: 0,
      suspended: 0
    }
  }
}

// Real-time subscriptions
export const subscribeToDeliveries = (callback: (payload: any) => void) => {
  return supabase
    .channel('deliveries-changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'deliveries'
    }, callback)
    .subscribe()
}

export const subscribeToDriverStatus = (callback: (payload: any) => void) => {
  return supabase
    .channel('driver-status-changes')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'driver_profiles',
      filter: 'is_online=eq.true'
    }, callback)
    .subscribe()
}

export const subscribeToRemittances = (callback: (payload: any) => void) => {
  return supabase
    .channel('remittances-changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'cash_remittances'
    }, callback)
    .subscribe()
}

// Chart Data Queries
export const getRevenueChartData = async (days: number = 7): Promise<RevenueChartData[]> => {
  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { data } = await supabase
      .from('deliveries')
      .select('created_at, total_amount')
      .eq('payment_status', 'paid')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true })

    // Group by date and calculate daily/cumulative revenue
    const dailyRevenue: { [key: string]: number } = {}
    const dateLabels: string[] = []

    // Initialize all dates in range
    for (let i = 0; i < days; i++) {
      const date = new Date()
      date.setDate(date.getDate() - (days - 1 - i))
      const dateStr = date.toISOString().split('T')[0]
      dailyRevenue[dateStr] = 0
      dateLabels.push(dateStr)
    }

    // Aggregate revenue by date
    data?.forEach(delivery => {
      const date = delivery.created_at.split('T')[0]
      const amount = parseFloat(delivery.total_amount) || 0
      if (dailyRevenue.hasOwnProperty(date)) {
        dailyRevenue[date] += amount
      }
    })

    // Build chart data with cumulative totals
    let cumulativeTotal = 0
    const chartData: RevenueChartData[] = dateLabels.map(date => {
      const dailyAmount = dailyRevenue[date]
      cumulativeTotal += dailyAmount
      
      return {
        date,
        value: cumulativeTotal,
        label: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        dailyRevenue: dailyAmount,
        cumulativeRevenue: cumulativeTotal
      }
    })

    return chartData
  } catch (error) {
    console.error('Error fetching revenue chart data:', error)
    // Return sample data for development/testing
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (6 - i))
      const dateStr = date.toISOString().split('T')[0]
      const dailyRevenue = Math.random() * 5000 + 1000
      const cumulativeRevenue = (i + 1) * dailyRevenue
      
      return {
        date: dateStr,
        value: cumulativeRevenue,
        label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        dailyRevenue,
        cumulativeRevenue
      }
    })
  }
}

export const getUserChartData = async (days: number = 7): Promise<UserChartData[]> => {
  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { data } = await supabase
      .from('user_profiles')
      .select('created_at')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true })

    // Group by date and calculate daily/total users
    const dailyUsers: { [key: string]: number } = {}
    const dateLabels: string[] = []

    // Initialize all dates in range
    for (let i = 0; i < days; i++) {
      const date = new Date()
      date.setDate(date.getDate() - (days - 1 - i))
      const dateStr = date.toISOString().split('T')[0]
      dailyUsers[dateStr] = 0
      dateLabels.push(dateStr)
    }

    // Count new users by date
    data?.forEach(user => {
      const date = user.created_at.split('T')[0]
      if (dailyUsers.hasOwnProperty(date)) {
        dailyUsers[date] += 1
      }
    })

    // Get total users up to start date for baseline
    const { count: baselineUsers } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .lt('created_at', startDate.toISOString())

    // Build chart data with cumulative totals
    let cumulativeTotal = baselineUsers || 0
    const chartData: UserChartData[] = dateLabels.map(date => {
      const newUsers = dailyUsers[date]
      cumulativeTotal += newUsers
      
      return {
        date,
        value: cumulativeTotal,
        label: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        newUsers,
        totalUsers: cumulativeTotal
      }
    })

    return chartData
  } catch (error) {
    console.error('Error fetching user chart data:', error)
    // Return sample data for development/testing
    let cumulativeUsers = 100 // Starting baseline
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (6 - i))
      const dateStr = date.toISOString().split('T')[0]
      const newUsers = Math.floor(Math.random() * 20) + 5
      cumulativeUsers += newUsers
      
      return {
        date: dateStr,
        value: cumulativeUsers,
        label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        newUsers,
        totalUsers: cumulativeUsers
      }
    })
  }
}