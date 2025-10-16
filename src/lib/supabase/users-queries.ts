import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// User types
export interface UserProfile {
  id: string
  phone_number: string
  first_name: string
  last_name: string
  user_type: 'customer' | 'driver' | 'admin' | 'business' | 'crm'
  profile_image_url?: string
  status: 'active' | 'inactive' | 'suspended'
  created_at: string
  updated_at: string
  business_name?: string
  // Driver profile data (optional, fetched separately if needed)
  driver_profile?: {
    is_verified?: boolean
    is_online?: boolean
    rating?: number
    total_deliveries?: number
    vehicle_type?: string
  }
}

export interface UserFilters {
  search?: string
  userType?: string
  status?: string
  dateFrom?: string
  dateTo?: string
}

export interface PaginatedUserResponse {
  users: UserProfile[]
  totalCount: number
  hasMore: boolean
}

// Optimized user search with pagination and filters
export const searchUsers = async (
  filters: UserFilters = {},
  page: number = 1,
  limit: number = 50
): Promise<PaginatedUserResponse> => {
  try {
    let query = supabase
      .from('user_profiles')
      .select('*')

    // Apply filters
    if (filters.search) {
      // Use full-text search for better performance with large datasets
      const searchTerm = filters.search.trim()
      query = query.or(`
        first_name.ilike.%${searchTerm}%,
        last_name.ilike.%${searchTerm}%,
        phone_number.ilike.%${searchTerm}%,
        business_name.ilike.%${searchTerm}%
      `)
    }

    if (filters.userType && filters.userType !== 'all') {
      query = query.eq('user_type', filters.userType)
    }

    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status)
    }

    if (filters.dateFrom) {
      query = query.gte('created_at', filters.dateFrom)
    }

    if (filters.dateTo) {
      query = query.lte('created_at', filters.dateTo)
    }

    // Get total count for pagination (separate query for performance)
    const countQuery = supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })

    // Apply same filters to count query
    if (filters.search) {
      const searchTerm = filters.search.trim()
      countQuery.or(`
        first_name.ilike.%${searchTerm}%,
        last_name.ilike.%${searchTerm}%,
        phone_number.ilike.%${searchTerm}%,
        business_name.ilike.%${searchTerm}%
      `)
    }

    if (filters.userType && filters.userType !== 'all') {
      countQuery.eq('user_type', filters.userType)
    }

    if (filters.status && filters.status !== 'all') {
      countQuery.eq('status', filters.status)
    }

    if (filters.dateFrom) {
      countQuery.gte('created_at', filters.dateFrom)
    }

    if (filters.dateTo) {
      countQuery.lte('created_at', filters.dateTo)
    }

    // Execute queries in parallel
    const [{ data: users, error: usersError }, { count, error: countError }] = await Promise.all([
      query
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1),
      countQuery
    ])

    if (usersError) throw usersError
    if (countError) throw countError

    // For now, return users without driver profile data
    // We'll add driver profile data in a separate query if needed
    const transformedUsers: UserProfile[] = (users || []).map(user => ({
      ...user,
      driver_profile: undefined // We'll handle this separately later
    }))

    return {
      users: transformedUsers,
      totalCount: count || 0,
      hasMore: (page * limit) < (count || 0)
    }

  } catch (error) {
    console.error('Error searching users:', error)
    return {
      users: [],
      totalCount: 0,
      hasMore: false
    }
  }
}

// Get user statistics for the page header
export const getUserStats = async () => {
  try {
    const [
      { count: totalUsers },
      { count: activeUsers },
      { count: drivers },
      { count: customers },
      { count: businesses },
      { count: suspendedUsers }
    ] = await Promise.all([
      supabase.from('user_profiles').select('*', { count: 'exact', head: true }),
      supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('user_type', 'driver'),
      supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('user_type', 'customer'),
      supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('user_type', 'business'),
      supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('status', 'suspended')
    ])

    return {
      totalUsers: totalUsers || 0,
      activeUsers: activeUsers || 0,
      drivers: drivers || 0,
      customers: customers || 0,
      businesses: businesses || 0,
      suspendedUsers: suspendedUsers || 0
    }

  } catch (error) {
    console.error('Error fetching user stats:', error)
    return {
      totalUsers: 0,
      activeUsers: 0,
      drivers: 0,
      customers: 0,
      businesses: 0,
      suspendedUsers: 0
    }
  }
}

// Update user status
export const updateUserStatus = async (userId: string, status: 'active' | 'inactive' | 'suspended') => {
  try {
    const { error } = await supabase
      .from('user_profiles')
      .update({ 
        status, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', userId)

    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error('Error updating user status:', error)
    return { success: false, error }
  }
}

// Delete user (soft delete by changing status)
export const deleteUser = async (userId: string) => {
  try {
    const { error } = await supabase
      .from('user_profiles')
      .update({ 
        status: 'inactive',
        updated_at: new Date().toISOString() 
      })
      .eq('id', userId)

    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error('Error deleting user:', error)
    return { success: false, error }
  }
}

// Create new user
export const createUser = async (userData: Partial<UserProfile>) => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .insert([{
        phone_number: userData.phone_number,
        first_name: userData.first_name,
        last_name: userData.last_name,
        user_type: userData.user_type,
        status: userData.status || 'active',
        business_name: userData.business_name || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (error) throw error
    return { success: true, user: data }
  } catch (error) {
    console.error('Error creating user:', error)
    return { success: false, error }
  }
}