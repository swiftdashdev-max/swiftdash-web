import Script from 'next/script';

const GOOGLE_MAPS_API_KEY = 'AIzaSyANfwae0FJo4S8AG74T72n9XoB95y60mQ8';

export function GoogleMapsLoader() {
  return (
    <>
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&callback=initGooglePlaces`}
        strategy="afterInteractive"
        onLoad={() => {
          // Initialize callback
          if (!window.initGooglePlaces) {
            window.initGooglePlaces = () => {
              console.log('✅ Google Maps Places API loaded successfully');
            };
          }
        }}
        onError={(e) => {
          console.error('❌ Failed to load Google Maps API:', e);
          console.error('Check: docs/GOOGLE_MAPS_API_KEY_FIX.md for configuration steps');
        }}
      />
    </>
  );
}
