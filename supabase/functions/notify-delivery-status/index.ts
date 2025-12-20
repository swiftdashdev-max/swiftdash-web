// @ts-nocheck
// Notify Delivery Status Edge Function
// Triggers on delivery status changes to send SMS and email notifications
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Twilio from "https://esm.sh/twilio@5.3.4";
import { Resend } from "https://esm.sh/resend@4.0.0";

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
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse webhook payload from database trigger
    const { record } = await req.json();
    
    if (!record) {
      throw new Error('No delivery record provided');
    }

    // Only send notifications for in_transit and delivered statuses
    if (!['in_transit', 'delivered'].includes(record.status)) {
      return new Response(
        JSON.stringify({ message: 'Status not eligible for notifications' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch full delivery details with business branding
    const { data: delivery, error: deliveryError } = await supabase
      .from('deliveries')
      .select(`
        *,
        business_accounts!inner(
          business_name,
          business_phone,
          settings
        )
      `)
      .eq('id', record.id)
      .single();

    if (deliveryError || !delivery) {
      throw new Error('Failed to fetch delivery details');
    }

    const business = delivery.business_accounts;
    const businessName = business.business_name || 'SwiftDash';
    const trackingUrl = `${Deno.env.get('APP_URL') || 'https://swiftdash.app'}/track/${delivery.tracking_number}`;

    // Prepare notification recipients
    const smsRecipients = [];
    const emailRecipients = [];

    // Add pickup contact
    if (delivery.pickup_contact_phone) {
      smsRecipients.push({
        phone: delivery.pickup_contact_phone,
        name: delivery.pickup_contact_name,
        role: 'sender'
      });
    }
    if (delivery.pickup_contact_email) {
      emailRecipients.push({
        email: delivery.pickup_contact_email,
        name: delivery.pickup_contact_name,
        role: 'sender'
      });
    }

    // Add delivery contact
    if (delivery.delivery_contact_phone) {
      smsRecipients.push({
        phone: delivery.delivery_contact_phone,
        name: delivery.delivery_contact_name,
        role: 'recipient'
      });
    }
    if (delivery.delivery_contact_email) {
      emailRecipients.push({
        email: delivery.delivery_contact_email,
        name: delivery.delivery_contact_name,
        role: 'recipient'
      });
    }

    const results = {
      sms: [],
      email: []
    };

    // Send SMS notifications
    if (twilioAccountSid && twilioAuthToken && twilioPhoneNumber && smsRecipients.length > 0) {
      const twilioClient = Twilio(twilioAccountSid, twilioAuthToken);

      for (const recipient of smsRecipients) {
        try {
          let message = '';
          if (record.status === 'in_transit') {
            message = `${businessName}: Your delivery is now in transit! Track it here: ${trackingUrl}`;
          } else if (record.status === 'delivered') {
            message = `${businessName}: Your delivery has been completed! View details: ${trackingUrl}`;
          }

          const result = await twilioClient.messages.create({
            body: message,
            from: twilioPhoneNumber,
            to: recipient.phone
          });

          results.sms.push({
            to: recipient.phone,
            status: 'sent',
            sid: result.sid
          });
        } catch (error) {
          console.error(`Failed to send SMS to ${recipient.phone}:`, error);
          results.sms.push({
            to: recipient.phone,
            status: 'failed',
            error: error.message
          });
        }
      }
    }

    // Send Email notifications
    if (resendApiKey && emailRecipients.length > 0) {
      const resend = new Resend(resendApiKey);

      for (const recipient of emailRecipients) {
        try {
          let subject = '';
          let html = '';

          if (record.status === 'in_transit') {
            subject = `${businessName} - Your Delivery is In Transit`;
            html = `
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="utf-8">
                  <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: ${business.settings?.primary_color || '#3b82f6'}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
                    .button { display: inline-block; background: ${business.settings?.primary_color || '#3b82f6'}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
                    .details { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; }
                    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="header">
                      <h1>🚚 Delivery In Transit</h1>
                    </div>
                    <div class="content">
                      <p>Hi ${recipient.name},</p>
                      <p>Great news! Your delivery is now on its way.</p>
                      
                      <div class="details">
                        <p><strong>Tracking Number:</strong> ${delivery.tracking_number}</p>
                        <p><strong>From:</strong> ${delivery.pickup_address}</p>
                        <p><strong>To:</strong> ${delivery.delivery_address}</p>
                        <p><strong>Package:</strong> ${delivery.package_description}</p>
                      </div>

                      <center>
                        <a href="${trackingUrl}" class="button">Track Your Delivery</a>
                      </center>

                      <p>You can track your delivery in real-time using the link above.</p>
                    </div>
                    <div class="footer">
                      <p>Powered by ${businessName}</p>
                      ${business.business_phone ? `<p>Support: ${business.business_phone}</p>` : ''}
                    </div>
                  </div>
                </body>
              </html>
            `;
          } else if (record.status === 'delivered') {
            subject = `${businessName} - Delivery Completed`;
            
            // Calculate total time
            const completedTime = new Date(delivery.completed_at || delivery.updated_at);
            const createdTime = new Date(delivery.created_at);
            const diffMinutes = Math.round((completedTime.getTime() - createdTime.getTime()) / 60000);
            const hours = Math.floor(diffMinutes / 60);
            const minutes = diffMinutes % 60;
            const totalTime = hours > 0 ? `${hours}h ${minutes}m` : `${minutes} minutes`;

            html = `
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="utf-8">
                  <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
                    .success-icon { font-size: 48px; margin: 10px 0; }
                    .invoice { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border: 1px solid #e5e7eb; }
                    .invoice-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
                    .invoice-total { font-weight: bold; font-size: 18px; margin-top: 10px; }
                    .button { display: inline-block; background: ${business.settings?.primary_color || '#3b82f6'}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
                    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="header">
                      <div class="success-icon">✅</div>
                      <h1>Delivery Completed!</h1>
                    </div>
                    <div class="content">
                      <p>Hi ${recipient.name},</p>
                      <p>Your delivery has been successfully completed.</p>
                      
                      <div class="invoice">
                        <h3>Delivery Summary</h3>
                        <div class="invoice-row">
                          <span>Tracking Number</span>
                          <span><strong>${delivery.tracking_number}</strong></span>
                        </div>
                        <div class="invoice-row">
                          <span>From</span>
                          <span>${delivery.pickup_address}</span>
                        </div>
                        <div class="invoice-row">
                          <span>To</span>
                          <span>${delivery.delivery_address}</span>
                        </div>
                        <div class="invoice-row">
                          <span>Package</span>
                          <span>${delivery.package_description}</span>
                        </div>
                        <div class="invoice-row">
                          <span>Distance</span>
                          <span>${delivery.distance_km ? delivery.distance_km.toFixed(1) + ' km' : 'N/A'}</span>
                        </div>
                        <div class="invoice-row">
                          <span>Total Time</span>
                          <span>${totalTime}</span>
                        </div>
                        <div class="invoice-row">
                          <span>Completed At</span>
                          <span>${completedTime.toLocaleString()}</span>
                        </div>
                        ${delivery.total_amount ? `
                        <div class="invoice-row invoice-total">
                          <span>Total Amount</span>
                          <span>₱${delivery.total_amount.toFixed(2)}</span>
                        </div>
                        ` : ''}
                      </div>

                      <center>
                        <a href="${trackingUrl}" class="button">View Details & Rate</a>
                      </center>

                      <p>Thank you for using ${businessName}!</p>
                    </div>
                    <div class="footer">
                      <p>Powered by ${businessName}</p>
                      ${business.business_phone ? `<p>Support: ${business.business_phone}</p>` : ''}
                    </div>
                  </div>
                </body>
              </html>
            `;
          }

          const result = await resend.emails.send({
            from: `${businessName} <notifications@${Deno.env.get('RESEND_DOMAIN') || 'swiftdash.app'}>`,
            to: recipient.email,
            subject: subject,
            html: html
          });

          results.email.push({
            to: recipient.email,
            status: 'sent',
            id: result.id
          });
        } catch (error) {
          console.error(`Failed to send email to ${recipient.email}:`, error);
          results.email.push({
            to: recipient.email,
            status: 'failed',
            error: error.message
          });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        delivery_id: delivery.id,
        tracking_number: delivery.tracking_number,
        status: record.status,
        results
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error in notify-delivery-status function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});
