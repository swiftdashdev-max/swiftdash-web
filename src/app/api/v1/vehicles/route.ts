/**
 * GET /api/v1/vehicles  — list active vehicle types with pricing
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api-auth';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getServiceClient } from '@/lib/supabase-service';

export async function GET(req: NextRequest) {
  const start = Date.now();
  const auth = await authenticateApiKey(req.headers.get('x-api-key'));
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized', code: 'INVALID_API_KEY' }, { status: 401 });
  }

  const limited = await enforceRateLimit(auth);
  if (limited) return limited;

  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('vehicle_types')
    .select('id, name, description, max_weight_kg, base_price, price_per_km, icon_url')
    .eq('is_active', true)
    .order('base_price', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { headers: { 'x-response-time': `${Date.now() - start}ms` } });
}
