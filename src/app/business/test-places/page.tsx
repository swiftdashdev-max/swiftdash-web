'use client';

import { useState } from 'react';
import { GoogleMapsLoader } from '@/components/google-maps-loader';
import { GooglePlacesAutocomplete } from '@/components/google-places-autocomplete';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

export default function TestPlacesPage() {
  const [pickup, setPickup] = useState({ address: '', lat: 0, lng: 0 });
  const [dropoff, setDropoff] = useState({ address: '', lat: 0, lng: 0 });

  return (
    <div className="container mx-auto p-8">
      <GoogleMapsLoader />
      
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Google Places Autocomplete Test</CardTitle>
          <CardDescription>Test the address search functionality</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Test Field 1 */}
          <div className="space-y-2">
            <Label htmlFor="test-pickup">Pickup Address</Label>
            <GooglePlacesAutocomplete
              id="test-pickup"
              value={pickup.address}
              onChange={(value) => setPickup({ ...pickup, address: value })}
              onPlaceSelected={(place) => {
                console.log('Pickup selected:', place);
                setPickup({ address: place.address, lat: place.lat, lng: place.lng });
              }}
              placeholder="Try typing: Makati, BGC, Mall of Asia..."
            />
            {pickup.lat !== 0 && (
              <p className="text-xs text-muted-foreground">
                Selected: {pickup.address} ({pickup.lat.toFixed(4)}, {pickup.lng.toFixed(4)})
              </p>
            )}
          </div>

          {/* Test Field 2 */}
          <div className="space-y-2">
            <Label htmlFor="test-dropoff">Dropoff Address</Label>
            <GooglePlacesAutocomplete
              id="test-dropoff"
              value={dropoff.address}
              onChange={(value) => setDropoff({ ...dropoff, address: value })}
              onPlaceSelected={(place) => {
                console.log('Dropoff selected:', place);
                setDropoff({ address: place.address, lat: place.lat, lng: place.lng });
              }}
              placeholder="Try typing: Quezon City, Pasig, Manila..."
            />
            {dropoff.lat !== 0 && (
              <p className="text-xs text-muted-foreground">
                Selected: {dropoff.address} ({dropoff.lat.toFixed(4)}, {dropoff.lng.toFixed(4)})
              </p>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-6 p-4 bg-muted rounded-lg space-y-2">
            <p className="font-semibold text-sm">Test Instructions:</p>
            <ol className="list-decimal list-inside text-sm space-y-1 text-muted-foreground">
              <li>Open browser DevTools (F12) → Console tab</li>
              <li>Type in the address fields above</li>
              <li>You should see suggestions appear after typing 2-3 characters</li>
              <li>Select a suggestion from the dropdown</li>
              <li>Check console for "Place selected:" message</li>
              <li>Coordinates should appear below each field</li>
            </ol>
          </div>

          {/* Debug Info */}
          <div className="mt-4 p-4 bg-blue-500/10 rounded-lg">
            <p className="font-semibold text-sm mb-2">Troubleshooting:</p>
            <ul className="list-disc list-inside text-xs space-y-1 text-muted-foreground">
              <li>If no suggestions appear: Check Google Cloud Console API key configuration</li>
              <li>If you see "Loading Google Maps..." forever: API key may be invalid</li>
              <li>If you get API errors in console: Check docs/GOOGLE_MAPS_API_KEY_FIX.md</li>
              <li>Make sure Maps JavaScript API and Places API are enabled</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
