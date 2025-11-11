/**
 * Route Caching Utility
 * Caches Mapbox Directions API responses to avoid duplicate requests
 */

import mapboxgl from 'mapbox-gl';

interface CachedRoute {
  route: any;
  timestamp: number;
  expiresAt: number;
}

interface RouteCache {
  [key: string]: CachedRoute;
}

// In-memory cache with TTL (Time To Live)
class RouteCacheManager {
  private cache: RouteCache = {};
  private defaultTTL = 10 * 60 * 1000; // 10 minutes in milliseconds
  private maxCacheSize = 100; // Maximum number of cached routes

  // Generate cache key from coordinates
  private generateKey(coordinates: number[][]): string {
    return coordinates
      .map(coord => `${coord[0].toFixed(4)},${coord[1].toFixed(4)}`)
      .join('|');
  }

  // Check if cached route is still valid
  private isValid(cached: CachedRoute): boolean {
    return Date.now() < cached.expiresAt;
  }

  // Clean expired entries
  private cleanup(): void {
    const now = Date.now();
    Object.keys(this.cache).forEach(key => {
      if (this.cache[key].expiresAt < now) {
        delete this.cache[key];
      }
    });
  }

  // Get cached route if available and valid
  get(coordinates: number[][]): any | null {
    this.cleanup();
    const key = this.generateKey(coordinates);
    const cached = this.cache[key];

    if (cached && this.isValid(cached)) {
      console.log('✅ Route cache hit:', key.substring(0, 50) + '...');
      return cached.route;
    }

    console.log('❌ Route cache miss:', key.substring(0, 50) + '...');
    return null;
  }

  // Store route in cache
  set(coordinates: number[][], route: any, ttl?: number): void {
    this.cleanup();

    // Limit cache size to prevent memory issues
    if (Object.keys(this.cache).length >= this.maxCacheSize) {
      // Remove oldest entries
      const entries = Object.entries(this.cache)
        .sort(([, a], [, b]) => a.timestamp - b.timestamp);
      
      const toRemove = Math.floor(this.maxCacheSize * 0.2); // Remove 20% of cache
      for (let i = 0; i < toRemove; i++) {
        delete this.cache[entries[i][0]];
      }
    }

    const key = this.generateKey(coordinates);
    const now = Date.now();
    const expiresAt = now + (ttl || this.defaultTTL);

    this.cache[key] = {
      route,
      timestamp: now,
      expiresAt,
    };

    console.log('💾 Route cached:', {
      key: key.substring(0, 50) + '...',
      cacheSize: Object.keys(this.cache).length,
      expiresIn: `${Math.round((expiresAt - now) / 60000)}min`,
    });
  }

  // Clear all cached routes
  clear(): void {
    this.cache = {};
    console.log('🗑️ Route cache cleared');
  }

  // Get cache statistics
  getStats(): { size: number; keys: string[] } {
    this.cleanup();
    return {
      size: Object.keys(this.cache).length,
      keys: Object.keys(this.cache).map(key => key.substring(0, 50) + '...'),
    };
  }
}

// Export singleton instance
export const routeCache = new RouteCacheManager();

/**
 * Cached route fetcher for Mapbox Directions API
 */
export async function fetchCachedRoute(
  coordinates: number[][],
  accessToken: string,
  options: {
    optimize?: boolean;
    profile?: 'driving' | 'walking' | 'cycling';
    geometries?: 'geojson' | 'polyline' | 'polyline6';
    overview?: 'full' | 'simplified' | 'false';
  } = {}
): Promise<any> {
  // Check cache first
  const cachedRoute = routeCache.get(coordinates);
  if (cachedRoute) {
    return cachedRoute;
  }

  // Set defaults
  const {
    optimize = coordinates.length > 2,
    profile = 'driving',
    geometries = 'geojson',
    overview = 'full',
  } = options;

  // Build coordinates string
  const coordinatesString = coordinates
    .map(coord => `${coord[0]},${coord[1]}`)
    .join(';');

  // Build URL with optimizations
  const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinatesString}?` +
    `geometries=${geometries}` +
    `&overview=${overview}` +
    `&steps=false` + // Disable detailed steps for faster response
    `&annotations=distance,duration` +
    (optimize ? `&waypoints_per_route=true` : '') +
    `&access_token=${accessToken}`;

  console.log('🚗 Fetching route from Mapbox API...', {
    coordinates: coordinates.length,
    optimize,
    profile,
  });

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Mapbox API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.routes || data.routes.length === 0) {
      throw new Error('No routes found in response');
    }

    // Cache the response (cache for 10 minutes for routes, 30 minutes for single routes)
    const ttl = coordinates.length > 2 ? 10 * 60 * 1000 : 30 * 60 * 1000;
    routeCache.set(coordinates, data, ttl);

    console.log('✅ Route fetched and cached:', {
      distance: `${(data.routes[0].distance / 1000).toFixed(2)} km`,
      duration: `${Math.round(data.routes[0].duration / 60)} min`,
    });

    return data;
  } catch (error) {
    console.error('❌ Route fetch error:', error);
    throw error;
  }
}

/**
 * Preload common routes (optional - can be called on app startup)
 */
export function preloadRoutes(commonRoutes: { pickup: [number, number]; dropoffs: [number, number][] }[]): void {
  // This could be used to preload frequently used routes
  console.log('🔄 Preloading common routes...', commonRoutes.length);
  
  commonRoutes.forEach(async ({ pickup, dropoffs }) => {
    const coordinates = [pickup, ...dropoffs];
    try {
      await fetchCachedRoute(coordinates, mapboxgl.accessToken || '');
    } catch (error) {
      console.warn('⚠️ Failed to preload route:', error);
    }
  });
}