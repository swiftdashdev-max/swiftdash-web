// @ts-nocheck
// Book Delivery Web - Single Stop
// Web-specific function with Mapbox API and 12% VAT
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

async function getMapboxDistance(pickup: any, dropoff: any) {
  const MAPBOX_TOKEN = Deno.env.get("MAPBOX_ACCESS_TOKEN");
  if (!MAPBOX_TOKEN) {
    console.error("❌ No Mapbox access token found");
    throw new Error("Mapbox token not configured");
  }

  try {
    const coordinates = `${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}`;
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?access_token=${MAPBOX_TOKEN}&geometries=geojson`;
    
    console.log("📍 Fetching Mapbox route...");
    const response = await fetch(url);
    const data = await response.json();

    if (data.routes && data.routes.length > 0) {
      const distanceMeters = data.routes[0].distance;
      const distanceKm = distanceMeters / 1000;
      console.log(`✅ Mapbox distance: ${distanceKm.toFixed(2)} km`);
      return distanceKm;
    } else {
      throw new Error("No routes found");
    }
  } catch (error) {
    console.error("❌ Mapbox API error:", error);
    throw error;
  }
}

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
      return new Response("Only POST allowed", {
        status: 405,
        headers: corsHeaders,
      });
    }

    const body = await req.json();
    console.log("📦 Web booking request received");

    // Validate required fields - either vehicleTypeId OR fleetVehicleId required
    if ((!body?.vehicleTypeId && !body?.fleetVehicleId) || !body?.pickup || !body?.dropoff) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    // Initialize Supabase client
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return new Response(JSON.stringify({ error: "Missing Supabase config" }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: req.headers.get("Authorization") ?? "",
        },
      },
    });

    // Authenticate user
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    const userId = authData.user.id;
    console.log("✅ User authenticated:", userId);

    // Get user's business_id
    const { data: userProfile } = await supabase
      .from("user_profiles")
      .select("business_id")
      .eq("id", userId)
      .single();

    const businessId = userProfile?.business_id || null;
    console.log("🏢 Business ID:", businessId);

    let vehicleType;
    let assignedDriverId = null;
    let fleetVehicleId = null;

    if (body.fleetVehicleId) {
      // Fleet vehicle assignment - get vehicle and driver info
      const { data: fleetVehicle, error: fvErr } = await supabase
        .from("business_fleet")
        .select(`
          id,
          assigned_driver_id,
          vehicle_type_id,
          vehicle_types (
            id, name, base_price, price_per_km, is_active
          )
        `)
        .eq("id", body.fleetVehicleId)
        .eq("status", "active")
        .single();

      if (fvErr || !fleetVehicle) {
        console.error("❌ Fleet vehicle error:", fvErr);
        return new Response(JSON.stringify({ error: "Invalid or inactive fleet vehicle" }), {
          status: 400,
          headers: { ...corsHeaders, "content-type": "application/json" },
        });
      }

      vehicleType = fleetVehicle.vehicle_types;
      assignedDriverId = fleetVehicle.assigned_driver_id;
      fleetVehicleId = fleetVehicle.id;
      console.log(`🚗 Fleet Vehicle: ${vehicleType.name} (Driver: ${assignedDriverId || 'Unassigned'})`);

    } else {
      // Public vehicle type - fetch pricing
      const { data: vt, error: vtErr } = await supabase
        .from("vehicle_types")
        .select("id, name, base_price, price_per_km, is_active")
        .eq("id", body.vehicleTypeId)
        .single();

      if (vtErr || !vt) {
        console.error("❌ Vehicle type error:", vtErr);
        return new Response(JSON.stringify({ error: "Invalid vehicle type" }), {
          status: 400,
          headers: { ...corsHeaders, "content-type": "application/json" },
        });
      }

      if (!vt.is_active) {
        return new Response(JSON.stringify({ error: "Vehicle type unavailable" }), {
          status: 400,
          headers: { ...corsHeaders, "content-type": "application/json" },
        });
      }

      vehicleType = vt;
      console.log(`🚗 Public Vehicle: ${vehicleType.name}`);
    }

    // Get distance from Mapbox
    const distanceKm = await getMapboxDistance(body.pickup.location, body.dropoff.location);

    // Calculate pricing with 12% VAT (web requirement)
    const basePrice = Number(vehicleType.base_price) || 0;
    const distanceCost = distanceKm * (Number(vehicleType.price_per_km) || 0);
    const subtotal = basePrice + distanceCost;
    const vat = subtotal * 0.12; // 12% VAT for web
    const totalPrice = Math.round((subtotal + vat) * 100) / 100;

    console.log(`💰 Pricing: Base ₱${basePrice} + Distance ₱${distanceCost.toFixed(2)} + VAT ₱${vat.toFixed(2)} = Total ₱${totalPrice}`);

    // Insert delivery record
    const insertPayload = {
      customer_id: userId,
      business_id: businessId,
      vehicle_type_id: body.vehicleTypeId || vehicleType.id,
      fleet_vehicle_id: fleetVehicleId,
      driver_id: assignedDriverId,
      assignment_type: body.assignmentType || (fleetVehicleId ? 'manual' : 'auto'),
      pickup_address: body.pickup.address,
      pickup_latitude: body.pickup.location.lat,
      pickup_longitude: body.pickup.location.lng,
      pickup_contact_name: body.pickup.contactName,
      pickup_contact_phone: body.pickup.contactPhone,
      pickup_instructions: body.pickup.instructions || null,
      delivery_address: body.dropoff.address,
      delivery_latitude: body.dropoff.location.lat,
      delivery_longitude: body.dropoff.location.lng,
      delivery_contact_name: body.dropoff.contactName,
      delivery_contact_phone: body.dropoff.contactPhone,
      delivery_instructions: body.dropoff.instructions || null,
      package_description: body.package?.description || null,
      package_weight: body.package?.weightKg || null,
      package_value: body.package?.value || null,
      distance_km: distanceKm,
      total_price: totalPrice,
      status: 'pending',
      payment_method: body.payment?.paymentMethod || null,
      payment_status: body.payment?.paymentStatus || 'pending',
      payment_by: body.payment?.paymentBy || null,
      is_scheduled: body.isScheduled || false,
      scheduled_pickup_time: body.scheduledPickupTime || null,
      is_multi_stop: false,
      total_stops: 1,
      current_stop_index: 0,
    };

    const { data: delivery, error: insertErr } = await supabase
      .from("deliveries")
      .insert(insertPayload)
      .select()
      .single();

    if (insertErr) {
      console.error("❌ Insert error:", insertErr);
      return new Response(JSON.stringify({ error: "Failed to create delivery", details: insertErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    console.log("✅ Delivery created:", delivery.id);

    return new Response(JSON.stringify({ 
      success: true, 
      delivery,
      pricing: {
        base: basePrice,
        distance: distanceCost,
        subtotal,
        vat,
        total: totalPrice
      }
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("❌ Server error:", error);
    return new Response(JSON.stringify({ 
      error: "Internal server error", 
      message: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
