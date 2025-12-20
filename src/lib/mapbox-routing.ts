/**
 * Enhanced Mapbox routing with traffic data, alternatives, and vehicle-specific profiles
 */

export interface RouteAlternative {
  geometry: any; // GeoJSON LineString
  distance: number; // meters
  duration: number; // seconds
  weight: number;
  legs: RouteLeg[];
  congestion?: string[]; // traffic data per segment
}

export interface RouteLeg {
  distance: number;
  duration: number;
  annotation?: {
    congestion?: string[]; // 'low', 'moderate', 'heavy', 'severe', 'unknown'
    distance?: number[];
    duration?: number[];
  };
}

export interface RoutingOptions {
  alternatives?: boolean; // Get up to 3 route alternatives
  annotations?: string[]; // e.g., ['congestion', 'distance', 'duration']
  profile?: 'driving-traffic' | 'driving' | 'cycling' | 'walking';
  exclude?: string[]; // e.g., ['toll', 'ferry', 'motorway']
  optimize?: boolean; // Optimize waypoint order
  overview?: 'full' | 'simplified' | 'false';
}

export interface RouteResponse {
  routes: RouteAlternative[];
  waypoints: any[];
  code: string;
}

/**
 * Fetch routes from Mapbox Directions API with enhanced options
 */
export async function fetchMapboxRoute(
  coordinates: [number, number][],
  accessToken: string,
  options: RoutingOptions = {}
): Promise<RouteResponse> {
  const {
    alternatives = false,
    annotations = ['congestion', 'distance', 'duration'],
    profile = 'driving-traffic',
    exclude = [],
    optimize = false,
    overview = 'full'
  } = options;

  // Build coordinates string
  const coordsString = coordinates.map(c => c.join(',')).join(';');

  // Build query parameters
  const params = new URLSearchParams({
    access_token: accessToken,
    geometries: 'geojson',
    overview: overview,
    steps: 'false',
    alternatives: alternatives ? 'true' : 'false',
    annotations: annotations.join(','),
  });

  if (exclude.length > 0) {
    params.append('exclude', exclude.join(','));
  }

  const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordsString}?${params}`;

  console.log('🗺️ Fetching Mapbox route:', { profile, alternatives, annotations, exclude });

  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Mapbox API error: ${response.status} ${response.statusText}`);
  }

  const data: RouteResponse = await response.json();

  console.log('✅ Routes fetched:', {
    count: data.routes?.length || 0,
    hasCongestion: data.routes?.[0]?.legs?.[0]?.annotation?.congestion ? true : false
  });

  return data;
}

/**
 * Map congestion level to color
 */
export function congestionToColor(level: string): string {
  switch (level) {
    case 'low':
      return '#06b6d4'; // cyan-500
    case 'moderate':
      return '#fbbf24'; // yellow-400
    case 'heavy':
      return '#f97316'; // orange-500
    case 'severe':
      return '#ef4444'; // red-500
    case 'unknown':
    default:
      return '#6b7280'; // gray-500
  }
}

/**
 * Create line-gradient expression for Mapbox from congestion data
 */
export function createCongestionGradient(
  congestionData: string[],
  distanceData: number[]
): any {
  if (!congestionData || congestionData.length === 0) {
    return '#3b82f6'; // Default blue if no data
  }

  console.log('🎨 Creating traffic gradient:', {
    segments: congestionData.length,
    congestionData,
    distanceData
  });

  // Calculate total distance
  const totalDistance = distanceData.reduce((sum, d) => sum + d, 0);

  if (totalDistance === 0) {
    return congestionToColor(congestionData[0]);
  }

  // Merge consecutive segments with same congestion level
  // This reduces the number of stops and prevents fragmentation
  const mergedSegments: Array<{ color: string; distance: number }> = [];
  
  congestionData.forEach((level, index) => {
    const color = congestionToColor(level);
    const distance = distanceData[index] || 0;
    
    const lastSegment = mergedSegments[mergedSegments.length - 1];
    
    if (lastSegment && lastSegment.color === color) {
      // Merge with previous segment if same color
      lastSegment.distance += distance;
    } else {
      // New color, add new segment
      mergedSegments.push({ color, distance });
    }
  });

  console.log('📊 Merged segments:', mergedSegments.length, 'from', congestionData.length);

  // Build interpolate expression with merged segments
  const gradientExpression: any[] = ['interpolate', ['linear'], ['line-progress']];
  const epsilon = 0.00001; // Very small value for sharp transitions
  
  let cumulativeDistance = 0;
  let lastStop = -1; // Track last stop to ensure strict ascending
  
  mergedSegments.forEach((segment, index) => {
    const startProgress = cumulativeDistance / totalDistance;
    cumulativeDistance += segment.distance;
    const endProgress = Math.min(cumulativeDistance / totalDistance, 1);
    
    if (index === 0) {
      // First segment starts at 0
      gradientExpression.push(0);
      gradientExpression.push(segment.color);
      lastStop = 0;
    }
    
    // Calculate end position for this segment
    let adjustedEnd = endProgress;
    
    if (index < mergedSegments.length - 1) {
      // Not the last segment - add epsilon for sharp transition
      adjustedEnd = Math.max(lastStop + epsilon, Math.min(endProgress - epsilon, 1));
    } else {
      // Last segment ends at exactly 1.0
      adjustedEnd = 1;
    }
    
    // Only add if strictly greater than last stop
    if (adjustedEnd > lastStop) {
      gradientExpression.push(adjustedEnd);
      gradientExpression.push(segment.color);
      lastStop = adjustedEnd;
    }
    
    // Add start of next segment (if not last)
    if (index < mergedSegments.length - 1 && endProgress < 1) {
      const nextStart = Math.max(lastStop + epsilon, Math.min(endProgress, 1));
      if (nextStart > lastStop && nextStart < 1) {
        gradientExpression.push(nextStart);
        gradientExpression.push(mergedSegments[index + 1].color);
        lastStop = nextStart;
      }
    }
  });

  console.log('✅ Gradient expression with', mergedSegments.length, 'color blocks');

  return gradientExpression;
}

/**
 * Build merged color segments with cumulative progress [start,end] along the line.
 * This is used for bulletproof multi-layer rendering without line-gradient.
 */
export function buildMergedColorSegments(
  congestionData: string[],
  distanceData: number[]
): Array<{ start: number; end: number; color: string }> {
  if (!congestionData || congestionData.length === 0 || !distanceData || distanceData.length === 0) {
    return [];
  }

  const totalDistance = distanceData.reduce((sum, d) => sum + (d || 0), 0);
  if (totalDistance <= 0) {
    return [
      { start: 0, end: 1, color: congestionToColor(congestionData[0] || 'low') }
    ];
  }

  // Merge adjacent segments with the same color to minimize layer count
  const mergedSegments: Array<{ color: string; distance: number }> = [];
  congestionData.forEach((level, idx) => {
    const color = congestionToColor(level);
    const dist = distanceData[idx] || 0;
    const last = mergedSegments[mergedSegments.length - 1];
    if (last && last.color === color) {
      last.distance += dist;
    } else {
      mergedSegments.push({ color, distance: dist });
    }
  });

  // Convert to cumulative progress ranges
  const ranges: Array<{ start: number; end: number; color: string }> = [];
  let cum = 0;
  mergedSegments.forEach(seg => {
    const start = cum / totalDistance;
    cum += seg.distance;
    const end = Math.min(cum / totalDistance, 1);
    ranges.push({ start, end, color: seg.color });
  });

  // Ensure strictly ascending and non-overlapping [start,end]
  const epsilon = 1e-6;
  for (let i = 0; i < ranges.length; i++) {
    const prevEnd = i > 0 ? ranges[i - 1].end : 0;
    if (ranges[i].start < prevEnd) {
      ranges[i].start = Math.min(1, prevEnd + epsilon);
    }
    if (ranges[i].end < ranges[i].start) {
      ranges[i].end = Math.min(1, ranges[i].start + epsilon);
    }
  }

  // Filter out zero-length ranges
  return ranges.filter(r => r.end > r.start);
}

/**
 * Get routing profile based on vehicle type
 */
export function getVehicleRoutingProfile(
  vehicleTypeName?: string
): 'driving-traffic' | 'driving' | 'cycling' | 'walking' {
  if (!vehicleTypeName) return 'driving-traffic';

  const name = vehicleTypeName.toLowerCase();

  if (name.includes('bike') || name.includes('bicycle')) {
    return 'cycling';
  }

  if (name.includes('motorcycle') || name.includes('scooter')) {
    return 'driving'; // Motorcycles use standard driving routes
  }

  // All other vehicles (car, van, truck, etc.) use traffic-aware routing
  return 'driving-traffic';
}

/**
 * Get route exclusions based on vehicle type
 */
export function getVehicleExclusions(vehicleTypeName?: string): string[] {
  if (!vehicleTypeName) return [];

  const name = vehicleTypeName.toLowerCase();

  if (name.includes('bicycle') || name.includes('bike')) {
    return ['motorway']; // Bicycles avoid highways
  }

  if (name.includes('truck')) {
    return ['toll']; // Trucks might want to avoid tolls for cost
  }

  return [];
}

/**
 * Format route duration for display
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes} min`;
}

/**
 * Format route distance for display
 */
export function formatDistance(meters: number): string {
  const km = meters / 1000;
  
  if (km < 1) {
    return `${Math.round(meters)} m`;
  }
  
  return `${km.toFixed(1)} km`;
}

/**
 * Calculate average traffic level for a route
 */
export function getAverageTrafficLevel(congestionData: string[]): string {
  if (!congestionData || congestionData.length === 0) return 'unknown';

  const weights = {
    low: 1,
    moderate: 2,
    heavy: 3,
    severe: 4,
    unknown: 2
  };

  const totalWeight = congestionData.reduce((sum, level) => {
    return sum + (weights[level as keyof typeof weights] || 2);
  }, 0);

  const avgWeight = totalWeight / congestionData.length;

  if (avgWeight < 1.5) return 'low';
  if (avgWeight < 2.5) return 'moderate';
  if (avgWeight < 3.5) return 'heavy';
  return 'severe';
}
