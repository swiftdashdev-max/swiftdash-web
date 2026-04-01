/**
 * Business API Key authentication helper.
 * Used by all /api/v1/* route handlers to validate inbound requests.
 *
 * API keys are stored hashed (SHA-256) in the database.
 * Clients send: `x-api-key: sd_live_<random>`
 */

import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

// ── Service-role client (bypasses RLS for key lookup) ─────────────────────────
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export interface AuthenticatedBusiness {
  businessId: string;
  keyId: string;
}

/**
 * Validates the `x-api-key` header.
 * Returns the authenticated business info, or null if invalid/missing.
 */
export async function authenticateApiKey(
  apiKey: string | null
): Promise<AuthenticatedBusiness | null> {
  if (!apiKey || !apiKey.startsWith('sd_')) return null;

  const hash = createHash('sha256').update(apiKey).digest('hex');
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('business_api_keys')
    .select('id, business_id, is_active')
    .eq('key_hash', hash)
    .single();

  if (error || !data || !data.is_active) return null;

  // Fire-and-forget: update last_used_at
  supabase
    .from('business_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {});

  return { businessId: data.business_id, keyId: data.id };
}

/**
 * Generates a new API key, stores its hash, and returns the raw key.
 * The raw key is ONLY returned once — at creation time.
 */
export async function generateApiKey(
  businessId: string,
  name: string
): Promise<{ rawKey: string; keyId: string; prefix: string }> {
  const { randomBytes } = await import('crypto');
  const raw = `sd_live_${randomBytes(24).toString('base64url')}`;
  const hash = createHash('sha256').update(raw).digest('hex');
  const prefix = raw.slice(0, 12); // e.g. "sd_live_ABCD"

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('business_api_keys')
    .insert({ business_id: businessId, name, key_hash: hash, key_prefix: prefix })
    .select('id')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Failed to create API key');

  return { rawKey: raw, keyId: data.id, prefix };
}
