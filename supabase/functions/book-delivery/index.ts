// @ts-nocheck
// Book Delivery Edge Function
// Validates the request with user JWT, recomputes price with VAT, and inserts a delivery row.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function haversineKm(a, b) {
  const toRad = (d) => d * Math.PI / 180;
  const R = 6371; // km
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function getGoogleDirectionsDistance(pickup, dropoff) {
  const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!apiKey) {
    console.log("No Google Maps API key, falling back to Haversine distance");
    return haversineKm(pickup, dropoff);
  }
  try {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${pickup.lat},${pickup.lng}&destination=${dropoff.lat},${dropoff.lng}&mode=driving&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.status === 'OK' && data.routes.length > 0) {
      const distanceMeters = data.routes[0].legs[0].distance.value;
      const distanceKm = distanceMeters / 1000;
      console.log(`Google Directions distance: ${distanceKm} km`);
      return distanceKm;
    } else {
      console.log(`Google Directions API error: ${data.status}, falling back to Haversine`);
      return haversineKm(pickup, dropoff);
    }
  } catch (error) {
    console.error("Error calling Google Directions API:", error);
    return haversineKm(pickup, dropoff);
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
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
        headers: corsHeaders,
      });
    }

    const body = await req.json();
    if (!body?.vehicleTypeId || !body?.pickup || !body?.dropoff) {
      return new Response("Missing required fields", {
        status: 400,
        headers: corsHeaders,
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return new Response("Missing Supabase env", {
        status: 500,
        headers: corsHeaders,
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: req.headers.get("Authorization") ?? "",
        },
      },
    });

    // Identify user
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData?.user) {
      return new Response("Unauthorized", {
        status: 401,
        headers: corsHeaders,
      });
    }
    const userId = authData.user.id;

    // Get user's business_id from user_profiles
    const { data: userProfile } = await supabase
      .from("user_profiles")
      .select("business_id")
      .eq("id", userId)
      .single();

    const businessId = userProfile?.business_id || null;

    // Fetch pricing
    const { data: vt, error: vtErr } = await supabase
      .from("vehicle_types")
      .select("id, base_price, price_per_km, is_active")
      .eq("id", body.vehicleTypeId)
      .maybeSingle();

    if (vtErr) {
      console.error(vtErr);
      return new Response("Failed to load vehicle pricing", {
        status: 500,
        headers: corsHeaders,
      });
    }

    if (!vt || vt.is_active === false) {
      return new Response("Vehicle type unavailable", {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Get accurate distance using Google Directions API
    const distanceKm = Math.max(
      0,
      Math.round(await getGoogleDirectionsDistance(body.pickup.location, body.dropoff.location) * 10) / 10
    );

    const base = Number(vt.base_price) || 0;
    const perKm = Number(vt.price_per_km) || 0;
    const subtotal = base + perKm * distanceKm;

    // Add 12% VAT (Philippine requirement)
    const vatRate = 0.12;
    const vat = subtotal * vatRate;
    const total = Math.max(1, Math.round((subtotal + vat) * 100) / 100);

    // Insert delivery (RLS should allow if policies are set for authenticated users)
    const insertPayload = {
      customer_id: userId,
      business_id: businessId,
      vehicle_type_id: body.vehicleTypeId,
      pickup_address: body.pickup.address,
      pickup_latitude: body.pickup.location.lat,
      pickup_longitude: body.pickup.location.lng,
      pickup_contact_name: body.pickup.contactName,
      pickup_contact_phone: body.pickup.contactPhone,
      pickup_instructions: body.pickup.instructions ?? null,
      delivery_address: body.dropoff.address,
      delivery_latitude: body.dropoff.location.lat,
      delivery_longitude: body.dropoff.location.lng,
      delivery_contact_name: body.dropoff.contactName,
      delivery_contact_phone: body.dropoff.contactPhone,
      delivery_instructions: body.dropoff.instructions ?? null,
      package_description: body.package?.description ?? null,
      package_weight: body.package?.weightKg ?? null,
      package_value: body.package?.value ?? null,
      distance_km: distanceKm,
      total_price: total,
      status: 'pending',
    };

    const { data: created, error: insErr } = await supabase
      .from("deliveries")
      .insert(insertPayload)
      .select()
      .single();

    if (insErr) {
      console.error(insErr);
      return new Response("Failed to create delivery", {
        status: 400,
        headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify(created), {
      headers: {
        ...corsHeaders,
        "content-type": "application/json",
      },
      status: 200,
    });
  } catch (e) {
    console.error(e);
    return new Response("Internal error", {
      status: 500,
      headers: corsHeaders,
    });
  }
});
