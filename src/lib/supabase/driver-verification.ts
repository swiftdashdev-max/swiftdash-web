import { createClient } from './client'
import { createDriverClient } from './driver-client'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Create authenticated client that uses user session
const getSupabaseClient = () => createClient()

// Create non-persistent client for driver verification (temporary sessions)
const getDriverSupabaseClient = () => createDriverClient()

// Create admin client for admin operations
const getSupabaseAdmin = () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin operations')
  }
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

export interface DriverVerificationSubmission {
  id?: string;
  user_id: string;
  vehicle_type: string; // Required TEXT field (NOT NULL)
  vehicle_type_id?: string; // Optional UUID field (NULLABLE)
  documents: Record<string, string[]>;
  file_names: Record<string, string[]>;
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'needs_revision';
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
  submitted_at: string;
  created_at?: string;
  updated_at?: string;
}

// Save driver verification submission
export const saveDriverVerificationSubmission = async (
  submission: Omit<DriverVerificationSubmission, 'id' | 'created_at' | 'updated_at'>
) => {
  try {
    // Use non-persistent driver client for verification operations
    const supabase = getDriverSupabaseClient()
    const { data, error } = await supabase
      .from('driver_verification_submissions')
      .insert([submission])
      .select('*')
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error saving verification submission:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save submission'
    };
  }
};

// Get driver verification submissions (admin view)
export const getDriverVerificationSubmissions = async (
  filters: {
    status?: string;
    limit?: number;
    offset?: number;
  } = {}
) => {
  try {
    const supabaseAdmin = getSupabaseAdmin()

    let query = supabaseAdmin
      .from('driver_verification_submissions')
      .select(`
        *,
        user_profiles!inner (
          id,
          first_name,
          last_name,
          email,
          phone_number
        ),
        vehicle_types!inner (
          id,
          name,
          description
        ),
        reviewed_by_profile:user_profiles!reviewed_by (
          first_name,
          last_name
        )
      `)
      .order('submitted_at', { ascending: false });

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return { success: true, data, count };
  } catch (error) {
    console.error('Error fetching verification submissions:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch submissions'
    };
  }
};

// Get verification submission by user ID
export const getDriverVerificationByUserId = async (userId: string) => {
  try {
    // Use non-persistent driver client for verification operations
    const supabase = getDriverSupabaseClient()
    const { data, error } = await supabase
      .from('driver_verification_submissions')
      .select('*')
      .eq('user_id', userId)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned

    return { success: true, data: data || null };
  } catch (error) {
    console.error('Error fetching user verification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch verification'
    };
  }
};

// Update verification submission status (admin action)
export const updateVerificationStatus = async (
  submissionId: string,
  status: DriverVerificationSubmission['status'],
  reviewedBy: string,
  reviewNotes?: string
) => {
  try {
    const supabaseAdmin = getSupabaseAdmin()

    const { data, error } = await supabaseAdmin
      .from('driver_verification_submissions')
      .update({
        status,
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes || null
      })
      .eq('id', submissionId)
      .select('*')
      .single();

    if (error) throw error;

    // Also update the user's verification status in user_profiles
    if (status === 'approved') {
      await supabaseAdmin
        .from('user_profiles')
        .update({ 
          status: 'active',
          // You might want to add a verification_status field to user_profiles
        })
        .eq('id', data.user_id);
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error updating verification status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update status'
    };
  }
};

// Get verification statistics for admin dashboard
export const getVerificationStats = async () => {
  try {
    const supabaseAdmin = getSupabaseAdmin()

    const { data, error } = await supabaseAdmin
      .from('driver_verification_submissions')
      .select(`
        status,
        submitted_at
      `);

    if (error) throw error;

    const stats = {
      total: data.length,
      pending: data.filter(s => s.status === 'pending').length,
      under_review: data.filter(s => s.status === 'under_review').length,
      approved: data.filter(s => s.status === 'approved').length,
      rejected: data.filter(s => s.status === 'rejected').length,
      needs_revision: data.filter(s => s.status === 'needs_revision').length,
      this_week: data.filter(s => {
        const submittedDate = new Date(s.submitted_at);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return submittedDate >= weekAgo;
      }).length
    };

    return { success: true, data: stats };
  } catch (error) {
    console.error('Error fetching verification stats:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch stats'
    };
  }
};