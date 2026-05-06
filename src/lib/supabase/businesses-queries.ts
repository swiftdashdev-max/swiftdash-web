import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface BusinessAccount {
  id: string
  business_name: string
  business_email: string
  business_phone?: string
  primary_contact_name: string
  primary_contact_email: string
  primary_contact_phone: string
  account_status: 'active' | 'suspended' | 'trial' | 'cancelled' | 'pending_approval'
  subscription_tier: string
  created_at: string
  updated_at: string
}

export interface BusinessFilters {
  search?: string
  status?: string
}

export interface PaginatedBusinessResponse {
  businesses: BusinessAccount[]
  totalCount: number
  hasMore: boolean
}

export const searchBusinesses = async (
  filters: BusinessFilters = {},
  page: number = 1,
  limit: number = 50
): Promise<PaginatedBusinessResponse> => {
  try {
    let query = supabase.from('business_accounts').select('*')

    if (filters.search) {
      const searchTerm = filters.search.trim()
      query = query.or(`
        business_name.ilike.%${searchTerm}%,
        business_email.ilike.%${searchTerm}%,
        primary_contact_name.ilike.%${searchTerm}%
      `)
    }

    if (filters.status && filters.status !== 'all') {
      query = query.eq('account_status', filters.status)
    }

    const countQuery = supabase.from('business_accounts').select('*', { count: 'exact', head: true })

    if (filters.search) {
      const searchTerm = filters.search.trim()
      countQuery.or(`
        business_name.ilike.%${searchTerm}%,
        business_email.ilike.%${searchTerm}%,
        primary_contact_name.ilike.%${searchTerm}%
      `)
    }

    if (filters.status && filters.status !== 'all') {
      countQuery.eq('account_status', filters.status)
    }

    const [{ data: businesses, error: businessesError }, { count, error: countError }] = await Promise.all([
      query
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1),
      countQuery
    ])

    if (businessesError) throw businessesError
    if (countError) throw countError

    return {
      businesses: businesses || [],
      totalCount: count || 0,
      hasMore: (page * limit) < (count || 0)
    }
  } catch (error) {
    console.error('Error searching businesses:', error)
    return {
      businesses: [],
      totalCount: 0,
      hasMore: false
    }
  }
}

export const updateBusinessStatus = async (businessId: string, status: BusinessAccount['account_status']) => {
  try {
    const { error } = await supabase
      .from('business_accounts')
      .update({ 
        account_status: status, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', businessId)

    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error('Error updating business status:', error)
    return { success: false, error }
  }
}

export const getBusinessStats = async () => {
  try {
    const [
      { count: total },
      { count: pending },
      { count: active }
    ] = await Promise.all([
      supabase.from('business_accounts').select('*', { count: 'exact', head: true }),
      supabase.from('business_accounts').select('*', { count: 'exact', head: true }).eq('account_status', 'pending_approval'),
      supabase.from('business_accounts').select('*', { count: 'exact', head: true }).eq('account_status', 'active')
    ])

    return {
      total: total || 0,
      pending: pending || 0,
      active: active || 0
    }
  } catch (error) {
    console.error('Error fetching business stats:', error)
    return {
      total: 0,
      pending: 0,
      active: 0
    }
  }
}
