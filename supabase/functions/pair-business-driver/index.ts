// Business Driver Pairing Edge Function
// B2B Fleet-Only: Private Fleet → Public Fleet (no global pool)
// Fleet drivers go straight to driver_assigned (no offer/accept cycle)
// Supports: Auto dispatch & Manual assignment
// Updated: April 2, 2026

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
        id, business_id, customer_id, status, driver_id,
        pickup_latitude, pickup_longitude,
        delivery_latitude, delivery_longitude,
        vehicle_type_id, distance_km,
        is_multi_stop, total_stops,
        is_scheduled, scheduled_pickup_time,
        pickup_address, delivery_address
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
        message: "Not a business delivery - missing business_id"
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

    // Scheduled deliveries: operator dispatches manually from dispatch page
    // No time-gate — the operator decides when to assign a driver
    if (delivery.is_scheduled && delivery.scheduled_pickup_time) {
      console.log(`📅 Scheduled delivery for ${delivery.scheduled_pickup_time} — operator is dispatching now`);
    }

    let assignedDriver: { driver_id: string; vehicle_id?: string; distance_km: number; driver_name?: string } | null = null;
    let driverSource: string | null = null;

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

      // B2B: Only allow own fleet drivers for manual assignment
      if (driver.employment_type === 'fleet_driver' && driver.managed_by_business_id === delivery.business_id) {
        driverSource = 'private_fleet';
      } else if (driver.employment_type === 'fleet_driver') {
        // Driver belongs to another business — reject
        return new Response(JSON.stringify({
          ok: false,
          message: "Driver belongs to another business fleet"
        }), { 
          headers: { ...corsHeaders, 'content-type': 'application/json' },
          status: 400 
        });
      } else {
        // Independent driver — reject in B2B mode
        return new Response(JSON.stringify({
          ok: false,
          message: "Independent drivers are not available in B2B mode. Only fleet drivers can be assigned."
        }), { 
          headers: { ...corsHeaders, 'content-type': 'application/json' },
          status: 400 
        });
      }

      assignedDriver = {
        driver_id: manualDriverId,
        distance_km: calculateDistance(
          delivery.pickup_latitude,
          delivery.pickup_longitude,
          driver.current_latitude,
          driver.current_longitude
        ),
      };

      console.log(`✅ Manual assignment: ${driverSource}`);
    } 
    // ==================================================
    // AUTO DISPATCH MODE - FLEET ONLY (2-TIER)
    // ==================================================
    else {
      console.log(`🤖 Auto dispatch (fleet-only) for business: ${delivery.business_id}`);

      // PRIORITY 1: Business Private Fleet
      // B2B: Match ANY available fleet driver (vehicle_type_id = null)
      // The business decides which driver to send, not the vehicle type filter
      console.log('🔍 Priority 1: Searching private fleet...');
      const { data: privateFleet, error: privateErr } = await supabase.rpc(
        'find_business_fleet_driver',
        {
          p_business_id: delivery.business_id,
          p_pickup_lat: delivery.pickup_latitude,
          p_pickup_lng: delivery.pickup_longitude,
          p_vehicle_type_id: null,
          p_access_mode: 'private',
          p_max_distance_km: 10
        }
      );

      if (!privateErr && privateFleet?.[0]) {
        assignedDriver = privateFleet[0];
        driverSource = 'private_fleet';
        console.log(`✅ Found private fleet driver: ${assignedDriver.driver_id} at ${assignedDriver.distance_km}km`);
      }

      // PRIORITY 2: Business Public Fleet (own vehicles marked public)
      if (!assignedDriver) {
        console.log('🔍 Priority 2: Searching public fleet...');
        const { data: publicFleet, error: publicErr } = await supabase.rpc(
          'find_business_fleet_driver',
          {
            p_business_id: delivery.business_id,
            p_pickup_lat: delivery.pickup_latitude,
            p_pickup_lng: delivery.pickup_longitude,
            p_vehicle_type_id: null,
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

      // NO PRIORITY 3 — Global pool disabled for B2B mode
    }

    // ==================================================
    // NO DRIVER FOUND — Notify dispatcher via realtime
    // ==================================================
    if (!assignedDriver) {
      console.warn(`⚠️ No fleet drivers available for delivery ${delivery.id}`);

      // Insert a notification into a channel the dispatch page can subscribe to
      // We use a Postgres insert into a lightweight notifications approach
      // The dispatch page's realtime subscription on deliveries will pick up the status staying 'pending'
      // But we also send a structured response so the UI can show a meaningful toast
      return new Response(JSON.stringify({
        ok: false,
        no_driver: true,
        message: 'No fleet drivers available. All drivers are offline, busy, or out of range.',
        suggestion: 'Check that fleet drivers are online and within 10km of the pickup location.',
        business_id: delivery.business_id,
        delivery_id: delivery.id,
        pickup_address: delivery.pickup_address
      }), {
        headers: { ...corsHeaders, 'content-type': 'application/json' },
        status: 200 // 200 so the client can parse the response (not a server error)
      });
    }

    // ==================================================
    // CALCULATE PRICING
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
    // ASSIGN DRIVER — Fleet goes straight to driver_assigned
    // ==================================================
    const assignedAt = new Date().toISOString();
    const { error: updateErr } = await supabase
      .from('deliveries')
      .update({
        driver_id: assignedDriver.driver_id,
        fleet_vehicle_id: assignedDriver.vehicle_id || null,
        assignment_type: mode,
        status: 'driver_assigned', // B2B: skip driver_offered, go straight to assigned
        distance_km: Math.round(distanceKm * 10) / 10,
        total_amount: totalAmount,
        driver_source: driverSource,
        assigned_at: assignedAt,
        updated_at: assignedAt
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
      p_user_id: null,
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

    // ==================================================
    // FIRE WEBHOOKS (non-blocking)
    // ==================================================
    fireWebhooks(supabase, delivery.customer_id, 'delivery.driver_assigned', delivery.id, {
      delivery_id: delivery.id,
      driver_id: assignedDriver.driver_id,
      driver_source: driverSource,
      assignment_type: mode,
      status: 'driver_assigned',
      total_amount: totalAmount,
      distance_km: distanceKm
    }).catch((err: Error) => console.error('Webhook dispatch error:', err));

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
      status: 'driver_assigned'
    }), {
      headers: { ...corsHeaders, 'content-type': 'application/json' },
      status: 200
    });

  } catch (e) {
    console.error('Pair business driver error:', e);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: (e as Error).message
    }), { 
      headers: { ...corsHeaders, 'content-type': 'application/json' },
      status: 500 
    });
  }
});

// ==================================================
// WEBHOOK DISPATCHER (inline — mirrors Next.js webhook-dispatcher.ts)
// ==================================================
async function fireWebhooks(
  supabase: ReturnType<typeof createClient>,
  businessOwnerId: string,
  event: string,
  deliveryId: string,
  data: Record<string, unknown>
) {
  // Resolve the business_accounts ID from user_profiles (API keys are tied to auth user)
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('business_id')
    .eq('id', businessOwnerId)
    .single();

  const lookupId = profile?.business_id ?? businessOwnerId;

  // Fetch active webhooks subscribed to this event
  const { data: webhooks, error } = await supabase
    .from('business_webhooks')
    .select('id, url, secret, events')
    .eq('business_id', lookupId)
    .eq('is_active', true);

  if (error || !webhooks?.length) return;

  const payload = {
    event,
    timestamp: new Date().toISOString(),
    delivery_id: deliveryId,
    data
  };
  const body = JSON.stringify(payload);

  for (const wh of webhooks) {
    if (!(wh.events as string[]).includes(event)) continue;

    // HMAC-SHA256 signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(wh.secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const signature = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');

    let responseStatus: number | null = null;
    let responseBody: string | null = null;
    let success = false;

    try {
      const res = await fetch(wh.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-swiftdash-signature': `sha256=${signature}`,
          'x-swiftdash-event': event,
          'user-agent': 'SwiftDash-Webhooks/1.0',
        },
        body,
      });
      responseStatus = res.status;
      responseBody = await res.text().catch(() => null);
      success = res.ok;
    } catch (err) {
      responseBody = err instanceof Error ? err.message : 'Unknown error';
    }

    // Log the attempt
    await supabase.from('webhook_delivery_logs').insert({
      webhook_id: wh.id,
      event,
      delivery_id: deliveryId,
      payload,
      response_status: responseStatus,
      response_body: responseBody,
      success,
    });
  }
}

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
