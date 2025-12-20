/**
 * Geocoding utilities for converting between addresses and coordinates
 */

// Debounce utility
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      func(...args);
      timeout = null;
    }, wait);
  };
}

/**
 * Reverse geocode coordinates to an address using Google Geocoding API
 * @param lat Latitude
 * @param lng Longitude
 * @returns Promise resolving to formatted address string
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<string> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      console.error('❌ Google Maps API key not configured');
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`; // Fallback to coordinates
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
    
    console.log('🔍 Reverse geocoding:', { lat, lng });
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const address = data.results[0].formatted_address;
      console.log('✅ Reverse geocoding successful:', address);
      return address;
    } else if (data.status === 'ZERO_RESULTS') {
      console.warn('⚠️ No address found for coordinates');
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    } else {
      console.error('❌ Geocoding API error:', data.status, data.error_message);
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  } catch (error) {
    console.error('❌ Reverse geocoding failed:', error);
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`; // Fallback to coordinates
  }
}

/**
 * Create a debounced version of reverse geocoding
 * Useful for drag events to prevent excessive API calls
 * @param callback Function to call with the resolved address
 * @param wait Debounce delay in milliseconds (default: 500ms)
 */
export function createDebouncedReverseGeocode(
  callback: (address: string, lat: number, lng: number) => void,
  wait: number = 500
) {
  const debouncedFetch = debounce(async (lat: number, lng: number) => {
    const address = await reverseGeocode(lat, lng);
    callback(address, lat, lng);
  }, wait);

  return debouncedFetch;
}

/**
 * Validate if coordinates are valid geographic coordinates
 */
export function isValidCoordinates(lat: number, lng: number): boolean {
  return (
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Check if coordinates are in water/ocean (basic check)
 * This is a simple heuristic - for production, you might want to use
 * a more sophisticated service
 */
export function likelyInWater(lat: number, lng: number): boolean {
  // Very basic check - coordinates far from land masses
  // This is just a simple heuristic, not comprehensive
  const majorOceanRegions = [
    // Pacific Ocean center
    { latMin: -20, latMax: 20, lngMin: -180, lngMax: -120 },
    { latMin: -20, latMax: 20, lngMin: 120, lngMax: 180 },
    // Atlantic Ocean center
    { latMin: -20, latMax: 20, lngMin: -50, lngMax: -10 },
    // Indian Ocean center
    { latMin: -30, latMax: 10, lngMin: 50, lngMax: 90 },
  ];

  return majorOceanRegions.some(
    (region) =>
      lat >= region.latMin &&
      lat <= region.latMax &&
      lng >= region.lngMin &&
      lng <= region.lngMax
  );
}
