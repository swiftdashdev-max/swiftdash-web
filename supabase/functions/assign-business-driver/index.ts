// Supabase Edge Function: assign-business-driver
// Purpose: Assign a driver to a business delivery with validation and notifications
// Date: November 9, 2025

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AssignDriverRequest {
  delivery_id: string
  driver_id: string
  assigned_by: string // user_id of dispatcher
  assignment_type?: 'manual' | 'auto'
}

interface AssignDriverResponse {
  success: boolean
  message: string
  data?: {
    delivery_id: string
    driver_id: string
    status: string
    assigned_at: string
  }
  error?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Parse request body
    const { 
      delivery_id, 
      driver_id, 
      assigned_by,
      assignment_type = 'manual'
    }: AssignDriverRequest = await req.json()

    // Validation
    if (!delivery_id || !driver_id || !assigned_by) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: delivery_id, driver_id, assigned_by'
        } as AssignDriverResponse),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`[assign-business-driver] Starting assignment: delivery=${delivery_id}, driver=${driver_id}`)

    // Step 1: Validate driver availability
    const { data: driver, error: driverError } = await supabaseAdmin
      .from('driver_profiles')
      .select('id, current_status, employment_type, managed_by_business_id')
      .eq('id', driver_id)
      .single()

    if (driverError || !driver) {
      console.error('[assign-business-driver] Driver not found:', driverError)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Driver not found'
        } as AssignDriverResponse),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if driver is online
    if (driver.current_status !== 'online') {
      console.warn(`[assign-business-driver] Driver ${driver_id} is ${driver.current_status}, not online`)
      return new Response(
        JSON.stringify({
          success: false,
          error: `Driver is currently ${driver.current_status}. Please select an online driver.`
        } as AssignDriverResponse),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Step 2: Check if delivery exists and is available
    const { data: delivery, error: deliveryError } = await supabaseAdmin
      .from('deliveries')
      .select('id, status, driver_id, business_id, pickup_address, delivery_address, total_amount')
      .eq('id', delivery_id)
      .single()

    if (deliveryError || !delivery) {
      console.error('[assign-business-driver] Delivery not found:', deliveryError)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Delivery not found'
        } as AssignDriverResponse),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if delivery is already assigned
    if (delivery.driver_id && delivery.status !== 'pending') {
      console.warn(`[assign-business-driver] Delivery ${delivery_id} already assigned to ${delivery.driver_id}`)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Delivery is already assigned to another driver'
        } as AssignDriverResponse),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Step 3: Begin atomic transaction - Update delivery
    const assignedAt = new Date().toISOString()
    
    const { data: updatedDelivery, error: updateDeliveryError } = await supabaseAdmin
      .from('deliveries')
      .update({
        driver_id: driver_id,
        status: 'driver_assigned',
        driver_source: 'business_dispatch',
        assignment_type: assignment_type,
        assigned_by: assigned_by,
        assigned_at: assignedAt,
        updated_at: assignedAt
      })
      .eq('id', delivery_id)
      .select()
      .single()

    if (updateDeliveryError) {
      console.error('[assign-business-driver] Failed to update delivery:', updateDeliveryError)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to assign delivery to driver'
        } as AssignDriverResponse),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`[assign-business-driver] Delivery ${delivery_id} updated successfully`)

    // Step 4: Update driver status to busy
    const { error: updateDriverError } = await supabaseAdmin
      .from('driver_profiles')
      .update({
        current_status: 'busy',
        current_delivery_id: delivery_id,
        updated_at: assignedAt
      })
      .eq('id', driver_id)

    if (updateDriverError) {
      console.error('[assign-business-driver] Failed to update driver status:', updateDriverError)
      // Rollback delivery assignment
      await supabaseAdmin
        .from('deliveries')
        .update({
          driver_id: null,
          status: 'pending',
          driver_source: null,
          assigned_by: null,
          assigned_at: null
        })
        .eq('id', delivery_id)

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to update driver status'
        } as AssignDriverResponse),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`[assign-business-driver] Driver ${driver_id} status updated to busy`)

    // Step 5: Get driver's FCM token for push notification
    const { data: driverProfile } = await supabaseAdmin
      .from('driver_profiles')
      .select('fcm_token')
      .eq('id', driver_id)
      .single()

    // Step 6: Send push notification (if FCM token exists)
    if (driverProfile?.fcm_token) {
      try {
        console.log(`[assign-business-driver] Sending FCM notification to driver ${driver_id}`)
        
        // Get business name
        const { data: business } = await supabaseAdmin
          .from('business_accounts')
          .select('business_name')
          .eq('id', delivery.business_id)
          .single()

        // TODO: Integrate with Firebase Cloud Messaging
        // For now, log the notification payload
        const notificationPayload = {
          notification: {
            title: 'New Business Delivery Assigned',
            body: `Pickup: ${business?.business_name || 'Business'} - ₱${delivery.total_amount}`
          },
          data: {
            type: 'business_delivery_assigned',
            delivery_id: delivery_id,
            business_name: business?.business_name || 'Business',
            business_id: delivery.business_id || '',
            pickup_address: delivery.pickup_address,
            dropoff_address: delivery.delivery_address,
            total_amount: delivery.total_amount.toString(),
            priority: 'normal',
            assignment_type: assignment_type,
            auto_accept: 'true'
          }
        }

        console.log('[assign-business-driver] FCM Notification payload:', notificationPayload)
        
        // TODO: Call Firebase Admin SDK to send notification
        // await sendFCMNotification(driverProfile.fcm_token, notificationPayload)
        
      } catch (notificationError) {
        console.error('[assign-business-driver] Failed to send notification:', notificationError)
        // Don't fail the assignment if notification fails
      }
    } else {
      console.warn(`[assign-business-driver] No FCM token for driver ${driver_id}`)
    }

    // Success response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Driver assigned successfully',
        data: {
          delivery_id: delivery_id,
          driver_id: driver_id,
          status: 'driver_assigned',
          assigned_at: assignedAt
        }
      } as AssignDriverResponse),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('[assign-business-driver] Unexpected error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      } as AssignDriverResponse),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
