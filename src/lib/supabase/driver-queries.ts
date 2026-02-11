import { createClient } from './client'
import { createDriverClient } from './driver-client'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Simple in-memory cache for frequently accessed data
const queryCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

function getCachedData<T>(key: string): T | null {
  const cached = queryCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`📦 Cache hit: ${key}`);
    return cached.data as T;
  }
  return null;
}

function setCachedData(key: string, data: any): void {
  queryCache.set(key, { data, timestamp: Date.now() });
  // Clean old entries to prevent memory leaks
  if (queryCache.size > 50) {
    const oldestKey = Array.from(queryCache.keys())[0];
    queryCache.delete(oldestKey);
  }
}

// Export cache control for external use
export function clearDriverCache(): void {
  queryCache.clear();
  console.log('🗑️ Driver cache cleared');
}

// Create authenticated client that uses user session
const getSupabaseClient = () => createClient()

// Create non-persistent client for driver verification (temporary sessions)
const getDriverSupabaseClient = () => createDriverClient()

// Create admin client for server-side operations (like fetching public data)
const getAdminSupabaseClient = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin operations');
  }
  
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  );
}

// Driver types
export interface DriverProfile {
  id: string
  user_id: string
  is_verified: boolean
  is_online: boolean
  rating: number
  total_deliveries: number
  total_earnings: number
  vehicle_type_id?: string
  driver_license_number?: string
  license_expiry_date?: string
  vehicle_plate_number?: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  bank_account_number?: string
  bank_name?: string
  created_at: string
  updated_at: string
  // Joined data from user_profiles
  user_profile?: {
    first_name: string
    last_name: string
    phone_number: string
    profile_image_url?: string
    status: string
  }
  // Joined data from vehicle_types
  vehicle_type?: {
    id: string
    name: string
    description?: string
  }
}

export interface DriverFilters {
  search?: string
  status?: string // 'all', 'verified', 'pending', 'suspended'
  onlineStatus?: string // 'all', 'online', 'offline'
  vehicleType?: string
  ratingMin?: number
  deliveriesMin?: number
}

export interface PaginatedDriverResponse {
  drivers: DriverProfile[]
  totalCount: number
  hasMore: boolean
}

// Get driver statistics
export const getDriverStats = async () => {
  try {
    const supabase = getSupabaseClient()
    const [
      { count: totalDrivers },
      { count: verifiedDrivers },
      { count: pendingDrivers },
      { data: topPerformers }
    ] = await Promise.all([
      supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('user_type', 'driver'),
      supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('user_type', 'driver').eq('status', 'active'),
      supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('user_type', 'driver').eq('status', 'inactive'),
      supabase.from('user_profiles')
        .select('id, first_name, last_name')
        .eq('user_type', 'driver')
        .eq('status', 'active')
        .limit(5)
    ])

    return {
      totalDrivers: totalDrivers || 0,
      verifiedDrivers: verifiedDrivers || 0,
      onlineDrivers: 0, // We don't have online status data yet
      pendingDrivers: pendingDrivers || 0,
      averageRating: 4.5, // Default average rating for now
      topPerformers: (topPerformers || []).map(driver => ({
        user_id: driver.id,
        rating: 4.5,
        total_deliveries: 0,
        user_profiles: {
          first_name: driver.first_name,
          last_name: driver.last_name
        }
      }))
    }
  } catch (error) {
    console.error('Error fetching driver stats:', error)
    return {
      totalDrivers: 0,
      verifiedDrivers: 0,
      onlineDrivers: 0,
      pendingDrivers: 0,
      averageRating: 0,
      topPerformers: []
    }
  }
}

// Search drivers with pagination and filters
export const searchDrivers = async (
  filters: DriverFilters = {},
  page: number = 1,
  limit: number = 50
): Promise<PaginatedDriverResponse> => {
  try {
    const startTime = Date.now();
    const supabase = getSupabaseClient()
    // First, let's get drivers from user_profiles table where user_type = 'driver'
    let query = supabase
      .from('user_profiles')
      .select('*')
      .eq('user_type', 'driver')

    // Apply filters
    if (filters.search) {
      const searchTerm = filters.search.trim()
      query = query.or(`
        first_name.ilike.%${searchTerm}%,
        last_name.ilike.%${searchTerm}%,
        phone_number.ilike.%${searchTerm}%
      `)
    }

    if (filters.status && filters.status !== 'all') {
      switch (filters.status) {
        case 'verified':
          // For now, all active drivers are considered "verified"
          query = query.eq('status', 'active')
          break
        case 'pending':
          // For now, inactive drivers are "pending"
          query = query.eq('status', 'inactive')
          break
        case 'suspended':
          query = query.eq('status', 'suspended')
          break
      }
    }

    // Get total count for pagination
    const countQuery = supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('user_type', 'driver')

    // Apply same filters to count query
    if (filters.status && filters.status !== 'all') {
      switch (filters.status) {
        case 'verified':
          countQuery.eq('status', 'active')
          break
        case 'pending':
          countQuery.eq('status', 'inactive')
          break
        case 'suspended':
          countQuery.eq('status', 'suspended')
          break
      }
    }

    // Execute queries in parallel
    const [{ data: drivers, error: driversError }, { count, error: countError }] = await Promise.all([
      query
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1),
      countQuery
    ])

    if (driversError) throw driversError
    if (countError) throw countError

    // Transform data to match DriverProfile interface
    const transformedDrivers: DriverProfile[] = (drivers || []).map(user => ({
      id: user.id,
      user_id: user.id,
      is_verified: user.status === 'active', // Consider active users as verified
      is_online: false, // Default to offline since we don't have this data yet
      rating: 4.5, // Default rating
      total_deliveries: 0, // Default value
      total_earnings: 0, // Default value
      vehicle_type_id: undefined,
      driver_license_number: undefined,
      license_expiry_date: undefined,
      vehicle_plate_number: undefined,
      emergency_contact_name: undefined,
      emergency_contact_phone: undefined,
      bank_account_number: undefined,
      bank_name: undefined,
      created_at: user.created_at,
      updated_at: user.updated_at,
      user_profile: {
        first_name: user.first_name,
        last_name: user.last_name,
        phone_number: user.phone_number,
        profile_image_url: user.profile_image_url,
        status: user.status
      },
      vehicle_type: undefined
    }))

    const loadTime = Date.now() - startTime;
    const totalPages = Math.ceil((count || 0) / limit);
    console.log(`⚡ Driver Query: Page ${page}/${totalPages} - ${transformedDrivers.length}/${count || 0} drivers in ${loadTime}ms`);
    
    const result = {
      drivers: transformedDrivers,
      totalCount: count || 0,
      hasMore: (page * limit) < (count || 0)
    };
    
    // Cache the result
    setCachedData(cacheKey, result);
    
    return result

  } catch (error) {
    console.error('Error searching drivers:', error)
    return {
      drivers: [],
      totalCount: 0,
      hasMore: false
    }
  }
}

// Get online drivers with cursor-based pagination (better for real-time data)
export const getOnlineDrivers = async (
  lastTimestamp?: string,
  limit: number = 100
) => {
  try {
    const supabase = getSupabaseClient();
    let query = supabase
      .from('driver_profiles')
      .select(`
        id,
        user_id,
        vehicle_type_id,
        is_online,
        rating,
        vehicle_model,
        plate_number,
        updated_at
      `)
      .eq('is_online', true)
      .order('rating', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(limit);
    
    // Cursor-based pagination for real-time updates
    if (lastTimestamp) {
      query = query.gt('updated_at', lastTimestamp);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return {
      success: true,
      data: data || [],
      lastTimestamp: data && data.length > 0 ? data[data.length - 1].updated_at : null
    };
  } catch (error) {
    console.error('Error fetching online drivers:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch online drivers'
    };
  }
};

// Update driver verification status (updates user status)
export const updateDriverVerification = async (userId: string, isVerified: boolean) => {
  try {
    const supabase = getSupabaseClient()
    const { error } = await supabase
      .from('user_profiles')
      .update({ 
        status: isVerified ? 'active' : 'inactive',
        updated_at: new Date().toISOString() 
      })
      .eq('id', userId)

    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error('Error updating driver verification:', error)
    return { success: false, error }
  }
}

// Update driver online status (placeholder for now)
export const updateDriverOnlineStatus = async (userId: string, isOnline: boolean) => {
  try {
    // For now, we'll just return success since we don't have online status in user_profiles
    // In the future, you could add an online_status column or use a separate table
    console.log(`Setting driver ${userId} online status to ${isOnline}`)
    return { success: true }
  } catch (error) {
    console.error('Error updating driver online status:', error)
    return { success: false, error }
  }
}

// Get vehicle types for filters (public data, no admin needed)
export const getVehicleTypes = async () => {
  try {
    console.log('Fetching vehicle types...')
    // Use regular client since vehicle_types is public data
    const supabase = createClient()
    const { data, error } = await supabase
      .from('vehicle_types')
      .select('*')
      .order('name')

    console.log('Vehicle types response:', { data, error })

    if (error) {
      console.error('Supabase error fetching vehicle types:', error)
      throw error
    }
    
    console.log('Vehicle types data:', data)
    return data || []
  } catch (error) {
    console.error('Error fetching vehicle types:', error)
    return []
  }
}

// Update driver profile details
export const updateDriverProfile = async (userId: string, updates: Partial<DriverProfile>) => {
  try {
    const supabase = getSupabaseClient()
    // For now, we can only update basic user profile information
    const userUpdates: any = {}
    if (updates.user_profile) {
      if (updates.user_profile.first_name) userUpdates.first_name = updates.user_profile.first_name
      if (updates.user_profile.last_name) userUpdates.last_name = updates.user_profile.last_name
      if (updates.user_profile.phone_number) userUpdates.phone_number = updates.user_profile.phone_number
    }
    
    if (Object.keys(userUpdates).length > 0) {
      userUpdates.updated_at = new Date().toISOString()
      
      const { error } = await supabase
        .from('user_profiles')
        .update(userUpdates)
        .eq('id', userId)

      if (error) throw error
    }
    
    return { success: true }
  } catch (error) {
    console.error('Error updating driver profile:', error)
    return { success: false, error }
  }
}

// Get driver delivery history (summary)
export const getDriverDeliveryStats = async (userId: string) => {
  try {
    const supabase = getSupabaseClient()
    const [
      { count: totalDeliveries },
      { count: completedDeliveries },
      { count: cancelledDeliveries },
      { data: recentDeliveries }
    ] = await Promise.all([
      supabase.from('deliveries').select('*', { count: 'exact', head: true }).eq('driver_id', userId),
      supabase.from('deliveries').select('*', { count: 'exact', head: true }).eq('driver_id', userId).eq('status', 'delivered'),
      supabase.from('deliveries').select('*', { count: 'exact', head: true }).eq('driver_id', userId).eq('status', 'cancelled'),
      supabase.from('deliveries')
        .select('id, status, created_at, delivery_fee')
        .eq('driver_id', userId)
        .order('created_at', { ascending: false })
        .limit(5)
    ])

    return {
      totalDeliveries: totalDeliveries || 0,
      completedDeliveries: completedDeliveries || 0,
      cancelledDeliveries: cancelledDeliveries || 0,
      recentDeliveries: recentDeliveries || []
    }
  } catch (error) {
    console.error('Error fetching driver delivery stats:', error)
    return {
      totalDeliveries: 0,
      completedDeliveries: 0,
      cancelledDeliveries: 0,
      recentDeliveries: []
    }
  }
}