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
  // Enhanced fields for fleet/marketplace assignment
  vehicle_type_id?: string
  fleet_vehicle_id?: string | null
  driver_source: 'fleet' | 'marketplace'
  payment_by?: 'sender' | 'recipient' | null
  payment_method?: 'cash' | 'credit_card' | 'maya_wallet' | 'qr_ph' | null
  total_price?: number
  delivery_fee?: number
}

interface AssignDriverResponse {
  success: boolean
  message: string
  data?: {
    delivery_id: string
    driver_id: string
    status: string
    assigned_at: string
    driver_source: string
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
      assignment_type = 'manual',
      vehicle_type_id,
      fleet_vehicle_id,
      driver_source,
      payment_by,
      payment_method,
      total_price,
      delivery_fee
    }: AssignDriverRequest = await req.json()

    // Validation
    if (!delivery_id || !driver_id || !assigned_by || !driver_source) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: delivery_id, driver_id, assigned_by, driver_source'
        } as AssignDriverResponse),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate driver_source
    if (driver_source !== 'fleet' && driver_source !== 'marketplace') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'driver_source must be either "fleet" or "marketplace"'
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

    // Check if driver is available (online or busy)
    const availableStatuses = ['online', 'busy'];
    if (!availableStatuses.includes(driver.current_status)) {
      console.warn(`[assign-business-driver] Driver ${driver_id} is ${driver.current_status}, not available`)
      return new Response(
        JSON.stringify({
          success: false,
          error: `Driver is currently ${driver.current_status}. Please select an available driver.`
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

    // Step 3: Prepare delivery update data
    const assignedAt = new Date().toISOString()
    
    // Determine payment_status based on driver_source
    // Fleet: null (no payment needed), Marketplace: 'pending' (payment required)
    const payment_status = driver_source === 'fleet' ? null : 'pending'
    
    // Build update object
    const deliveryUpdate: any = {
      driver_id: driver_id,
      status: 'driver_assigned',
      driver_source: 'business_dispatch',
      assignment_type: assignment_type,
      assigned_by: assigned_by,
      assigned_at: assignedAt,
      updated_at: assignedAt,
      payment_status: payment_status,
    }

    // Add vehicle_type_id if provided
    if (vehicle_type_id) {
      deliveryUpdate.vehicle_type_id = vehicle_type_id
    }

    // Add fleet_vehicle_id if provided (fleet assignment)
    if (fleet_vehicle_id) {
      deliveryUpdate.fleet_vehicle_id = fleet_vehicle_id
    }

    // Add pricing fields if provided
    if (total_price !== undefined) {
      deliveryUpdate.total_price = total_price
      deliveryUpdate.total_amount = total_price
    }
    if (delivery_fee !== undefined) {
      deliveryUpdate.delivery_fee = delivery_fee
    }

    // Add payment fields for marketplace drivers
    if (driver_source === 'marketplace') {
      if (payment_by) deliveryUpdate.payment_by = payment_by
      if (payment_method) deliveryUpdate.payment_method = payment_method
    } else {
      // Fleet drivers - clear payment fields
      deliveryUpdate.payment_by = null
      deliveryUpdate.payment_method = null
    }

    console.log('[assign-business-driver] Updating delivery with:', deliveryUpdate)

    // Step 4: Update delivery in database
    const { data: updatedDelivery, error: updateDeliveryError } = await supabaseAdmin
      .from('deliveries')
      .update(deliveryUpdate)
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

    // Step 5: Update driver status to busy
    const { error: updateDriverError } = await supabaseAdmin
      .from('driver_profiles')
      .update({
        current_status: 'busy',
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

    // Step 6: Update fleet vehicle status if fleet assignment
    if (driver_source === 'fleet' && fleet_vehicle_id) {
      console.log(`[assign-business-driver] Updating fleet vehicle ${fleet_vehicle_id} status to busy`)
      
      const { error: updateVehicleError } = await supabaseAdmin
        .from('business_fleet')
        .update({
          current_status: 'busy',
          updated_at: assignedAt
        })
        .eq('id', fleet_vehicle_id)

      if (updateVehicleError) {
        console.error('[assign-business-driver] Failed to update fleet vehicle status:', updateVehicleError)
        // Don't rollback the entire assignment, just log the error
        // The delivery is still assigned, vehicle status will be corrected later
      } else {
        console.log(`[assign-business-driver] Fleet vehicle ${fleet_vehicle_id} status updated to busy`)
      }
    }

    // Step 7: Get driver's FCM token for push notification
    const { data: driverProfile } = await supabaseAdmin
      .from('driver_profiles')
      .select('fcm_token')
      .eq('id', driver_id)
      .single()

    // Step 8: Send push notification (if FCM token exists)
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
        message: `Driver assigned successfully (${driver_source})`,
        data: {
          delivery_id: delivery_id,
          driver_id: driver_id,
          status: 'driver_assigned',
          assigned_at: assignedAt,
          driver_source: driver_source,
          payment_status: payment_status
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
