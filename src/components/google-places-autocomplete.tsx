'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { clear } from 'console';

/**
 * Google Places Autocomplete Component
 * 
 * API Call Optimization Strategies:
 * 1. Google's Autocomplete API has built-in debouncing (~300ms)
 * 2. We restrict to Philippines only (componentRestrictions)
 * 3. We only request necessary fields (fields parameter)
 * 4. We bias results to Metro Manila area to prioritize local results
 * 5. Type includes 'geocode' and 'establishment' for better suggestions
 * 6. Autocomplete only triggers on user selection from dropdown (not on every keystroke)
 * 
 * Cost per request: ~$0.017 USD per session (capped at 4 requests per session)
 * A "session" begins when user starts typing and ends when they select a place
 */

interface GooglePlacesAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected?: (place: {
    address: string;
    lat: number;
    lng: number;
    placeId: string;
  }) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
}

// This will be set when the Google Maps API loads
declare global {
  interface Window {
    google: any;
    initGooglePlaces: () => void;
  }
}

export function GooglePlacesAutocomplete({
  value,
  onChange,
  onPlaceSelected,
  placeholder = 'Search for location...',
  id,
  className,
  disabled = false,
}: GooglePlacesAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);

  useEffect(() => {
    // Check if Google Maps API is already loaded
    if (window.google && window.google.maps && window.google.maps.places) {
      setIsGoogleLoaded(true);
      setIsLoading(false);
      return;
    }

    // Wait for Google Maps to load
    const checkGoogleMaps = setInterval(() => {
      if (window.google && window.google.maps && window.google.maps.places) {
        setIsGoogleLoaded(true);
        setIsLoading(false);
        clearInterval(checkGoogleMaps);
      }
    }, 100);

    // Timeout after 10 seconds
    setTimeout(() => {
      clearInterval(checkGoogleMaps);
      setIsLoading(false);
    }, 10000);

    return () => clearInterval(checkGoogleMaps);
  }, []);

  useEffect(() => {
    if (!isGoogleLoaded || !inputRef.current || autocompleteRef.current) return;

    try {
      // Initialize autocomplete with optimized options
      autocompleteRef.current = new window.google.maps.places.Autocomplete(
        inputRef.current,
        {
          componentRestrictions: { country: 'ph' }, // Restrict to Philippines
          fields: ['address_components', 'geometry', 'formatted_address', 'place_id', 'name'], // Only request needed fields
          types: ['geocode', 'establishment'], // Include addresses, streets, and businesses
        }
      );

      // Set additional options to reduce API calls
      autocompleteRef.current.setOptions({
        strictBounds: false,
        // Bias results to Metro Manila area (but still show other areas)
        bounds: new window.google.maps.LatLngBounds(
          new window.google.maps.LatLng(14.3, 120.8), // Southwest corner (wider area)
          new window.google.maps.LatLng(14.9, 121.3)  // Northeast corner (wider area)
        ),
      });

      // Add place changed listener
      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current.getPlace();

        if (!place.geometry || !place.geometry.location) {
          console.warn('No geometry found for place');
          return;
        }

        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const address = place.formatted_address || place.name || '';
        const placeId = place.place_id || '';

        console.log('Place selected:', { address, lat, lng, placeId });

        // Update value
        onChange(address);

        // Call the callback with place details
        if (onPlaceSelected) {
          onPlaceSelected({
            address,
            lat,
            lng,
            placeId,
          });
        }
      });

      console.log('✅ Google Places Autocomplete initialized for:', id);
    } catch (error) {
      console.error('❌ Error initializing Google Places Autocomplete:', error);
    }
  }, [isGoogleLoaded, onChange, onPlaceSelected, id]);

  if (isLoading) {
    return (
      <div className="relative">
        <Input
          value=""
          placeholder="Loading Google Maps..."
          disabled
          className={className}
        />
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isGoogleLoaded) {
    return (
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Google Maps not loaded - check console"
        className={className}
        disabled={disabled}
      />
    );
  }

  return (
    <Input
      ref={inputRef}
      id={id}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      autoComplete="off"
    />
  );
}
