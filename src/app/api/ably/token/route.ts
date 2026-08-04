/**
 * POST /api/ably/token — mint a short-lived, channel-scoped Ably token.
 *
 * Replaces shipping an Ably API key to the browser. The key was readable in
 * page source on a public tracking page, and it opened every `tracking:*`
 * channel — so anyone who copied it could watch any delivery, or any emergency
 * responder, live.
 *
 * Here the browser proves what it is allowed to see, and gets back a token good
 * for those channels only, subscribe-only, and only for a while.
 *
 * Three ways to ask:
 *   delivery  — a tracking number, from the public customer tracking page
 *   emergency — an incident tracking token, from the public incident page
 *   business  — a signed-in session, from the console and dispatch map
 *
 * IMPORTANT: this endpoint is only half the fix. As long as
 * NEXT_PUBLIC_ABLY_CLIENT_KEY is set at build time it is still compiled into
 * the browser bundle. Move the value to ABLY_API_KEY (server-only) and remove
 * the NEXT_PUBLIC_ one, or the key remains readable regardless of this route.
 */

import { NextRequest, NextResponse } from 'next/server';
import Ably from 'ably';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getServiceClient } from '@/lib/supabase-service';

/**
 * Server-side key. Deliberately does NOT fall back to
 * NEXT_PUBLIC_ABLY_CLIENT_KEY: falling back would let a missing secret go
 * unnoticed while quietly depending on the very variable this route exists to
 * retire. Better to fail loudly with a 503.
 */
const ABLY_KEY = process.env.ABLY_CLIENT_KEY ?? process.env.ABLY_API_KEY ?? '';

// The public variable being present at build time is the whole vulnerability —
// Next compiles it into the browser bundle no matter what this route does.
if (process.env.NEXT_PUBLIC_ABLY_CLIENT_KEY) {
  console.warn(
    'NEXT_PUBLIC_ABLY_CLIENT_KEY is still set. It is compiled into the browser ' +
    'bundle and readable by anyone. Remove it and rotate the key in Ably.'
  );
}

/** Deliveries whose driver is actually moving. Nothing else has a live channel. */
const TRACKABLE_DELIVERY_STATUSES = [
  'driver_assigned', 'pickup_arrived', 'package_collected', 'in_transit', 'at_destination',
];

const OPEN_INCIDENT_STATUSES = ['submitted', 'dispatched', 'en_route', 'on_scene'];

/**
 * A public viewer holds one link and watches one thing, so a long token costs
 * nothing. A console operator's set of channels changes as calls come in, so
 * their token is deliberately short — it is the refresh that picks up new work.
 */
const TTL_PUBLIC_MS = 60 * 60 * 1000;
const TTL_BUSINESS_MS = 15 * 60 * 1000;

/**
 * Upper bound on channels in one token. Ably capability documents are not
 * unbounded, and a runaway account should degrade rather than fail to connect.
 */
const MAX_CHANNELS = 200;

type Capability = Record<string, string[]>;

function subscribeOnly(ids: string[]): Capability {
  const cap: Capability = {};
  for (const id of ids.slice(0, MAX_CHANNELS)) {
    // Subscribe only. Nothing that runs in a browser has any business
    // publishing a position — that is the driver app's job, with its own key.
    cap[`tracking:${id}`] = ['subscribe'];
  }
  return cap;
}

async function sessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function POST(req: NextRequest) {
  if (!ABLY_KEY) {
    console.error('ably/token: no Ably key configured');
    return NextResponse.json(
      { error: 'Live tracking is not configured.', code: 'NO_ABLY_KEY' },
      { status: 503 }
    );
  }

  let body: { scope?: string; trackingNumber?: string; trackingToken?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const supabase = getServiceClient();
  let capability: Capability = {};
  let clientId = 'anonymous';
  let ttl = TTL_PUBLIC_MS;

  // ── A customer watching one delivery ──────────────────────────────────────
  if (body.scope === 'delivery') {
    const trackingNumber = body.trackingNumber?.trim();
    if (!trackingNumber) {
      return NextResponse.json({ error: 'trackingNumber is required.' }, { status: 400 });
    }

    const { data: delivery } = await supabase
      .from('deliveries')
      .select('id, status')
      .eq('tracking_number', trackingNumber)
      .maybeSingle();

    // A token is refused rather than issued empty, so the client can tell
    // "you may not watch this" apart from "there is nothing to watch yet".
    if (!delivery || !TRACKABLE_DELIVERY_STATUSES.includes(delivery.status)) {
      return NextResponse.json(
        { error: 'Nothing to track for that number.', code: 'NOT_TRACKABLE' },
        { status: 404 }
      );
    }

    capability = subscribeOnly([delivery.id]);
    clientId = `track-${delivery.id.slice(0, 8)}`;
  }

  // ── Someone watching one incident ─────────────────────────────────────────
  else if (body.scope === 'emergency') {
    const token = body.trackingToken?.trim();
    // Tracking tokens are long random strings; a short one is not a near miss.
    if (!token || token.length < 32) {
      return NextResponse.json(
        { error: 'Nothing to track for that link.', code: 'NOT_TRACKABLE' },
        { status: 404 }
      );
    }

    const { data: incident } = await supabase
      .from('emergency_incidents')
      .select('id, status')
      .eq('tracking_token', token)
      .maybeSingle();

    if (!incident || !OPEN_INCIDENT_STATUSES.includes(incident.status)) {
      return NextResponse.json(
        { error: 'Nothing to track for that link.', code: 'NOT_TRACKABLE' },
        { status: 404 }
      );
    }

    capability = subscribeOnly([incident.id]);
    clientId = `track-${incident.id.slice(0, 8)}`;
  }

  // ── A signed-in operator watching their own work ──────────────────────────
  else {
    const userId = await sessionUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('business_id, status')
      .eq('id', userId)
      .single();

    if (!profile?.business_id || profile.status !== 'active') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Channels are named by delivery and incident id, which carry no business
    // of their own — so the only way to keep one account out of another's
    // channels is to enumerate what this account actually owns.
    const [deliveries, incidents] = await Promise.all([
      supabase
        .from('deliveries')
        .select('id')
        .eq('business_id', profile.business_id)
        .in('status', TRACKABLE_DELIVERY_STATUSES)
        .limit(MAX_CHANNELS),
      supabase
        .from('emergency_incidents')
        .select('id')
        .eq('command_center_id', profile.business_id)
        .in('status', OPEN_INCIDENT_STATUSES)
        .limit(MAX_CHANNELS),
    ]);

    const ids = [
      ...(deliveries.data ?? []).map((d) => d.id),
      ...(incidents.data ?? []).map((i) => i.id),
    ];

    capability = subscribeOnly(ids);
    clientId = `user-${userId.slice(0, 8)}`;
    ttl = TTL_BUSINESS_MS;
  }

  // An empty capability is not a valid Ably token request, and there is nothing
  // to grant anyway. Say so plainly instead of returning a token that cannot
  // attach to anything.
  if (Object.keys(capability).length === 0) {
    return NextResponse.json(
      { error: 'Nothing is live to track right now.', code: 'NOTHING_LIVE' },
      { status: 404 }
    );
  }

  try {
    const rest = new Ably.Rest({ key: ABLY_KEY });
    const tokenRequest = await rest.auth.createTokenRequest({
      capability: JSON.stringify(capability),
      clientId,
      ttl,
    });

    return NextResponse.json(tokenRequest, {
      status: 200,
      // A token is issued for one caller at one moment. A cache anywhere in
      // front of this would hand someone else's capabilities to the next viewer.
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('ably/token: could not create token request', err);
    return NextResponse.json(
      { error: 'Could not start live tracking.', code: 'TOKEN_FAILED' },
      { status: 500 }
    );
  }
}
