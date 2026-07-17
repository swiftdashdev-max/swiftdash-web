import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // User-scoped client to verify the JWT
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;

    // Admin client for privileged deletions
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Anonymize financial records (retained for legal compliance, PII removed)
    await supabaseAdmin
      .from('driver_earnings')
      .update({ notes: '[deleted]' })
      .eq('driver_id', userId);

    await supabaseAdmin
      .from('driver_payouts')
      .update({ notes: '[deleted]' })
      .eq('driver_id', userId);

    // 2. Delete personal / operational data
    await supabaseAdmin.from('driver_location_history').delete().eq('driver_id', userId);
    await supabaseAdmin.from('driver_current_status').delete().eq('driver_id', userId);
    await supabaseAdmin.from('driver_cash_balances').delete().eq('driver_id', userId);
    await supabaseAdmin.from('driver_commission_rates').delete().eq('driver_id', userId);
    await supabaseAdmin.from('driver_verification_submissions').delete().eq('driver_id', userId);

    // 3. Delete driver profile (contains PII: name, photo, bank details, vehicle info)
    await supabaseAdmin.from('driver_profiles').delete().eq('id', userId);

    // 4. Delete the auth user — this is irreversible
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      console.error('Failed to delete auth user:', deleteAuthError.message);
      return new Response(JSON.stringify({ error: 'Failed to delete account. Please contact support.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('delete-driver-account error:', err);
    return new Response(JSON.stringify({ error: 'An unexpected error occurred.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
