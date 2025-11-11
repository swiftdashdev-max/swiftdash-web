/**
 * Optimized Google Places Autocomplete Component
 * Uses caching and performance optimizations
 */

'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { useGoogleMaps } from '@/components/google-maps-loader';

interface Place {
  address: string;
  lat: number;
  lng: number;
  placeId?: string;
}

interface GooglePlacesAutocompleteProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected: (place: Place) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

// Cache for recent place predictions to reduce API calls
const placesCache = new Map<string, google.maps.places.AutocompletePrediction[]>();
const cacheExpiry = new Map<string, number>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Debounce function
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function GooglePlacesAutocomplete({
  id,
  value,
  onChange,
  onPlaceSelected,
  placeholder = 'Enter address...',
  className,
  disabled = false,
}: GooglePlacesAutocompleteProps) {
  const { isReady, error } = useGoogleMaps();
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Debounce search input to avoid excessive API calls
  const debouncedValue = useDebounce(value, 300);

  // Initialize Google Places services when ready
  useEffect(() => {
    if (!isReady || error) {
      console.log('⏳ Google Places not ready yet:', { isReady, error });
      return;
    }

    // Check if google.maps.places is available
    if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
      console.error('❌ Google Maps Places API not loaded!');
      return;
    }

    try {
      autocompleteService.current = new google.maps.places.AutocompleteService();
      
      // Create a minimal map for PlacesService (required by Google)
      const mapDiv = document.createElement('div');
      const map = new google.maps.Map(mapDiv, { zoom: 1, center: { lat: 0, lng: 0 } });
      placesService.current = new google.maps.places.PlacesService(map);
      
      console.log('✅ Google Places services initialized successfully');
    } catch (err) {
      console.error('❌ Failed to initialize Google Places services:', err);
    }
  }, [isReady, error]);

  // Clean up cache periodically
  useEffect(() => {
    const cleanup = () => {
      const now = Date.now();
      for (const [key, expiry] of cacheExpiry.entries()) {
        if (now > expiry) {
          placesCache.delete(key);
          cacheExpiry.delete(key);
        }
      }
    };

    const interval = setInterval(cleanup, 60000); // Cleanup every minute
    return () => clearInterval(interval);
  }, []);

  // Fetch place predictions
  const fetchPredictions = useCallback(async (input: string) => {
    if (!autocompleteService.current || !input.trim() || input.length < 3) {
      setPredictions([]);
      setShowDropdown(false);
      return;
    }

    // Check cache first
    const cacheKey = input.toLowerCase().trim();
    const cached = placesCache.get(cacheKey);
    const expiry = cacheExpiry.get(cacheKey);

    if (cached && expiry && Date.now() < expiry) {
      console.log('✅ Places cache hit for:', cacheKey);
      setPredictions(cached);
      setShowDropdown(true);
      return;
    }

    setIsLoading(true);

    try {
      const request: google.maps.places.AutocompletionRequest = {
        input: input.trim(),
        componentRestrictions: { country: 'ph' }, // Restrict to Philippines
        types: ['establishment', 'geocode'], // Include businesses and addresses
      };

      autocompleteService.current.getPlacePredictions(
        request,
        (predictions, status) => {
          setIsLoading(false);

          if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
            // Cache the results
            placesCache.set(cacheKey, predictions);
            cacheExpiry.set(cacheKey, Date.now() + CACHE_TTL);

            setPredictions(predictions);
            setShowDropdown(true);
            setSelectedIndex(-1);
            
            console.log('✅ Places predictions fetched:', predictions.length);
          } else {
            console.warn('⚠️ Places prediction failed:', status);
            setPredictions([]);
            setShowDropdown(false);
          }
        }
      );
    } catch (err) {
      console.error('❌ Places prediction error:', err);
      setIsLoading(false);
      setPredictions([]);
      setShowDropdown(false);
    }
  }, []);

  // Debounced search effect
  useEffect(() => {
    fetchPredictions(debouncedValue);
  }, [debouncedValue, fetchPredictions]);

  // Get place details when selected
  const handlePlaceSelect = useCallback(async (prediction: google.maps.places.AutocompletePrediction) => {
    if (!placesService.current) return;

    setIsLoading(true);
    setShowDropdown(false);

    try {
      const request = {
        placeId: prediction.place_id,
        fields: ['formatted_address', 'geometry.location', 'place_id'],
      };

      placesService.current.getDetails(request, (place, status) => {
        setIsLoading(false);

        if (status === google.maps.places.PlacesServiceStatus.OK && place) {
          const location = place.geometry?.location;
          
          if (location) {
            const selectedPlace: Place = {
              address: place.formatted_address || prediction.description,
              lat: location.lat(),
              lng: location.lng(),
              placeId: place.place_id,
            };

            onChange(selectedPlace.address);
            onPlaceSelected(selectedPlace);
            
            console.log('✅ Place selected:', selectedPlace);
          } else {
            console.warn('⚠️ No location found for place');
          }
        } else {
          console.error('❌ Place details fetch failed:', status);
        }
      });
    } catch (err) {
      console.error('❌ Place details error:', err);
      setIsLoading(false);
    }
  }, [onChange, onPlaceSelected]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showDropdown || predictions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < predictions.length - 1 ? prev + 1 : 0
        );
        break;
      
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : predictions.length - 1
        );
        break;
      
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < predictions.length) {
          handlePlaceSelect(predictions[selectedIndex]);
        }
        break;
      
      case 'Escape':
        setShowDropdown(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  }, [showDropdown, predictions, selectedIndex, handlePlaceSelect]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Loading state component
  if (!isReady) {
    return (
      <div className="relative">
        <Input
          ref={inputRef}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Loading Google Places..."
          className={className}
          disabled={true}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-muted border-t-primary rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  // Error state component
  if (error) {
    return (
      <Input
        ref={inputRef}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Google Places unavailable"
        className={className}
        disabled={disabled}
      />
    );
  }

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          if (e.target.value.length >= 3) {
            setShowDropdown(true);
          }
        }}
        onFocus={() => {
          if (value.length >= 3 && predictions.length > 0) {
            setShowDropdown(true);
          }
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
        autoComplete="off"
      />
      
      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-muted border-t-primary rounded-full animate-spin"></div>
        </div>
      )}

      {/* Predictions dropdown */}
      {showDropdown && predictions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-y-auto">
          {predictions.map((prediction, index) => (
            <button
              key={prediction.place_id}
              type="button"
              className={`w-full text-left px-4 py-3 hover:bg-muted transition-colors ${
                index === selectedIndex ? 'bg-muted' : ''
              }`}
              onClick={() => handlePlaceSelect(prediction)}
            >
              <div className="font-medium text-sm">{prediction.structured_formatting?.main_text}</div>
              <div className="text-xs text-muted-foreground truncate">
                {prediction.structured_formatting?.secondary_text}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}