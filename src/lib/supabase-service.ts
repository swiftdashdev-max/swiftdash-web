/**
 * Singleton Supabase service-role client for API routes.
 *
 * Reuses a single client instance across all requests in the same
 * serverless process, avoiding the overhead of creating a new client
 * on every API call (~50-100ms saved per request).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return _client;
}
