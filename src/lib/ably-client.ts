'use client';

import Ably from 'ably';
import { useEffect, useState, useRef, useCallback } from 'react';

// Ably client key from environment variable
// TODO: Get this key from driver team - should be same key they use
// Channel strategy: business uses 'tracking:{deliveryId}', customer uses 'delivery:{deliveryId}'
const ABLY_CLIENT_KEY = process.env.NEXT_PUBLIC_ABLY_CLIENT_KEY || '';

// Singleton Ably client instance
let ablyClientInstance: Ably.Realtime | null = null;

/**
 * Get or create Ably Realtime client instance
 * Uses singleton pattern to avoid multiple connections
 */
export function getAblyClient(): Ably.Realtime {
  if (!ablyClientInstance) {
    if (!ABLY_CLIENT_KEY) {
      console.warn('⚠️ NEXT_PUBLIC_ABLY_CLIENT_KEY not set. Real-time tracking will not work.');
      console.warn('📝 Add to .env.local: NEXT_PUBLIC_ABLY_CLIENT_KEY=your_ably_client_key');
    }

    ablyClientInstance = new Ably.Realtime({
      key: ABLY_CLIENT_KEY,
      clientId: `business-admin-${Math.random().toString(36).substring(7)}`,
      recover: (lastConnectionDetails, cb) => {
        // Attempt to recover connection
        cb(true);
      },
      disconnectedRetryTimeout: 3000,
      suspendedRetryTimeout: 10000,
    });

    // Connection state logging
    ablyClientInstance.connection.on('connected', () => {
      console.log('✅ Ably connected');
    });

    ablyClientInstance.connection.on('disconnected', () => {
      console.warn('⚠️ Ably disconnected');
    });

    ablyClientInstance.connection.on('failed', (error) => {
      console.error('❌ Ably connection failed:', error);
    });

    ablyClientInstance.connection.on('suspended', () => {
      console.warn('⏸️ Ably connection suspended');
    });
  }

  return ablyClientInstance;
}

/**
 * Close Ably connection (cleanup)
 */
export function closeAblyConnection() {
  if (ablyClientInstance) {
    ablyClientInstance.close();
    ablyClientInstance = null;
    console.log('🔌 Ably connection closed');
  }
}

// Type definitions for real-time events
export interface DriverLocation {
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
  timestamp: number;
  driver_id: string;
  delivery_id: string;
}

export interface StatusUpdate {
  status: string;
  delivery_id: string;
  driver_id: string;
  timestamp: number;
  notes?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

export interface StopUpdate {
  delivery_id: string;
  stop_index: number;
  stop_id: string;
  status: 'approaching' | 'arrived' | 'completed';
  timestamp: number;
  location?: {
    latitude: number;
    longitude: number;
  };
}

/**
 * Haversine distance in metres between two lat/lng points.
 * Fast enough for a hot message handler — no Math.atan2 required for small distances.
 */
function distanceMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000; // Earth radius in metres
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

/**
 * React hook: Subscribe to driver location updates for a delivery.
 *
 * Channel: tracking:{deliveryId}
 * Events:  'location-update' | 'driver_location'
 *
 * Receiver-side gate — mirrors the driver app's own publish gate:
 *   • Min distance:  25 m  — skip update if driver hasn't moved meaningfully
 *   • Min interval:  8 s   — skip update if last accepted update was < 8 s ago
 *
 * This means even if the driver app sends more frequently (e.g. during testing),
 * the web side won't re-render, re-route, or re-render the map marker needlessly.
 *
 * @param deliveryId - Delivery ID to track
 * @returns Latest driver location or null
 */
export function useDriverLocation(deliveryId: string | null) {
  const [location, setLocation] = useState<DriverLocation | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<Ably.RealtimeChannel | null>(null);

  // Gate refs — live outside React state so they don't cause re-renders
  const lastAcceptedRef = useRef<DriverLocation | null>(null);
  const lastAcceptedAtRef = useRef<number>(0);

  // Gate constants — match driver app publish policy
  const MIN_DISTANCE_M = 25;
  const MIN_INTERVAL_MS = 8_000;

  useEffect(() => {
    if (!deliveryId) {
      setLocation(null);
      setIsConnected(false);
      lastAcceptedRef.current = null;
      lastAcceptedAtRef.current = 0;
      return;
    }

    const ably = getAblyClient();
    const channel = ably.channels.get(`tracking:${deliveryId}`);
    channelRef.current = channel;

    const handleLocationUpdate = (message: Ably.Message) => {
      const incoming = message.data as DriverLocation;
      const now = Date.now();
      const prev = lastAcceptedRef.current;

      // --- Distance gate ---
      if (prev) {
        const moved = distanceMetres(
          prev.latitude, prev.longitude,
          incoming.latitude, incoming.longitude
        );
        if (moved < MIN_DISTANCE_M) return; // hasn't moved enough — drop
      }

      // --- Time gate ---
      if (now - lastAcceptedAtRef.current < MIN_INTERVAL_MS) return; // too soon — drop

      // Passed both gates — accept this update
      lastAcceptedRef.current = incoming;
      lastAcceptedAtRef.current = now;
      setLocation(incoming);
    };

    // Subscribe to both event names for driver-app compatibility
    channel.subscribe('location-update', handleLocationUpdate);
    channel.subscribe('driver_location', handleLocationUpdate);

    channel.on('attached', () => {
      console.log(`✅ Subscribed to tracking:${deliveryId}`);
      setIsConnected(true);
    });

    channel.on('detached', () => {
      console.log(`🔌 Detached from tracking:${deliveryId}`);
      setIsConnected(false);
    });

    channel.on('failed', (error) => {
      console.error(`❌ Channel failed for tracking:${deliveryId}:`, error);
      setIsConnected(false);
    });

    return () => {
      channel.unsubscribe('location-update', handleLocationUpdate);
      channel.unsubscribe('driver_location', handleLocationUpdate);
      channel.detach();
      channelRef.current = null;
      lastAcceptedRef.current = null;
      lastAcceptedAtRef.current = 0;
    };
  }, [deliveryId]);

  return { location, isConnected };
}

/**
 * React hook: Subscribe to delivery status updates
 * 
 * Channel: tracking:{deliveryId}
 * Event: status_update
 * Triggers: going_to_pickup, arrived_at_pickup, picked_up, going_to_dropoff, arrived_at_dropoff, delivered
 * 
 * @param deliveryId - Delivery ID to monitor
 * @returns Latest status update or null
 */
export function useDeliveryStatus(deliveryId: string | null) {
  const [status, setStatus] = useState<StatusUpdate | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!deliveryId) {
      setStatus(null);
      setIsConnected(false);
      return;
    }

    const ably = getAblyClient();
    const channel = ably.channels.get(`tracking:${deliveryId}`);

    const handleStatusUpdate = (message: Ably.Message) => {
      const statusData = message.data as StatusUpdate;
      console.log(`📊 Status update for delivery ${deliveryId}:`, statusData);
      setStatus(statusData);
    };

    channel.subscribe('status_update', handleStatusUpdate);

    channel.on('attached', () => {
      console.log(`✅ Subscribed to status updates for tracking:${deliveryId}`);
      setIsConnected(true);
    });

    channel.on('detached', () => {
      setIsConnected(false);
    });

    return () => {
      channel.unsubscribe('status_update', handleStatusUpdate);
      channel.detach();
    };
  }, [deliveryId]);

  return { status, isConnected };
}

/**
 * React hook: Subscribe to multi-stop updates
 * 
 * Channel: tracking:{deliveryId}
 * Event: stop_update
 * Triggers: When driver approaches, arrives at, or completes each stop
 * 
 * @param deliveryId - Delivery ID to monitor
 * @returns Latest stop update or null
 */
export function useStopUpdates(deliveryId: string | null) {
  const [stopUpdate, setStopUpdate] = useState<StopUpdate | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!deliveryId) {
      setStopUpdate(null);
      setIsConnected(false);
      return;
    }

    const ably = getAblyClient();
    const channel = ably.channels.get(`tracking:${deliveryId}`);

    const handleStopUpdate = (message: Ably.Message) => {
      const stopData = message.data as StopUpdate;
      console.log(`🛑 Stop update for delivery ${deliveryId}:`, stopData);
      setStopUpdate(stopData);
    };

    channel.subscribe('stop_update', handleStopUpdate);

    channel.on('attached', () => {
      console.log(`✅ Subscribed to stop updates for tracking:${deliveryId}`);
      setIsConnected(true);
    });

    channel.on('detached', () => {
      setIsConnected(false);
    });

    return () => {
      channel.unsubscribe('stop_update', handleStopUpdate);
      channel.detach();
    };
  }, [deliveryId]);

  return { stopUpdate, isConnected };
}

/**
 * React hook: Subscribe to multiple delivery channels at once.
 * Useful for the business tracking page monitoring all active deliveries.
 *
 * Receiver-side gate — same policy as useDriverLocation:
 *   • Min distance:  25 m  — skip if driver hasn't moved meaningfully
 *   • Min interval:  8 s   — skip if last accepted update was < 8 s ago
 *
 * @param deliveryIds - Array of delivery IDs to track
 * @returns Map of delivery ID to latest location
 */
export function useMultipleDriverLocations(deliveryIds: string[]) {
  const [locations, setLocations] = useState<Map<string, DriverLocation>>(new Map());
  const [connectionStates, setConnectionStates] = useState<Map<string, boolean>>(new Map());

  // Per-delivery gate refs: last accepted location + timestamp
  const lastAcceptedRef = useRef<Map<string, DriverLocation>>(new Map());
  const lastAcceptedAtRef = useRef<Map<string, number>>(new Map());

  const MIN_DISTANCE_M = 25;
  const MIN_INTERVAL_MS = 8_000;

  // Stable key to avoid useEffect re-running on every render
  const deliveryIdsKey = deliveryIds.sort().join(',');

  useEffect(() => {
    if (!deliveryIds || deliveryIds.length === 0) {
      setConnectionStates(new Map());
      return;
    }

    const ably = getAblyClient();
    const channels: Ably.RealtimeChannel[] = [];
    const unsubscribeFunctions: (() => void)[] = [];

    deliveryIds.forEach((deliveryId) => {
      const channel = ably.channels.get(`tracking:${deliveryId}`);
      channels.push(channel);

      const handleLocationUpdate = (message: Ably.Message) => {
        const incoming = message.data as DriverLocation;
        const now = Date.now();
        const prev = lastAcceptedRef.current.get(deliveryId);

        // Distance gate
        if (prev) {
          const moved = distanceMetres(
            prev.latitude, prev.longitude,
            incoming.latitude, incoming.longitude
          );
          if (moved < MIN_DISTANCE_M) return;
        }

        // Time gate
        const lastAt = lastAcceptedAtRef.current.get(deliveryId) ?? 0;
        if (now - lastAt < MIN_INTERVAL_MS) return;

        // Accepted — update gate refs and state
        lastAcceptedRef.current.set(deliveryId, incoming);
        lastAcceptedAtRef.current.set(deliveryId, now);
        setLocations((prev) => {
          const newMap = new Map(prev);
          newMap.set(deliveryId, incoming);
          return newMap;
        });
      };

      channel.subscribe('location-update', handleLocationUpdate);
      channel.subscribe('driver_location', handleLocationUpdate);

      const handleAttached = () => {
        setConnectionStates((prev) => {
          const newMap = new Map(prev);
          newMap.set(deliveryId, true);
          return newMap;
        });
      };

      const handleDetached = () => {
        setConnectionStates((prev) => {
          const newMap = new Map(prev);
          newMap.set(deliveryId, false);
          return newMap;
        });
      };

      const handleFailed = () => {
        console.warn(`⚠️ Channel failed for delivery ${deliveryId}, attempting to reattach...`);
        setTimeout(() => {
          if (channel.state === 'failed' || channel.state === 'suspended') {
            channel.attach();
          }
        }, 2000);
      };

      channel.on('attached', handleAttached);
      channel.on('detached', handleDetached);
      channel.on('failed', handleFailed);
      channel.on('suspended', handleFailed);

      unsubscribeFunctions.push(() => {
        channel.off('attached', handleAttached);
        channel.off('detached', handleDetached);
        channel.off('failed', handleFailed);
        channel.off('suspended', handleFailed);
        channel.unsubscribe('location-update', handleLocationUpdate);
        channel.unsubscribe('driver_location', handleLocationUpdate);
        if (channel.state === 'attached' || channel.state === 'attaching') {
          channel.detach();
        }
        lastAcceptedRef.current.delete(deliveryId);
        lastAcceptedAtRef.current.delete(deliveryId);
      });
    });

    return () => {
      unsubscribeFunctions.forEach((unsubscribe) => unsubscribe());
    };
  }, [deliveryIdsKey]);

  return { locations, connectionStates };
}

/**
 * Generic channel subscription hook
 * For custom use cases not covered by specific hooks
 * 
 * @param channelName - Ably channel name
 * @param eventName - Event name to subscribe to
 * @param callback - Callback function when message received
 */
export function useAblyChannel<T = any>(
  channelName: string | null,
  eventName: string,
  callback: (data: T) => void
) {
  const callbackRef = useRef(callback);
  const [isConnected, setIsConnected] = useState(false);

  // Update callback ref when it changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!channelName) {
      setIsConnected(false);
      return;
    }

    const ably = getAblyClient();
    const channel = ably.channels.get(channelName);

    const handleMessage = (message: Ably.Message) => {
      callbackRef.current(message.data as T);
    };

    channel.subscribe(eventName, handleMessage);

    channel.on('attached', () => {
      console.log(`✅ Subscribed to ${channelName}:${eventName}`);
      setIsConnected(true);
    });

    channel.on('detached', () => {
      setIsConnected(false);
    });

    channel.on('failed', (error) => {
      console.error(`❌ Channel failed for ${channelName}:`, error);
      setIsConnected(false);
    });

    return () => {
      channel.unsubscribe(eventName, handleMessage);
      channel.detach();
    };
  }, [channelName, eventName]);

  return { isConnected };
}

/**
 * Get connection state of Ably client
 */
export function useAblyConnectionState() {
  const [connectionState, setConnectionState] = useState<string>('initialized');
  const [error, setError] = useState<Ably.ErrorInfo | null>(null);

  useEffect(() => {
    const ably = getAblyClient();

    const handleStateChange = (stateChange: Ably.ConnectionStateChange) => {
      setConnectionState(stateChange.current);
      if (stateChange.reason) {
        setError(stateChange.reason);
      }
      console.log(`🔄 Ably connection state: ${stateChange.current}`);
    };

    ably.connection.on(handleStateChange);

    // Set initial state
    setConnectionState(ably.connection.state);

    return () => {
      ably.connection.off(handleStateChange);
    };
  }, []);

  return {
    connectionState,
    error,
    isConnected: connectionState === 'connected',
    isConnecting: connectionState === 'connecting',
    isDisconnected: connectionState === 'disconnected',
    isFailed: connectionState === 'failed',
  };
}

// ---------------------------------------------------------------------------
// INTERPOLATION
// ---------------------------------------------------------------------------
//
// The driver app publishes every 8 s (with a 25 m distance gate).
// Without interpolation the marker would jump every 8 s — larger jumps than
// before the gate was added.
//
// These hooks wrap the raw gated hooks and return a position that is linearly
// interpolated (lerped) between the previous and current GPS fix over the
// expected interval, driven by requestAnimationFrame.
//
// At 30 km/h the driver moves ~67 m in 8 s — the lerp makes the icon glide
// smoothly across those 67 m instead of snapping.
// ---------------------------------------------------------------------------

/** Linearly interpolate a single number. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(Math.max(t, 0), 1);
}

/**
 * React hook: smoothly interpolated driver location for a single delivery.
 *
 * Drop-in replacement for useDriverLocation — returns the same shape but the
 * lat/lng values are lerped between GPS fixes at 60 fps so the map marker
 * glides rather than jumps.
 *
 * @param deliveryId - Delivery ID to track (pass null to disable)
 */
export function useInterpolatedDriverLocation(deliveryId: string | null) {
  const { location: rawLocation, isConnected } = useDriverLocation(deliveryId);

  // Interpolated output state
  const [location, setLocation] = useState<DriverLocation | null>(null);

  // Animation state stored in refs to avoid re-renders
  const fromRef = useRef<DriverLocation | null>(null);   // position we're lerping FROM
  const toRef = useRef<DriverLocation | null>(null);     // position we're lerping TO
  const startTimeRef = useRef<number>(0);                // when we started this segment
  const rafRef = useRef<number>(0);                      // requestAnimationFrame handle
  const intervalRef = useRef<number>(8_000);             // expected ms between fixes

  // When a new raw fix arrives, start a new lerp segment
  useEffect(() => {
    if (!rawLocation) return;

    const now = performance.now();

    if (fromRef.current && toRef.current) {
      // Mid-flight: snap FROM to wherever the lerp currently is
      const elapsed = now - startTimeRef.current;
      const t = Math.min(elapsed / intervalRef.current, 1);
      fromRef.current = {
        ...fromRef.current,
        latitude: lerp(fromRef.current.latitude, toRef.current.latitude, t),
        longitude: lerp(fromRef.current.longitude, toRef.current.longitude, t),
      };
      // Update interval estimate from actual gap between fixes
      intervalRef.current = Math.max(elapsed, 1_000);
    } else {
      // First fix — no animation yet, just place the marker
      fromRef.current = rawLocation;
      setLocation(rawLocation);
    }

    toRef.current = rawLocation;
    startTimeRef.current = now;
  }, [rawLocation]);

  // rAF loop — runs while we have a lerp target
  useEffect(() => {
    let animating = true;

    const tick = () => {
      if (!animating) return;

      const from = fromRef.current;
      const to = toRef.current;

      if (from && to) {
        const elapsed = performance.now() - startTimeRef.current;
        const t = elapsed / intervalRef.current;

        if (t < 1) {
          setLocation({
            ...to,
            latitude: lerp(from.latitude, to.latitude, t),
            longitude: lerp(from.longitude, to.longitude, t),
          });
          rafRef.current = requestAnimationFrame(tick);
        } else {
          // Reached destination — hold at TO and stop animating
          setLocation(to);
          // Don't schedule another frame — next fix will restart
        }
      }
    };

    if (toRef.current) {
      rafRef.current = requestAnimationFrame(tick);
    }

    return () => {
      animating = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [rawLocation]); // restart the rAF loop each time a new fix arrives

  // Clear on unmount / delivery change
  useEffect(() => {
    if (!deliveryId) {
      setLocation(null);
      fromRef.current = null;
      toRef.current = null;
      cancelAnimationFrame(rafRef.current);
    }
  }, [deliveryId]);

  return { location, isConnected };
}

/**
 * React hook: smoothly interpolated locations for multiple deliveries.
 *
 * Drop-in replacement for useMultipleDriverLocations.
 * Each delivery's marker glides independently.
 *
 * @param deliveryIds - Array of delivery IDs to track
 */
export function useInterpolatedMultipleDriverLocations(deliveryIds: string[]) {
  const { locations: rawLocations, connectionStates } = useMultipleDriverLocations(deliveryIds);

  // Interpolated output
  const [locations, setLocations] = useState<Map<string, DriverLocation>>(new Map());

  // Per-delivery animation state
  const fromMap = useRef<Map<string, DriverLocation>>(new Map());
  const toMap = useRef<Map<string, DriverLocation>>(new Map());
  const startMap = useRef<Map<string, number>>(new Map());
  const intervalMap = useRef<Map<string, number>>(new Map());
  const rafRef = useRef<number>(0);
  const activeRef = useRef(false);

  // When raw locations update, register new lerp targets
  useEffect(() => {
    const now = performance.now();

    rawLocations.forEach((incoming, deliveryId) => {
      const prevTo = toMap.current.get(deliveryId);
      // Only process if this is actually a new fix
      if (prevTo &&
          prevTo.latitude === incoming.latitude &&
          prevTo.longitude === incoming.longitude) return;

      const from = fromMap.current.get(deliveryId);
      if (from && prevTo) {
        // Snap FROM to current lerp position
        const elapsed = now - (startMap.current.get(deliveryId) ?? now);
        const interval = intervalMap.current.get(deliveryId) ?? 8_000;
        const t = Math.min(elapsed / interval, 1);
        fromMap.current.set(deliveryId, {
          ...from,
          latitude: lerp(from.latitude, prevTo.latitude, t),
          longitude: lerp(from.longitude, prevTo.longitude, t),
        });
        intervalMap.current.set(deliveryId, Math.max(elapsed, 1_000));
      } else {
        fromMap.current.set(deliveryId, incoming);
        intervalMap.current.set(deliveryId, 8_000);
      }

      toMap.current.set(deliveryId, incoming);
      startMap.current.set(deliveryId, now);
    });
  }, [rawLocations]);

  // Single shared rAF loop for all deliveries
  const startLoop = useCallback(() => {
    if (activeRef.current) return;
    activeRef.current = true;

    const tick = () => {
      if (!activeRef.current) return;
      const now = performance.now();
      let anyMoving = false;

      const updated = new Map<string, DriverLocation>();
      toMap.current.forEach((to, deliveryId) => {
        const from = fromMap.current.get(deliveryId);
        if (!from) { updated.set(deliveryId, to); return; }

        const elapsed = now - (startMap.current.get(deliveryId) ?? now);
        const interval = intervalMap.current.get(deliveryId) ?? 8_000;
        const t = elapsed / interval;

        if (t < 1) {
          anyMoving = true;
          updated.set(deliveryId, {
            ...to,
            latitude: lerp(from.latitude, to.latitude, t),
            longitude: lerp(from.longitude, to.longitude, t),
          });
        } else {
          updated.set(deliveryId, to);
        }
      });

      setLocations(new Map(updated));

      if (anyMoving) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        activeRef.current = false;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // Restart the loop each time new fixes come in
  useEffect(() => {
    startLoop();
    return () => {
      activeRef.current = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [rawLocations, startLoop]);

  return { locations, connectionStates };
}
