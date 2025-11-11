import Script from 'next/script';
import { useEffect, useState } from 'react';

const GOOGLE_MAPS_API_KEY = 'AIzaSyANfwae0FJo4S8AG74T72n9XoB95y60mQ8';

// Global cache for Google Maps API loading state
let isGoogleMapsLoaded = false;
let googleMapsPromise: Promise<void> | null = null;

// Create a global promise that resolves when Google Maps is ready
const createGoogleMapsPromise = () => {
  if (googleMapsPromise) return googleMapsPromise;
  
  googleMapsPromise = new Promise((resolve, reject) => {
    // Check if already loaded
    if (typeof google !== 'undefined' && google.maps && google.maps.places) {
      isGoogleMapsLoaded = true;
      resolve();
      return;
    }

    // Set up callback for when script loads
    (window as any).initGooglePlaces = () => {
      isGoogleMapsLoaded = true;
      console.log('✅ Google Maps Places API loaded successfully');
      resolve();
    };

    // Set up error handler
    (window as any).googleMapsError = () => {
      reject(new Error('Failed to load Google Maps API'));
    };
  });

  return googleMapsPromise;
};

export function GoogleMapsLoader() {
  useEffect(() => {
    // Create the promise when component mounts
    createGoogleMapsPromise();
  }, []);

  // Don't load script again if already loaded
  if (isGoogleMapsLoaded) {
    return null;
  }

  return (
    <>
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&callback=initGooglePlaces`}
        strategy="afterInteractive"
        onLoad={() => {
          // Initialize callback if not already set
          if (!window.initGooglePlaces) {
            window.initGooglePlaces = () => {
              isGoogleMapsLoaded = true;
              console.log('✅ Google Maps Places API loaded successfully');
            };
          }
        }}
        onError={(e) => {
          console.error('❌ Failed to load Google Maps API:', e);
          console.error('Check: docs/GOOGLE_MAPS_API_KEY_FIX.md for configuration steps');
          if ((window as any).googleMapsError) {
            (window as any).googleMapsError();
          }
        }}
      />
    </>
  );
}

// Hook to wait for Google Maps to be ready
export const useGoogleMaps = () => {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isGoogleMapsLoaded) {
      setIsReady(true);
      return;
    }

    createGoogleMapsPromise()
      .then(() => setIsReady(true))
      .catch((err) => setError(err.message));
  }, []);

  return { isReady, error };
};
