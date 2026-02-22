// @ts-nocheck
// Send Tracking SMS Edge Function
// Called after delivery creation to send a booking confirmation SMS with tracking link
// Uses Semaphore (https://semaphore.co) for Philippine SMS delivery
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SEMAPHORE_API_URL = 'https://api.semaphore.co/api/v4/messages';

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
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const smsApiKey = Deno.env.get('SMS_API_KEY');
    const appUrl = Deno.env.get('APP_URL') || 'https://swiftdashdms.com';

    // Validate Semaphore API key
    if (!smsApiKey) {
      console.warn('⚠️ SMS_API_KEY not configured — skipping SMS');
      return new Response(
        JSON.stringify({ success: false, message: 'SMS not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await req.json();
    const {
      deliveryId,
      isMultiStop = false,
      stopTrackingCodes = [], // [{ trackingCode, recipientPhone, recipientName, stopNumber }]
      test = false,
      phone: testPhoneRaw,
      businessId: testBusinessId,
    } = body;

    // ── TEST MODE ────────────────────────────────────────────────────────────
    if (test) {
      if (!testPhoneRaw) {
        return new Response(
          JSON.stringify({ success: false, message: 'phone is required for test mode' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      // Fetch business name if businessId provided
      let testBusinessName = 'SwiftDash';
      if (testBusinessId) {
        const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        const { data: biz } = await supabase.from('business_accounts').select('business_name').eq('id', testBusinessId).single();
        if (biz?.business_name) testBusinessName = biz.business_name;
      }
      const senderName = 'DELIVERY';
      const testMessage = `${testBusinessName}: This is a test SMS from SwiftDash 📦. Your SMS notifications are working correctly!`;
      const normalized = testPhoneRaw.replace(/[\s\-\(\)]/g, '').trim()
        .replace(/^\+63/, '0').replace(/^63(\d{10})$/, '0$1');
      if (!/^09\d{9}$/.test(normalized)) {
        return new Response(
          JSON.stringify({ success: false, message: 'Invalid Philippine phone number format. Use 09XXXXXXXXX' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const response = await fetch(SEMAPHORE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ apikey: smsApiKey!, number: normalized, message: testMessage, sendername: senderName }),
      });
      const result = await response.json();
      if (!response.ok || (Array.isArray(result) && result[0]?.status === 'Failed')) {
        const errMsg = Array.isArray(result) ? result[0]?.message || 'Send failed' : JSON.stringify(result);
        return new Response(
          JSON.stringify({ success: false, message: errMsg }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log(`✅ Test SMS sent to ${normalized}`);
      return new Response(
        JSON.stringify({ success: true, message: `Test SMS sent to ${normalized}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!deliveryId) {
      return new Response(
        JSON.stringify({ success: false, message: 'deliveryId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch delivery with business settings
    const { data: delivery, error: deliveryError } = await supabase
      .from('deliveries')
      .select(`
        id,
        tracking_number,
        pickup_contact_name,
        pickup_contact_phone,
        delivery_contact_name,
        delivery_contact_phone,
        business_accounts!inner(
          business_name,
          settings
        )
      `)
      .eq('id', deliveryId)
      .single();

    if (deliveryError || !delivery) {
      console.error('❌ Failed to fetch delivery:', deliveryError);
      return new Response(
        JSON.stringify({ success: false, message: 'Delivery not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const business = delivery.business_accounts;
    const businessName = business?.business_name || 'SwiftDash';
    const settings = business?.settings || {};

    // Check if SMS on booking is enabled (default: true)
    const smsEnabled = settings.sms_on_booking !== false;
    if (!smsEnabled) {
      console.log('ℹ️ SMS on booking is disabled for this business');
      return new Response(
        JSON.stringify({ success: false, message: 'SMS on booking is disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const notifyPickup = settings.sms_notify_pickup === true;
    const customTemplate = settings.sms_template || '';
    // Fixed registered Semaphore sender name
    const senderName = 'DELIVERY';

    // Helper: build SMS body from template or default
    const buildSmsBody = (name: string, trackingUrl: string): string => {
      if (customTemplate) {
        return customTemplate
          .replace(/\{name\}/gi, name || 'Customer')
          .replace(/\{tracking_url\}/gi, trackingUrl)
          .replace(/\{business_name\}/gi, businessName);
      }
      return `${businessName}: Hi ${name || 'there'}! Your delivery has been booked. Track it here: ${trackingUrl}`;
    };

    // Helper: normalize Philippine phone number for Semaphore
    // Semaphore accepts: 09XXXXXXXXX or 639XXXXXXXXX
    const normalizePhone = (phone: string): string | null => {
      if (!phone) return null;
      let cleaned = phone.replace(/[\s\-\(\)]/g, '').trim();
      // +639XXXXXXXXX → 09XXXXXXXXX
      if (cleaned.startsWith('+63')) cleaned = '0' + cleaned.slice(3);
      // 639XXXXXXXXX → 09XXXXXXXXX
      else if (cleaned.startsWith('63') && cleaned.length === 12) cleaned = '0' + cleaned.slice(2);
      // Validate: must be 09XXXXXXXXX (11 digits)
      if (/^09\d{9}$/.test(cleaned)) return cleaned;
      return null;
    };

    // Helper: send SMS via Semaphore API
    const sendSms = async (phone: string, message: string): Promise<{ phone: string; success: boolean; messageId?: number; error?: string }> => {
      const normalized = normalizePhone(phone);
      if (!normalized) {
        return { phone, success: false, error: 'Invalid Philippine phone number' };
      }
      try {
        const response = await fetch(SEMAPHORE_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            apikey: smsApiKey!,
            number: normalized,
            message: message,
            sendername: senderName,
          }),
        });

        const result = await response.json();

        if (!response.ok || (Array.isArray(result) && result[0]?.status === 'Failed')) {
          const errMsg = Array.isArray(result) ? result[0]?.message || 'Send failed' : JSON.stringify(result);
          console.error(`❌ SMS failed to ${normalized}:`, errMsg);
          return { phone: normalized, success: false, error: errMsg };
        }

        const messageId = Array.isArray(result) ? result[0]?.message_id : result?.message_id;
        console.log(`✅ SMS sent to ${normalized} (id: ${messageId})`);
        return { phone: normalized, success: true, messageId };
      } catch (err: any) {
        console.error(`❌ SMS failed to ${normalized}:`, err.message);
        return { phone: normalized, success: false, error: err.message };
      }
    };

    const results: Array<{ phone: string; success: boolean; messageId?: number; error?: string }> = [];

    if (isMultiStop && stopTrackingCodes.length > 0) {
      // ── Multi-stop: one SMS per stop recipient ──────────────────────────────
      for (const stop of stopTrackingCodes) {
        const { trackingCode, recipientPhone, recipientName, stopNumber } = stop;

        if (!recipientPhone) {
          console.warn(`⚠️ Stop ${stopNumber} has no recipient phone — skipping`);
          continue;
        }

        const trackingUrl = `${appUrl}/track/${trackingCode}`;
        const smsBody = buildSmsBody(recipientName || 'Customer', trackingUrl);
        const result = await sendSms(recipientPhone, smsBody);
        results.push(result);
      }

      // Optionally notify pickup contact with the main tracking number
      if (notifyPickup && delivery.pickup_contact_phone) {
        const trackingUrl = `${appUrl}/track/${delivery.tracking_number}`;
        const smsBody = buildSmsBody(delivery.pickup_contact_name || 'Sender', trackingUrl);
        const result = await sendSms(delivery.pickup_contact_phone, smsBody);
        results.push(result);
      }
    } else {
      // ── Single delivery: SMS to delivery contact ────────────────────────────
      const trackingUrl = `${appUrl}/track/${delivery.tracking_number}`;

      if (delivery.delivery_contact_phone) {
        const smsBody = buildSmsBody(delivery.delivery_contact_name || 'Customer', trackingUrl);
        const result = await sendSms(delivery.delivery_contact_phone, smsBody);
        results.push(result);
      }

      // Optionally notify pickup/sender contact
      if (notifyPickup && delivery.pickup_contact_phone) {
        const smsBody = buildSmsBody(delivery.pickup_contact_name || 'Sender', trackingUrl);
        const result = await sendSms(delivery.pickup_contact_phone, smsBody);
        results.push(result);
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`📱 SMS summary: ${successCount}/${results.length} sent successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        total: results.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ send-tracking-sms error:', error);
    return new Response(
      JSON.stringify({ success: false, message: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
