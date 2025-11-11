/**
 * Mapbox Performance Optimization Utilities
 * Handles style caching and map optimization
 */

import mapboxgl from 'mapbox-gl';

// Style cache for Mapbox maps
interface CachedStyle {
  style: any;
  timestamp: number;
}

class MapStyleCache {
  private cache: Map<string, CachedStyle> = new Map();
  private readonly TTL = 30 * 60 * 1000; // 30 minutes

  get(styleUrl: string): any | null {
    const cached = this.cache.get(styleUrl);
    
    if (cached && Date.now() - cached.timestamp < this.TTL) {
      console.log('✅ Map style cache hit:', styleUrl);
      return cached.style;
    }
    
    if (cached) {
      this.cache.delete(styleUrl);
    }
    
    return null;
  }

  set(styleUrl: string, style: any): void {
    this.cache.set(styleUrl, {
      style,
      timestamp: Date.now(),
    });
    console.log('💾 Map style cached:', styleUrl);
  }

  clear(): void {
    this.cache.clear();
    console.log('🗑️ Map style cache cleared');
  }

  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Export singleton instance
export const mapStyleCache = new MapStyleCache();

/**
 * Optimized Mapbox map initialization options
 */
export const getOptimizedMapOptions = (container: HTMLElement, center: [number, number] = [121.0340, 14.5995]) => {
  return {
    container,
    style: 'mapbox://styles/swiftdash/cmgtdgxbe000e01st0atdhrex',
    center,
    zoom: 11,
    pitch: 45,
    bearing: 0,
    
    // Performance optimizations
    optimizeForTerrain: true,
    performanceMetricsCollection: false,
    fadeDuration: 0, // Disable fade animations
    antialias: true,
    
    // Reduce initial load
    interactive: true,
    doubleClickZoom: true,
    dragRotate: true,
    dragPan: true,
    keyboard: true,
    scrollZoom: true,
    touchZoomRotate: true,
    
    // Optimize for mobile
    touchPitch: false, // Disable pitch on mobile for better performance
    
    // Reduce resource usage
    preserveDrawingBuffer: false,
    refreshExpiredTiles: false,
    
    // Improve rendering
    crossSourceCollisions: false, // Improve label performance
  };
};

/**
 * Preload map tiles for common areas
 */
export const preloadMapTiles = (map: mapboxgl.Map, bounds: [[number, number], [number, number]]) => {
  if (!map.loaded()) {
    map.once('load', () => preloadMapTiles(map, bounds));
    return;
  }

  console.log('🗺️ Preloading map tiles for bounds:', bounds);
  
  // Preload tiles by temporarily zooming to the area
  const originalCenter = map.getCenter();
  const originalZoom = map.getZoom();
  
  // Calculate center of bounds
  const [sw, ne] = bounds;
  const centerLng = (sw[0] + ne[0]) / 2;
  const centerLat = (sw[1] + ne[1]) / 2;
  
  // Set to bounds area briefly to trigger tile loading
  map.jumpTo({
    center: [centerLng, centerLat],
    zoom: 12,
  });
  
  // Restore original view after a short delay
  setTimeout(() => {
    map.jumpTo({
      center: originalCenter,
      zoom: originalZoom,
    });
  }, 100);
};

/**
 * Metro Manila bounds for preloading common delivery areas
 */
export const METRO_MANILA_BOUNDS: [[number, number], [number, number]] = [
  [120.9, 14.4], // Southwest
  [121.2, 14.8], // Northeast
];

/**
 * Common delivery zones for preloading
 */
export const COMMON_DELIVERY_ZONES = [
  // Makati
  [[121.0180, 14.5547], [121.0500, 14.5774]] as [[number, number], [number, number]],
  // BGC
  [[121.0400, 14.6091], [121.0700, 14.6300]] as [[number, number], [number, number]],
  // Ortigas
  [[121.0580, 14.5820], [121.0780, 14.5950]] as [[number, number], [number, number]],
  // Alabang
  [[121.0200, 14.4100], [121.0600, 14.4400]] as [[number, number], [number, number]],
];

/**
 * Setup performance monitoring for maps
 */
export const setupMapPerformanceMonitoring = (map: mapboxgl.Map) => {
  let frameCount = 0;
  let lastTime = performance.now();
  
  const measureFPS = () => {
    frameCount++;
    const currentTime = performance.now();
    
    if (currentTime - lastTime >= 1000) { // Every second
      const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
      console.log(`🗺️ Map FPS: ${fps}`);
      
      frameCount = 0;
      lastTime = currentTime;
    }
    
    requestAnimationFrame(measureFPS);
  };
  
  map.once('load', () => {
    console.log('📊 Starting map performance monitoring');
    requestAnimationFrame(measureFPS);
  });
  
  // Monitor map events
  map.on('movestart', () => console.log('🗺️ Map move started'));
  map.on('moveend', () => console.log('🗺️ Map move ended'));
  map.on('zoomstart', () => console.log('🔍 Map zoom started'));
  map.on('zoomend', () => console.log('🔍 Map zoom ended'));
};

/**
 * Optimize map for mobile devices
 */
export const optimizeMapForMobile = () => {
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isLowEnd = navigator.hardwareConcurrency <= 2; // Assume low-end if 2 or fewer cores
  
  if (isMobile || isLowEnd) {
    console.log('📱 Optimizing map for mobile/low-end device');
    return {
      // Reduce quality for better performance
      fadeDuration: 0,
      pitch: 0, // Disable 3D for mobile
      antialias: false, // Disable antialiasing
      performanceMetricsCollection: false,
      touchPitch: false,
      
      // Reduce animations
      flyTo: { duration: 500 }, // Faster animations
      easeTo: { duration: 300 },
    };
  }
  
  return {};
};

/**
 * Clear all map-related caches
 */
export const clearAllMapCaches = () => {
  mapStyleCache.clear();
  console.log('🗑️ All map caches cleared');
};