/**
 * Per-API-key rate limiting for the public v1 API.
 *
 * The counter lives in Postgres, because serverless instances share no memory —
 * a limit held in process would be enforced separately by every instance, which
 * is not a limit at all. `check_api_rate_limit` does the increment and the
 * verdict in one atomic call.
 *
 * ── Where this must NOT be used ────────────────────────────────────────────
 *
 * The emergency endpoints. Their API key belongs to the command center, which
 * means every citizen of the city shares one key. A per-key limit would not
 * throttle a person, it would throttle the whole population — and it would do
 * so during a typhoon or a fire, when hundreds report at once and the system
 * matters most. Flood protection there belongs at the IP layer, where an
 * attacker is one address and a city is thousands.
 */

import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-service';
import type { AuthenticatedBusiness } from '@/lib/api-auth';

/**
 * Requests per minute, by subscription tier. These are the numbers published in
 * the API reference — if you change them here, change them there.
 *
 * `null` means unlimited, and skips the database call entirely.
 */
export const TIER_LIMITS: Record<string, number | null> = {
  starter:    60,
  business:   300,
  enterprise: null,
};

const DEFAULT_TIER = 'starter';
const WINDOW_SECONDS = 60;

export interface RateLimitVerdict {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Unix seconds at which the current window resets. */
  reset: number;
}

function headersFor(v: RateLimitVerdict): Record<string, string> {
  return {
    'X-RateLimit-Limit':     String(v.limit),
    'X-RateLimit-Remaining': String(v.remaining),
    'X-RateLimit-Reset':     String(v.reset),
    'Retry-After':           String(Math.max(1, v.reset - Math.floor(Date.now() / 1000))),
  };
}

/**
 * Count this request and decide whether it may proceed.
 *
 * Fails **open**. If the counter is unreachable the request is allowed through:
 * a rate limiter that takes the API down when it breaks has caused more damage
 * than the abuse it was protecting against.
 */
export async function checkRateLimit(
  auth: AuthenticatedBusiness
): Promise<RateLimitVerdict | null> {
  const limit = TIER_LIMITS[auth.tier ?? DEFAULT_TIER] ?? TIER_LIMITS[DEFAULT_TIER];
  if (limit == null) return null; // unlimited tier — nothing to count

  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase.rpc('check_api_rate_limit', {
      p_key_id: auth.keyId,
      p_limit: limit,
      p_window_seconds: WINDOW_SECONDS,
    });

    if (error || !data) {
      console.warn('rate-limit: check failed, allowing request', error);
      return null;
    }

    return data as RateLimitVerdict;
  } catch (err) {
    console.warn('rate-limit: check threw, allowing request', err);
    return null;
  }
}

/**
 * The whole thing in one call, for routes that just want to be protected.
 *
 * Returns a ready-to-send 429 when the caller is over their limit, or null when
 * they may proceed. Usage:
 *
 *     const limited = await enforceRateLimit(auth);
 *     if (limited) return limited;
 */
export async function enforceRateLimit(
  auth: AuthenticatedBusiness
): Promise<NextResponse | null> {
  const verdict = await checkRateLimit(auth);
  if (!verdict || verdict.allowed) return null;

  return NextResponse.json(
    {
      error:
        `Rate limit exceeded. You may make ${verdict.limit} requests per minute on this plan.`,
      code: 'RATE_LIMIT_EXCEEDED',
    },
    { status: 429, headers: headersFor(verdict) }
  );
}
