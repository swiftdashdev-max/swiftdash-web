// Business Driver Pairing Edge Function
// 3-Tier Priority: Private Fleet → Public Fleet → Global Pool (B2C fallback)
// Supports: Auto dispatch & Manual assignment
// Created: November 3, 2025

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  try {
    if (req.method !== "POST") {
      return new Response("Only POST", { 
        status: 405,
        headers: corsHeaders 
      });
    }

    const body = await req.json();
    
    if (!body?.deliveryId) {
      return new Response("Missing deliveryId", { 
        status: 400,
        headers: corsHeaders 
      });
    }

    const mode = body.mode || 'auto'; // 'auto' or 'manual'
    const manualDriverId = body.driverId; // For manual assignment

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response("Missing Supabase env", { 
        status: 500,
        headers: corsHeaders 
      });
    }

    // Use service role for business operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get delivery details
    const { data: delivery, error: deliveryErr } = await supabase
      .from('deliveries')
      .select(`
        id, business_id, status, driver_id,
        pickup_latitude, pickup_longitude,
        delivery_latitude, delivery_longitude,
        vehicle_type_id, distance_km,
        is_multi_stop, total_stops,
        is_scheduled, scheduled_pickup_time
      `)
      .eq('id', body.deliveryId)
      .single();

    if (deliveryErr || !delivery) {
      console.error('Delivery not found:', deliveryErr);
      return new Response("Delivery not found", { 
        status: 404,
        headers: corsHeaders 
      });
    }

    // Verify this is a business delivery
    if (!delivery.business_id) {
      return new Response(JSON.stringify({
        ok: false,
        message: "Not a business delivery - use global pair-driver function"
      }), { 
        headers: { ...corsHeaders, 'content-type': 'application/json' },
        status: 400 
      });
    }

    // Check if already assigned
    if (delivery.status !== 'pending' || delivery.driver_id) {
      return new Response(JSON.stringify({
        ok: false,
        message: `Delivery already assigned or status is ${delivery.status}`
      }), {
        headers: { ...corsHeaders, 'content-type': 'application/json' },
        status: 400
      });
    }

    // ⏰ Check scheduled delivery timing
    if (delivery.is_scheduled && delivery.scheduled_pickup_time) {
      const scheduledTime = new Date(delivery.scheduled_pickup_time);
      const now = new Date();
      const fifteenMinutesBeforePickup = new Date(scheduledTime.getTime() - 15 * 60 * 1000);

      if (now < fifteenMinutesBeforePickup) {
        const minutesUntilAssignment = Math.ceil(
          (fifteenMinutesBeforePickup.getTime() - now.getTime()) / (60 * 1000)
        );
        
        return new Response(JSON.stringify({
          ok: false,
          scheduled: true,
          message: `Scheduled delivery - driver will be assigned ${minutesUntilAssignment} minutes before pickup`,
          scheduled_for: delivery.scheduled_pickup_time,
          minutes_until_assignment: minutesUntilAssignment
        }), {
          status: 200,
          headers: { ...corsHeaders, 'content-type': 'application/json' }
        });
      }
    }

    let assignedDriver = null;
    let driverSource = null;

    // ==================================================
    // MANUAL ASSIGNMENT MODE
    // ==================================================
    if (mode === 'manual' && manualDriverId) {
      console.log(`👤 Manual assignment requested for driver: ${manualDriverId}`);
      
      // Verify driver exists and is available
      const { data: driver, error: driverErr } = await supabase
        .from('driver_profiles')
        .select('id, current_latitude, current_longitude, employment_type, managed_by_business_id, current_status')
        .eq('id', manualDriverId)
        .single();

      if (driverErr || !driver) {
        return new Response(JSON.stringify({
          ok: false,
          message: "Driver not found"
        }), { 
          headers: { ...corsHeaders, 'content-type': 'application/json' },
          status: 404 
        });
      }

      if (driver.current_status !== 'online') {
        return new Response(JSON.stringify({
          ok: false,
          message: `Driver is ${driver.current_status} - cannot assign`
        }), { 
          headers: { ...corsHeaders, 'content-type': 'application/json' },
          status: 400 
        });
      }

      // Determine driver source
      if (driver.employment_type === 'fleet_driver' && driver.managed_by_business_id === delivery.business_id) {
        driverSource = 'private_fleet';
      } else if (driver.employment_type === 'fleet_driver') {
        driverSource = 'other_business_fleet';
      } else {
        driverSource = 'independent_driver';
      }

      assignedDriver = {
        driver_id: manualDriverId,
        distance_km: calculateDistance(
          delivery.pickup_latitude,
          delivery.pickup_longitude,
          driver.current_latitude,
          driver.current_longitude
        ),
        source: driverSource
      };

      console.log(`✅ Manual assignment: ${driverSource}`);
    } 
    // ==================================================
    // AUTO DISPATCH MODE - 3-TIER PRIORITY
    // ==================================================
    else {
      console.log(`🤖 Auto dispatch - searching 3-tier priority for business: ${delivery.business_id}`);

      // PRIORITY 1: Business Private Fleet
      console.log('🔍 Priority 1: Searching private fleet...');
      const { data: privateFleet, error: privateErr } = await supabase.rpc(
        'find_business_fleet_driver',
        {
          p_business_id: delivery.business_id,
          p_pickup_lat: delivery.pickup_latitude,
          p_pickup_lng: delivery.pickup_longitude,
          p_vehicle_type_id: delivery.vehicle_type_id,
          p_access_mode: 'private',
          p_max_distance_km: 10
        }
      );

      if (!privateErr && privateFleet?.[0]) {
        assignedDriver = privateFleet[0];
        driverSource = 'private_fleet';
        console.log(`✅ Found private fleet driver: ${assignedDriver.driver_id} at ${assignedDriver.distance_km}km`);
      }

      // PRIORITY 2: Business Public Fleet
      if (!assignedDriver) {
        console.log('🔍 Priority 2: Searching public fleet...');
        const { data: publicFleet, error: publicErr } = await supabase.rpc(
          'find_business_fleet_driver',
          {
            p_business_id: delivery.business_id,
            p_pickup_lat: delivery.pickup_latitude,
            p_pickup_lng: delivery.pickup_longitude,
            p_vehicle_type_id: delivery.vehicle_type_id,
            p_access_mode: 'public',
            p_max_distance_km: 10
          }
        );

        if (!publicErr && publicFleet?.[0]) {
          assignedDriver = publicFleet[0];
          driverSource = 'public_fleet';
          console.log(`✅ Found public fleet driver: ${assignedDriver.driver_id} at ${assignedDriver.distance_km}km`);
        }
      }

      // PRIORITY 3: Global Pool (Other Businesses + Independent Drivers)
      if (!assignedDriver) {
        console.log('🔍 Priority 3: Searching global pool...');
        const { data: globalPool, error: globalErr } = await supabase.rpc(
          'find_public_pool_driver',
          {
            p_business_id: delivery.business_id,
            p_pickup_lat: delivery.pickup_latitude,
            p_pickup_lng: delivery.pickup_longitude,
            p_vehicle_type_id: delivery.vehicle_type_id,
            p_max_distance_km: 15, // Wider radius for global
            p_include_other_business_fleets: true
          }
        );

        if (!globalErr && globalPool?.[0]) {
          assignedDriver = globalPool[0];
          driverSource = globalPool[0].employment_type === 'independent' 
            ? 'independent_driver' 
            : 'other_business_fleet';
          console.log(`✅ Found global pool driver: ${assignedDriver.driver_id} at ${assignedDriver.distance_km}km (${driverSource})`);
        }
      }
    }

    // No drivers found
    if (!assignedDriver) {
      console.error('❌ No drivers available in any tier');
      return new Response(JSON.stringify({
        ok: false,
        message: 'No drivers available - all fleet and pool drivers are busy',
        business_id: delivery.business_id
      }), {
        headers: { ...corsHeaders, 'content-type': 'application/json' },
        status: 404
      });
    }

    // ==================================================
    // CALCULATE PRICING (same logic as global pair-driver)
    // ==================================================
    const { data: vehicleType } = await supabase
      .from('vehicle_types')
      .select('base_price, price_per_km, additional_stop_charge')
      .eq('id', delivery.vehicle_type_id)
      .single();

    let distanceKm = 0;

    // Multi-stop delivery route calculation
    if (delivery.is_multi_stop) {
      const { data: stops } = await supabase
        .from('delivery_stops')
        .select('latitude, longitude, stop_number')
        .eq('delivery_id', delivery.id)
        .order('stop_number');

      if (stops && stops.length > 0) {
        for (let i = 0; i < stops.length - 1; i++) {
          distanceKm += calculateDistance(
            stops[i].latitude,
            stops[i].longitude,
            stops[i + 1].latitude,
            stops[i + 1].longitude
          );
        }
      }
    } else {
      distanceKm = calculateDistance(
        delivery.pickup_latitude,
        delivery.pickup_longitude,
        delivery.delivery_latitude,
        delivery.delivery_longitude
      );
    }

    const basePrice = Number(vehicleType?.base_price) || 0;
    const pricePerKm = Number(vehicleType?.price_per_km) || 0;
    const additionalStopCharge = Number(vehicleType?.additional_stop_charge) || 0;

    const additionalStops = delivery.is_multi_stop ? Math.max(0, delivery.total_stops - 1) : 0;
    const additionalStopsTotal = additionalStops * additionalStopCharge;

    const subtotal = basePrice + (pricePerKm * distanceKm) + additionalStopsTotal;
    const vat = subtotal * 0.12;
    const totalAmount = Math.max(1, Math.round((subtotal + vat) * 100) / 100);

    console.log(`💰 Pricing: Distance ${distanceKm.toFixed(2)}km, Base ₱${basePrice}, Total ₱${totalAmount}`);

    // ==================================================
    // ASSIGN DRIVER TO DELIVERY
    // ==================================================
    const { error: updateErr } = await supabase
      .from('deliveries')
      .update({
        driver_id: assignedDriver.driver_id,
        fleet_vehicle_id: assignedDriver.vehicle_id || null,
        assignment_type: mode,
        status: 'driver_offered',
        distance_km: Math.round(distanceKm * 10) / 10,
        total_amount: totalAmount,
        driver_source: driverSource,
        updated_at: new Date().toISOString()
      })
      .eq('id', delivery.id);

    if (updateErr) {
      console.error('Failed to assign driver:', updateErr);
      throw updateErr;
    }

    // Update vehicle status if from fleet
    if (assignedDriver.vehicle_id) {
      await supabase
        .from('business_fleet')
        .update({ current_status: 'busy' })
        .eq('id', assignedDriver.vehicle_id);
    }

    // Update driver status
    await supabase
      .from('driver_profiles')
      .update({ current_status: 'busy' })
      .eq('id', assignedDriver.driver_id);

    // Log the assignment
    await supabase.rpc('log_fleet_action', {
      p_business_id: delivery.business_id,
      p_user_id: null, // TODO: Get from auth context
      p_action_type: 'driver_assigned',
      p_entity_type: 'delivery',
      p_entity_id: delivery.id,
      p_description: `Driver assigned from ${driverSource} (${mode})`,
      p_new_values: {
        driver_id: assignedDriver.driver_id,
        source: driverSource,
        distance_km: assignedDriver.distance_km,
        assignment_type: mode
      }
    });

    console.log(`✅ Delivery ${delivery.id} assigned to driver ${assignedDriver.driver_id} from ${driverSource}`);

    return new Response(JSON.stringify({
      ok: true,
      delivery_id: delivery.id,
      driver_id: assignedDriver.driver_id,
      vehicle_id: assignedDriver.vehicle_id || null,
      driver_source: driverSource,
      distance_km: assignedDriver.distance_km,
      total_amount: totalAmount,
      assignment_type: mode,
      status: 'driver_offered'
    }), {
      headers: { ...corsHeaders, 'content-type': 'application/json' },
      status: 200
    });

  } catch (e) {
    console.error('Pair business driver error:', e);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: e.message
    }), { 
      headers: { ...corsHeaders, 'content-type': 'application/json' },
      status: 500 
    });
  }
});

// Haversine distance calculation
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
