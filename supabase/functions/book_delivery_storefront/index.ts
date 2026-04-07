// @ts-nocheck
// Book Delivery Storefront - Public (no auth required)
// Creates a delivery from a business storefront without requiring customer login
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

async function getMapboxDistance(pickup: any, dropoff: any) {
  const MAPBOX_TOKEN = Deno.env.get("MAPBOX_ACCESS_TOKEN");
  if (!MAPBOX_TOKEN) throw new Error("Mapbox token not configured");

  const coordinates = `${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}`;
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?access_token=${MAPBOX_TOKEN}&geometries=geojson`;
  const response = await fetch(url);
  const data = await response.json();

  if (data.routes && data.routes.length > 0) {
    return data.routes[0].distance / 1000;
  }
  throw new Error("No routes found");
}

async function getMapboxMultiStopDistance(pickup: any, stops: any[]) {
  const MAPBOX_TOKEN = Deno.env.get("MAPBOX_ACCESS_TOKEN");
  if (!MAPBOX_TOKEN) throw new Error("Mapbox token not configured");

  const coords = [
    `${pickup.lng},${pickup.lat}`,
    ...stops.map((s: any) => `${s.lng},${s.lat}`),
  ].join(';');
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?access_token=${MAPBOX_TOKEN}&geometries=geojson`;
  const response = await fetch(url);
  const data = await response.json();

  if (data.routes && data.routes.length > 0) {
    return data.routes[0].distance / 1000;
  }
  throw new Error("No routes found");
}

function generateTrackingNumber(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = 'SD';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response("Only POST allowed", { status: 405, headers: corsHeaders });
    }

    const body = await req.json();
    console.log("📦 Storefront booking request received");

    // Validate required fields
    if (!body?.businessId || !body?.vehicleTypeId || !body?.pickup || !body?.dropoff) {
      return new Response(JSON.stringify({ error: "Missing required fields: businessId, vehicleTypeId, pickup, dropoff" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    if (!body?.customer?.name || !body?.customer?.phone) {
      return new Response(JSON.stringify({ error: "Customer name and phone are required" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    // Use service role key to bypass RLS since this is a public endpoint
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return new Response(JSON.stringify({ error: "Missing Supabase config" }), {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Verify business exists and has storefront enabled
    const { data: business, error: bizErr } = await supabase
      .from("business_accounts")
      .select("id, business_name, storefront_enabled, settings, storefront_settings")
      .eq("id", body.businessId)
      .eq("storefront_enabled", true)
      .single();

    if (bizErr || !business) {
      return new Response(JSON.stringify({ error: "Business not found or storefront disabled" }), {
        status: 404,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    console.log("🏢 Business verified:", business.business_name);

    // Fetch vehicle type pricing
    const { data: vehicleType, error: vtErr } = await supabase
      .from("vehicle_types")
      .select("id, name, base_price, price_per_km, additional_stop_charge, is_active")
      .eq("id", body.vehicleTypeId)
      .eq("is_active", true)
      .single();

    if (vtErr || !vehicleType) {
      return new Response(JSON.stringify({ error: "Invalid or inactive vehicle type" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    console.log(`🚗 Vehicle: ${vehicleType.name}`);

    // Determine if multi-stop
    const isMultiStop = body.additionalStops && body.additionalStops.length > 0;
    const allStops = isMultiStop
      ? [body.dropoff, ...body.additionalStops]
      : [body.dropoff];

    // Calculate distance via Mapbox
    let distanceKm: number;
    if (isMultiStop) {
      const stopLocations = allStops.map((s: any) => s.location);
      distanceKm = await getMapboxMultiStopDistance(body.pickup.location, stopLocations);
    } else {
      distanceKm = await getMapboxDistance(body.pickup.location, body.dropoff.location);
    }

    // Calculate pricing with 12% VAT
    const basePrice = Number(vehicleType.base_price) || 0;
    const distanceCost = distanceKm * (Number(vehicleType.price_per_km) || 0);
    const extraStopCharge = isMultiStop
      ? (Number(vehicleType.additional_stop_charge) || 0) * (allStops.length - 1)
      : 0;
    const subtotal = basePrice + distanceCost + extraStopCharge;
    const vat = subtotal * 0.12;
    const totalPrice = Math.round((subtotal + vat) * 100) / 100;

    console.log(`💰 Price: Base ₱${basePrice} + Distance ₱${distanceCost.toFixed(2)} + Stops ₱${extraStopCharge} + VAT ₱${vat.toFixed(2)} = ₱${totalPrice}`);

    const trackingNumber = generateTrackingNumber();

    // Insert delivery record (no customer_id — guest booking)
    const insertPayload: Record<string, any> = {
      business_id: body.businessId,
      customer_id: null,
      vehicle_type_id: body.vehicleTypeId,
      assignment_type: business.settings?.auto_dispatch ? 'auto' : 'manual',
      tracking_number: trackingNumber,
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
      package_description: body.package?.description || 'Package',
      package_weight: body.package?.weightKg || null,
      package_value: body.package?.value || null,
      distance_km: distanceKm,
      total_price: totalPrice,
      status: 'pending',
      payment_method: body.payment?.paymentMethod || 'cash',
      payment_status: 'pending',
      payment_by: body.payment?.paymentBy || 'sender',
      delivery_notes: `Guest booking via storefront by ${body.customer.name} (${body.customer.phone}${body.customer.email ? ', ' + body.customer.email : ''})`,
      is_scheduled: body.isScheduled || false,
      scheduled_pickup_time: body.scheduledPickupTime || null,
      is_multi_stop: isMultiStop,
      total_stops: allStops.length,
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

    console.log("✅ Storefront delivery created:", delivery.id, "Tracking:", trackingNumber);

    // If multi-stop, insert delivery_stops
    if (isMultiStop && allStops.length > 1) {
      const stopsToInsert = allStops.map((stop: any, idx: number) => ({
        delivery_id: delivery.id,
        stop_number: idx + 1,
        address: stop.address,
        latitude: stop.location.lat,
        longitude: stop.location.lng,
        contact_name: stop.contactName,
        contact_phone: stop.contactPhone,
        instructions: stop.instructions || null,
        status: 'pending',
      }));

      const { error: stopsErr } = await supabase
        .from("delivery_stops")
        .insert(stopsToInsert);

      if (stopsErr) {
        console.warn("⚠️ Failed to insert delivery stops:", stopsErr.message);
      } else {
        console.log(`✅ ${stopsToInsert.length} delivery stops created`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      delivery: {
        id: delivery.id,
        tracking_number: trackingNumber,
        status: delivery.status,
        total_price: totalPrice,
      },
      pricing: {
        base: basePrice,
        distance: distanceCost,
        extraStops: extraStopCharge,
        subtotal,
        vat,
        total: totalPrice,
      }
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("❌ Server error:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      message: error.message,
    }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
