// @ts-nocheck
// Send Tracking Email Edge Function
// Called after delivery creation to send a branded booking confirmation email with tracking link
// Uses Resend (https://resend.com)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// Build branded HTML email
const buildEmailHtml = ({
  recipientName,
  businessName,
  trackingNumber,
  trackingUrl,
  pickupAddress,
  deliveryAddress,
  packageDescription,
  primaryColor,
  logoUrl,
  supportPhone,
  supportEmail,
}: {
  recipientName: string;
  businessName: string;
  trackingNumber: string;
  trackingUrl: string;
  pickupAddress?: string;
  deliveryAddress?: string;
  packageDescription?: string;
  primaryColor: string;
  logoUrl?: string;
  supportPhone?: string;
  supportEmail?: string;
}) => `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f4f5; }
      .wrapper { max-width: 600px; margin: 0 auto; padding: 20px; }
      .card { background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
      .header { background: ${primaryColor}; color: white; padding: 32px 24px; text-align: center; }
      .header img { max-height: 48px; margin-bottom: 12px; }
      .header h1 { margin: 0; font-size: 22px; font-weight: 600; }
      .header p { margin: 8px 0 0; opacity: 0.9; font-size: 14px; }
      .body { padding: 32px 24px; }
      .greeting { font-size: 16px; margin-bottom: 16px; }
      .details { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 24px 0; }
      .details-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
      .details-row:last-child { border-bottom: none; }
      .details-label { color: #6b7280; }
      .details-value { font-weight: 500; text-align: right; max-width: 60%; }
      .cta { text-align: center; margin: 28px 0; }
      .cta a { display: inline-block; background: ${primaryColor}; color: #ffffff !important; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; }
      .tracking-code { text-align: center; background: #f0fdf4; border: 1px dashed #86efac; border-radius: 8px; padding: 16px; margin: 20px 0; }
      .tracking-code span { font-size: 12px; color: #6b7280; display: block; margin-bottom: 4px; }
      .tracking-code strong { font-size: 20px; letter-spacing: 2px; color: #166534; }
      .footer { text-align: center; padding: 20px 24px; color: #9ca3af; font-size: 12px; border-top: 1px solid #f3f4f6; }
      .footer a { color: ${primaryColor}; text-decoration: none; }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <div class="card">
        <div class="header">
          ${logoUrl ? `<img src="${logoUrl}" alt="${businessName}" />` : ''}
          <h1>📦 Delivery Booked!</h1>
          <p>Your package is on its way</p>
        </div>
        <div class="body">
          <p class="greeting">Hi ${recipientName},</p>
          <p>Great news! A delivery has been booked for you by <strong>${businessName}</strong>. You can track it in real-time using the link below.</p>

          <div class="tracking-code">
            <span>TRACKING NUMBER</span>
            <strong>${trackingNumber}</strong>
          </div>

          ${pickupAddress || deliveryAddress || packageDescription ? `
          <div class="details">
            ${pickupAddress ? `<div class="details-row"><span class="details-label">From</span><span class="details-value">${pickupAddress}</span></div>` : ''}
            ${deliveryAddress ? `<div class="details-row"><span class="details-label">To</span><span class="details-value">${deliveryAddress}</span></div>` : ''}
            ${packageDescription ? `<div class="details-row"><span class="details-label">Package</span><span class="details-value">${packageDescription}</span></div>` : ''}
          </div>
          ` : ''}

          <div class="cta">
            <a href="${trackingUrl}">Track Your Delivery</a>
          </div>

          <p style="font-size: 14px; color: #6b7280; text-align: center;">
            Or copy this link into your browser:<br/>
            <a href="${trackingUrl}" style="color: ${primaryColor}; word-break: break-all;">${trackingUrl}</a>
          </p>
        </div>
        <div class="footer">
          <p>Powered by <strong>${businessName}</strong></p>
          ${supportPhone ? `<p>📞 <a href="tel:${supportPhone}">${supportPhone}</a></p>` : ''}
          ${supportEmail ? `<p>✉️ <a href="mailto:${supportEmail}">${supportEmail}</a></p>` : ''}
        </div>
      </div>
    </div>
  </body>
</html>
`;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const resendDomain = Deno.env.get('RESEND_DOMAIN') || 'swiftdashdms.com';
    const appUrl = Deno.env.get('APP_URL') || 'https://swiftdashdms.com';

    if (!resendApiKey) {
      console.warn('⚠️ RESEND_API_KEY not configured — skipping email');
      return new Response(
        JSON.stringify({ success: false, message: 'Email not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await req.json();
    const {
      deliveryId,
      isMultiStop = false,
      stopTrackingCodes = [], // [{ trackingCode, recipientEmail, recipientName, stopNumber, address }]
      test = false,
      email: testEmailRaw,
      businessId: testBusinessId,
    } = body;

    // ── TEST MODE ────────────────────────────────────────────────────────────
    if (test) {
      if (!testEmailRaw) {
        return new Response(
          JSON.stringify({ success: false, message: 'email is required for test mode' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      let testBusinessName = 'SwiftDash';
      let testPrimaryColor = '#3b82f6';
      let testLogoUrl = '';
      if (testBusinessId) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { data: biz } = await supabase.from('business_accounts').select('business_name, settings').eq('id', testBusinessId).single();
        if (biz?.business_name) testBusinessName = biz.business_name;
        if (biz?.settings?.primary_color) testPrimaryColor = biz.settings.primary_color;
        if (biz?.settings?.logo_url) testLogoUrl = biz.settings.logo_url;
      }
      const resend = new Resend(resendApiKey);
      const resendDomain = Deno.env.get('RESEND_DOMAIN') || 'swiftdashdms.com';
      const fromAddress = `${testBusinessName} <notifications@${resendDomain}>`;
      const testHtml = buildEmailHtml({
        recipientName: 'Test User',
        businessName: testBusinessName,
        trackingNumber: 'SD-TEST-001',
        trackingUrl: `${Deno.env.get('APP_URL') || 'https://swiftdashdms.com'}/track/SD-TEST-001`,
        pickupAddress: '123 Test Pickup St, Manila',
        deliveryAddress: '456 Test Delivery Ave, BGC',
        packageDescription: 'Test Package',
        primaryColor: testPrimaryColor,
        logoUrl: testLogoUrl,
      });
      const emailResult = await resend.emails.send({
        from: fromAddress,
        to: testEmailRaw,
        subject: `${testBusinessName} — Test Email Notification 🧪`,
        html: testHtml,
      });
      if (emailResult.error) {
        return new Response(
          JSON.stringify({ success: false, message: emailResult.error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log(`✅ Test email sent to ${testEmailRaw}`);
      return new Response(
        JSON.stringify({ success: true, message: `Test email sent to ${testEmailRaw}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!deliveryId) {
      return new Response(
        JSON.stringify({ success: false, message: 'deliveryId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch delivery with business settings
    const { data: delivery, error: deliveryError } = await supabase
      .from('deliveries')
      .select(`
        id,
        tracking_number,
        pickup_address,
        delivery_address,
        package_description,
        pickup_contact_name,
        pickup_contact_phone,
        pickup_contact_email,
        delivery_contact_name,
        delivery_contact_phone,
        delivery_contact_email,
        business_accounts!inner(
          business_name,
          business_phone,
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

    // Check if email on booking is enabled (default: true)
    const emailEnabled = settings.email_on_booking !== false;
    if (!emailEnabled) {
      console.log('ℹ️ Email on booking is disabled for this business');
      return new Response(
        JSON.stringify({ success: false, message: 'Email on booking is disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const notifyPickup = settings.email_notify_pickup === true;
    const primaryColor = settings.primary_color || '#3b82f6';
    const logoUrl = settings.logo_url || null;
    const supportPhone = business?.business_phone || null;
    const supportEmailAddr = settings.support_email || null;
    const customSubject = settings.email_subject || '';

    const resend = new Resend(resendApiKey);
    const fromAddress = `${businessName} <notifications@${resendDomain}>`;

    // Helper: send one email
    const sendEmail = async (
      to: string,
      name: string,
      trackingNumber: string,
      trackingUrl: string,
      deliveryAddr?: string,
    ): Promise<{ email: string; success: boolean; id?: string; error?: string }> => {
      try {
        const subject = customSubject
          ? customSubject
              .replace(/\{name\}/gi, name)
              .replace(/\{tracking_number\}/gi, trackingNumber)
              .replace(/\{business_name\}/gi, businessName)
          : `${businessName} — Your Delivery is Booked! 📦`;

        const html = buildEmailHtml({
          recipientName: name || 'Customer',
          businessName,
          trackingNumber,
          trackingUrl,
          pickupAddress: delivery.pickup_address,
          deliveryAddress: deliveryAddr || delivery.delivery_address,
          packageDescription: delivery.package_description,
          primaryColor,
          logoUrl,
          supportPhone,
          supportEmail: supportEmailAddr,
        });

        const result = await resend.emails.send({
          from: fromAddress,
          to,
          subject,
          html,
        });

        console.log(`✅ Email sent to ${to} (id: ${result.id})`);
        return { email: to, success: true, id: result.id };
      } catch (err: any) {
        console.error(`❌ Email failed to ${to}:`, err.message);
        return { email: to, success: false, error: err.message };
      }
    };

    const results: Array<{ email: string; success: boolean; id?: string; error?: string }> = [];

    if (isMultiStop && stopTrackingCodes.length > 0) {
      // ── Multi-stop: one email per stop recipient ────────────────────────────
      for (const stop of stopTrackingCodes) {
        const { trackingCode, recipientEmail, recipientName, address } = stop;
        if (!recipientEmail) continue;

        const trackingUrl = `${appUrl}/track/${trackingCode}`;
        const result = await sendEmail(recipientEmail, recipientName || 'Customer', trackingCode, trackingUrl, address);
        results.push(result);
      }

      // Optionally notify pickup contact
      if (notifyPickup && delivery.pickup_contact_email) {
        const trackingUrl = `${appUrl}/track/${delivery.tracking_number}`;
        const result = await sendEmail(delivery.pickup_contact_email, delivery.pickup_contact_name || 'Sender', delivery.tracking_number, trackingUrl);
        results.push(result);
      }
    } else {
      // ── Single delivery ────────────────────────────────────────────────────
      const trackingUrl = `${appUrl}/track/${delivery.tracking_number}`;

      if (delivery.delivery_contact_email) {
        const result = await sendEmail(delivery.delivery_contact_email, delivery.delivery_contact_name || 'Customer', delivery.tracking_number, trackingUrl);
        results.push(result);
      }

      if (notifyPickup && delivery.pickup_contact_email) {
        const result = await sendEmail(delivery.pickup_contact_email, delivery.pickup_contact_name || 'Sender', delivery.tracking_number, trackingUrl);
        results.push(result);
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`📧 Email summary: ${successCount}/${results.length} sent successfully`);

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
    console.error('❌ send-tracking-email error:', error);
    return new Response(
      JSON.stringify({ success: false, message: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
