import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AcceptRequest {
  code: string
  driver_id: string
}

interface AcceptResponse {
  success: boolean
  business_id?: string
  business_name?: string
  message?: string
  error?: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role for updating driver profile
    const supabaseClient = createClient(
      Denv.get('SUPABASE_URL') ?? '',
      Denv.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Verify user is authenticated (using anon key client)
    const anonClient = createClient(
      Denv.get('SUPABASE_URL') ?? '',
      Denv.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const {
      data: { user },
      error: authError,
    } = await anonClient.auth.getUser()

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Parse request body
    const { code, driver_id }: AcceptRequest = await req.json()

    if (!code || typeof code !== 'string' || code.trim() === '') {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Invitation code is required' 
        } as AcceptResponse),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!driver_id || typeof driver_id !== 'string') {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Driver ID is required' 
        } as AcceptResponse),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Verify the driver_id belongs to the authenticated user
    const { data: driverProfile, error: driverError } = await supabaseClient
      .from('driver_profiles')
      .select('id, user_id, full_name')
      .eq('id', driver_id)
      .single()

    if (driverError || !driverProfile) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Driver profile not found' 
        } as AcceptResponse),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Verify the driver profile belongs to the authenticated user
    if (driverProfile.user_id !== user.id) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Unauthorized: Driver profile does not belong to you' 
        } as AcceptResponse),
        { 
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Call database function to accept invitation
    const { data, error } = await supabaseClient.rpc('accept_invitation_code', {
      p_code: code.trim(),
      p_driver_id: driver_id
    })

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Failed to accept invitation code' 
        } as AcceptResponse),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Extract result (function returns single row)
    const result = data && data.length > 0 ? data[0] : null

    if (!result) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Invalid response from acceptance function' 
        } as AcceptResponse),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // If not successful, return error
    if (!result.success) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: result.error_message 
        } as AcceptResponse),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get business details for response
    const { data: business } = await supabaseClient
      .from('business_accounts')
      .select('business_name')
      .eq('id', result.business_id)
      .single()

    // Build success response
    const response: AcceptResponse = {
      success: true,
      business_id: result.business_id,
      business_name: business?.business_name,
      message: `Successfully joined ${business?.business_name || 'fleet'}`
    }

    return new Response(
      JSON.stringify(response),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred' 
      } as AcceptResponse),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
