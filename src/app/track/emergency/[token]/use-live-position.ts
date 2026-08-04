'use client';

import { useEffect, useRef, useState } from 'react';
import type Ably from 'ably';
import { getAblyClient } from '@/lib/ably-client';

/**
 * Live responder position for one incident.
 *
 * Mirrors how delivery tracking already works: Ably carries the position,
 * because it is high frequency and cheap to miss, while the page's own polling
 * carries status, ETA and closure, because those are the opposite. Neither
 * replaces the other.
 *
 * Authorised by the tracking token the viewer already holds — the browser is
 * given a token good for this one channel, subscribe only, and nothing else.
 *
 * Returns null until a message actually arrives, which is the signal for the
 * caller to keep showing the position it polled from the database. That
 * fallback is what makes this safe to ship before the responder app publishes
 * here: if nothing ever comes, nothing breaks.
 */
export interface LivePosition {
  lat: number;
  lng: number;
  callsign?: string | null;
  at: number;
}

/** Both names the driver app publishes under, so either works. */
const EVENTS = ['location-update', 'driver_location'];

export function useLivePosition(
  channel: string | null,
  trackingToken: string,
  enabled: boolean
): LivePosition | null {
  const [position, setPosition] = useState<LivePosition | null>(null);
  const channelRef = useRef<Ably.RealtimeChannel | null>(null);

  useEffect(() => {
    if (!enabled || !channel) {
      setPosition(null);
      return;
    }

    let cancelled = false;
    let subscribed: Ably.RealtimeChannel | null = null;

    try {
      const ably = getAblyClient({ kind: 'emergency', trackingToken });
      const ch = ably.channels.get(channel);
      subscribed = ch;
      channelRef.current = ch;

      const onMessage = (message: Ably.Message) => {
        if (cancelled) return;
        const d = message.data as { latitude?: number; longitude?: number; callsign?: string };
        if (typeof d?.latitude !== 'number' || typeof d?.longitude !== 'number') return;
        setPosition({
          lat: d.latitude,
          lng: d.longitude,
          callsign: d.callsign ?? null,
          at: Date.now(),
        });
      };

      EVENTS.forEach((e) => ch.subscribe(e, onMessage));

      return () => {
        cancelled = true;
        EVENTS.forEach((e) => ch.unsubscribe(e, onMessage));
        ch.detach();
        channelRef.current = null;
      };
    } catch {
      // No live channel is not a failure worth surfacing to someone waiting for
      // an ambulance — the polled position carries on regardless.
      if (subscribed) subscribed.detach();
      return;
    }
  }, [channel, trackingToken, enabled]);

  return position;
}
