/**
 * Business API Key authentication helper.
 * Used by all /api/v1/* route handlers to validate inbound requests.
 *
 * API keys are stored hashed (SHA-256) in the database.
 * Clients send: `x-api-key: sd_live_<random>`
 *
 * Performance: Uses an in-memory LRU cache (5-min TTL) so repeat calls
 * with the same key skip both the hash-lookup and user_profiles JOIN,
 * saving ~800-1200ms per cached request.
 */

import { createHash } from 'crypto';
import { getServiceClient } from '@/lib/supabase-service';

export interface AuthenticatedBusiness {
  /** The auth user ID (owner of the API key) */
  businessId: string;
  /** The business_accounts ID (used on deliveries.business_id) */
  accountId: string | null;
  keyId: string;
}

// ── In-memory auth cache ──────────────────────────────────────────────────────
// Key = SHA-256 hash of the API key, Value = { auth, expiresAt }
// Max 200 entries, 5-minute TTL, evicts oldest on overflow.

const AUTH_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const AUTH_CACHE_MAX    = 200;

interface CacheEntry {
  auth: AuthenticatedBusiness;
  expiresAt: number;
}

const authCache = new Map<string, CacheEntry>();

function cacheGet(hash: string): AuthenticatedBusiness | null {
  const entry = authCache.get(hash);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    authCache.delete(hash);
    return null;
  }
  // Move to end (LRU refresh)
  authCache.delete(hash);
  authCache.set(hash, entry);
  return entry.auth;
}

function cacheSet(hash: string, auth: AuthenticatedBusiness): void {
  // Evict oldest if at capacity
  if (authCache.size >= AUTH_CACHE_MAX) {
    const oldestKey = authCache.keys().next().value;
    if (oldestKey) authCache.delete(oldestKey);
  }
  authCache.set(hash, { auth, expiresAt: Date.now() + AUTH_CACHE_TTL_MS });
}

/** Invalidate cache for a specific key hash (e.g. on key revocation). */
export function invalidateAuthCache(keyHash?: string): void {
  if (keyHash) {
    authCache.delete(keyHash);
  } else {
    authCache.clear();
  }
}

/**
 * Validates the `x-api-key` header.
 * Returns the authenticated business info, or null if invalid/missing.
 *
 * Uses a single JOIN query (api_keys + user_profiles) and caches the
 * result in-memory for 5 minutes to eliminate repeat DB round-trips.
 */
/**
 * Hash an API key the way the database stores it.
 *
 * Exported so a route that pushes its whole flow into one SQL call can pass the
 * hash straight through, instead of spending a round trip resolving the key and
 * another doing the work.
 */
export function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

export async function authenticateApiKey(
  apiKey: string | null
): Promise<AuthenticatedBusiness | null> {
  if (!apiKey || !apiKey.startsWith('sd_')) return null;

  const hash = createHash('sha256').update(apiKey).digest('hex');

  // ── Check cache first ──────────────────────────────────
  const cached = cacheGet(hash);
  if (cached) return cached;

  // ── Single RPC query: key lookup + profile join in one DB call ──
  const supabase = getServiceClient();

  const { data, error } = await supabase.rpc('authenticate_api_key', {
    p_key_hash: hash,
  });

  if (error || !data) return null;

  const result: AuthenticatedBusiness = {
    businessId: data.business_id,
    accountId: data.account_id ?? null,
    keyId: data.key_id,
  };

  // ── Cache the result ──────────────────────────────────
  cacheSet(hash, result);

  return result;
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
