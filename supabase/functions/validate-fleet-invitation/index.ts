import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ValidateRequest {
  code: string
}

interface ValidateResponse {
  valid: boolean
  business_id?: string
  business_name?: string
  business_tier?: string
  expires_at?: string
  error?: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Denv.get('SUPABASE_URL') ?? '',
      Denv.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser()

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
    const { code }: ValidateRequest = await req.json()

    if (!code || typeof code !== 'string' || code.trim() === '') {
      return new Response(
        JSON.stringify({ 
          valid: false,
          error: 'Invitation code is required' 
        } as ValidateResponse),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Call database function to validate code
    const { data, error } = await supabaseClient.rpc('validate_invitation_code', {
      p_code: code.trim()
    })

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ 
          valid: false,
          error: 'Failed to validate invitation code' 
        } as ValidateResponse),
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
          valid: false,
          error: 'Invalid response from validation function' 
        } as ValidateResponse),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Build response
    const response: ValidateResponse = {
      valid: result.valid,
      business_id: result.business_id,
      business_name: result.business_name,
      business_tier: result.business_tier,
      expires_at: result.expires_at,
      error: result.error_message
    }

    return new Response(
      JSON.stringify(response),
      { 
        status: result.valid ? 200 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ 
        valid: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred' 
      } as ValidateResponse),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
