/**
 * GET /api/v1/vehicles  — list active vehicle types with pricing
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateApiKey } from '@/lib/api-auth';

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req.headers.get('x-api-key'));
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized', code: 'INVALID_API_KEY' }, { status: 401 });
  }

  const supabase = serviceClient();

  const { data, error } = await supabase
    .from('vehicle_types')
    .select('id, name, description, max_weight_kg, base_price, price_per_km, icon_url')
    .eq('is_active', true)
    .order('base_price', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
