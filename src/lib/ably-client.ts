'use client';

import Ably from 'ably';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';

// Ably client key from environment variable
// TODO: Get this key from driver team - should be same key they use
// Channel strategy: business uses 'tracking:{deliveryId}', customer uses 'delivery:{deliveryId}'
const ABLY_CLIENT_KEY = process.env.NEXT_PUBLIC_ABLY_CLIENT_KEY || '';

/**
 * Custom debounce function for location updates
 * Prevents excessive React re-renders from frequent Ably messages
 */
function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

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
 * React hook: Subscribe to driver location updates for a delivery
 * 
 * Channel: tracking:{deliveryId}
 * Event: driver_location
 * Frequency: Every 3 seconds (published by driver app)
 * 
 * @param deliveryId - Delivery ID to track
 * @returns Latest driver location or null
 */
export function useDriverLocation(deliveryId: string | null) {
  const [location, setLocation] = useState<DriverLocation | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<Ably.RealtimeChannel | null>(null);

  useEffect(() => {
    if (!deliveryId) {
      setLocation(null);
      setIsConnected(false);
      return;
    }

    const ably = getAblyClient();
    const channel = ably.channels.get(`tracking:${deliveryId}`);
    channelRef.current = channel;

    // Subscribe to driver location updates
    const handleLocationUpdate = (message: Ably.Message) => {
      const locationData = message.data as DriverLocation;
      console.log(`📍 Location update for delivery ${deliveryId}:`, locationData);
      setLocation(locationData);
    };

    // Subscribe to both event names for compatibility
    // Driver team uses 'location-update' but we also support 'driver_location'
    channel.subscribe('location-update', handleLocationUpdate);
    channel.subscribe('driver_location', handleLocationUpdate);

    // Monitor connection state
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

    // Cleanup on unmount
    return () => {
      channel.unsubscribe('location-update', handleLocationUpdate);
      channel.unsubscribe('driver_location', handleLocationUpdate);
      channel.detach();
      channelRef.current = null;
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
 * React hook: Subscribe to multiple delivery channels at once
 * Useful for tracking page where we monitor all active deliveries
 * 
 * PERFORMANCE: Debounces location updates to prevent excessive re-renders
 * - Driver app sends updates every 3-5 seconds
 * - We debounce to 1.5 seconds to reduce React cycles
 * - Marker interpolation still smooth (2-second animation)
 * 
 * @param deliveryIds - Array of delivery IDs to track
 * @returns Map of delivery ID to latest location
 */
export function useMultipleDriverLocations(deliveryIds: string[]) {
  const [locations, setLocations] = useState<Map<string, DriverLocation>>(new Map());
  const [connectionStates, setConnectionStates] = useState<Map<string, boolean>>(new Map());
  
  // Create a stable key from delivery IDs to prevent infinite loops
  const deliveryIdsKey = deliveryIds.sort().join(',');

  // Debounced update function - prevents excessive re-renders
  // 1500ms debounce means state updates max once every 1.5 seconds per delivery
  const debouncedUpdateLocation = useMemo(
    () => debounce((deliveryId: string, locationData: DriverLocation) => {
      setLocations((prev) => {
        const newMap = new Map(prev);
        newMap.set(deliveryId, locationData);
        return newMap;
      });
    }, 1500),
    []
  );

  useEffect(() => {
    if (!deliveryIds || deliveryIds.length === 0) {
      // Don't clear locations immediately - keep last known positions
      // Only clear connection states
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
        const locationData = message.data as DriverLocation;
        // Use debounced function instead of direct setState
        // This prevents component from re-rendering every 3-5 seconds
        debouncedUpdateLocation(deliveryId, locationData);
      };

      // Subscribe to both event names for compatibility
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
        // Attempt to reattach after a brief delay
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
        
        // Only detach if not already detached/detaching
        if (channel.state === 'attached' || channel.state === 'attaching') {
          channel.detach();
        }
      });
    });

    // Cleanup
    return () => {
      unsubscribeFunctions.forEach((unsubscribe) => unsubscribe());
    };
  }, [deliveryIdsKey, debouncedUpdateLocation]); // Add debouncedUpdateLocation to deps

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
