/**
 * Performance optimization hook for the delivery system
 * Handles preloading and caching of common resources
 */

'use client';

import { useEffect, useCallback } from 'react';
import { routeCache, preloadRoutes } from '@/lib/route-cache';
import { mapStyleCache, COMMON_DELIVERY_ZONES, METRO_MANILA_BOUNDS } from '@/lib/map-optimization';

interface UseDeliveryPerformanceOptions {
  preloadCommonRoutes?: boolean;
  preloadMapTiles?: boolean;
  enablePerformanceLogging?: boolean;
}

// Common pickup/dropoff combinations in Metro Manila
const COMMON_ROUTES = [
  {
    pickup: [121.0340, 14.5995] as [number, number], // Makati
    dropoffs: [[121.0550, 14.6091] as [number, number]], // BGC
  },
  {
    pickup: [121.0340, 14.5995] as [number, number], // Makati
    dropoffs: [[121.0650, 14.5850] as [number, number]], // Ortigas
  },
  {
    pickup: [121.0550, 14.6091] as [number, number], // BGC
    dropoffs: [[121.0340, 14.5995] as [number, number]], // Makati
  },
  {
    pickup: [121.0340, 14.5995] as [number, number], // Makati
    dropoffs: [[121.0400, 14.4200] as [number, number]], // Alabang
  },
  // Multi-stop routes
  {
    pickup: [121.0340, 14.5995] as [number, number], // Makati
    dropoffs: [
      [121.0550, 14.6091] as [number, number], // BGC
      [121.0650, 14.5850] as [number, number], // Ortigas
    ],
  },
];

export function useDeliveryPerformance(options: UseDeliveryPerformanceOptions = {}) {
  const {
    preloadCommonRoutes = true,
    preloadMapTiles = true,
    enablePerformanceLogging = false,
  } = options;

  // Performance logging
  const logPerformance = useCallback((message: string, data?: any) => {
    if (enablePerformanceLogging) {
      console.log(`🚀 Performance: ${message}`, data);
    }
  }, [enablePerformanceLogging]);

  // Preload common routes
  const preloadCommonRoutesData = useCallback(async () => {
    if (!preloadCommonRoutes) return;

    try {
      logPerformance('Starting route preloading', { routes: COMMON_ROUTES.length });
      
      // Preload routes with delay to not block initial page load
      setTimeout(() => {
        preloadRoutes(COMMON_ROUTES);
        logPerformance('Route preloading initiated');
      }, 2000); // Delay by 2 seconds
    } catch (error) {
      console.error('❌ Error preloading routes:', error);
    }
  }, [preloadCommonRoutes, logPerformance]);

  // Initialize performance optimizations
  useEffect(() => {
    const startTime = performance.now();
    
    // Preload common routes
    preloadCommonRoutesData();

    // Log initialization time
    const endTime = performance.now();
    logPerformance('Performance hook initialized', {
      duration: `${(endTime - startTime).toFixed(2)}ms`,
      cacheStats: routeCache.getStats(),
      mapCacheStats: mapStyleCache.getStats(),
    });

    // Cleanup on unmount
    return () => {
      logPerformance('Performance hook cleanup');
    };
  }, [preloadCommonRoutesData, logPerformance]);

  // Monitor memory usage
  useEffect(() => {
    if (!enablePerformanceLogging) return;

    const monitorMemory = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        logPerformance('Memory usage', {
          used: `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
          total: `${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
          limit: `${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`,
        });
      }
    };

    const interval = setInterval(monitorMemory, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [enablePerformanceLogging, logPerformance]);

  // Provide cache management functions
  const clearCaches = useCallback(() => {
    routeCache.clear();
    mapStyleCache.clear();
    logPerformance('All caches cleared');
  }, [logPerformance]);

  const getCacheStats = useCallback(() => {
    const stats = {
      routes: routeCache.getStats(),
      mapStyles: mapStyleCache.getStats(),
    };
    logPerformance('Cache statistics', stats);
    return stats;
  }, [logPerformance]);

  return {
    clearCaches,
    getCacheStats,
    logPerformance,
  };
}

/**
 * Network optimization utilities
 */
export function useNetworkOptimization() {
  const getNetworkInfo = useCallback(() => {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      return {
        effectiveType: connection.effectiveType, // '4g', '3g', '2g', 'slow-2g'
        downlink: connection.downlink, // Bandwidth estimate in Mbps
        rtt: connection.rtt, // Round-trip time estimate in ms
        saveData: connection.saveData, // User has data saver enabled
      };
    }
    return null;
  }, []);

  const isSlowConnection = useCallback(() => {
    const networkInfo = getNetworkInfo();
    if (!networkInfo) return false;

    return (
      networkInfo.effectiveType === 'slow-2g' ||
      networkInfo.effectiveType === '2g' ||
      networkInfo.downlink < 1 || // Less than 1 Mbps
      networkInfo.rtt > 1000 || // High latency
      networkInfo.saveData // User has data saver enabled
    );
  }, [getNetworkInfo]);

  const getOptimizedSettings = useCallback(() => {
    const isSlowNet = isSlowConnection();
    const networkInfo = getNetworkInfo();

    return {
      // Route calculation
      useSimplifiedRoutes: isSlowNet,
      enableRouteCaching: true,
      cacheTimeout: isSlowNet ? 30 * 60 * 1000 : 10 * 60 * 1000, // 30min vs 10min

      // Map rendering
      enableMapAnimations: !isSlowNet,
      mapQuality: isSlowNet ? 'low' : 'high',
      preloadTiles: !isSlowNet,

      // API requests
      debounceDelay: isSlowNet ? 500 : 300,
      maxConcurrentRequests: isSlowNet ? 2 : 5,

      // Network info
      networkInfo,
      isSlowConnection: isSlowNet,
    };
  }, [isSlowConnection, getNetworkInfo]);

  return {
    getNetworkInfo,
    isSlowConnection,
    getOptimizedSettings,
  };
}

/**
 * Initialize performance optimizations globally
 */
export function initializePerformanceOptimizations() {
  // Prefetch DNS for external services
  const prefetchDNS = [
    'https://api.mapbox.com',
    'https://maps.googleapis.com',
    'https://api.tiles.mapbox.com',
  ];

  prefetchDNS.forEach(domain => {
    const link = document.createElement('link');
    link.rel = 'dns-prefetch';
    link.href = domain;
    document.head.appendChild(link);
  });

  // Preconnect to critical services
  const preconnectServices = [
    'https://api.mapbox.com',
    'https://maps.googleapis.com',
  ];

  preconnectServices.forEach(service => {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = service;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  });

  console.log('🚀 Performance optimizations initialized');
}