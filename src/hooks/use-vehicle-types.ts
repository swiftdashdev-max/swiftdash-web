import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

// Vehicle type interface
interface VehicleType {
  id: string;
  name: string;
  base_price: number;
  price_per_km: number;
  max_weight_kg: number;
  description?: string;
  icon_emoji?: string;
}

// In-memory cache for vehicle types
let vehicleTypesCache: VehicleType[] | null = null;
let cacheTimestamp: number | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useVehicleTypes() {
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVehicleTypes = async () => {
      try {
        // Check if cache is valid
        const now = Date.now();
        if (vehicleTypesCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
          console.log('✅ Using cached vehicle types');
          setVehicleTypes(vehicleTypesCache);
          setLoading(false);
          return;
        }

        setLoading(true);
        setError(null);
        
        const supabase = createClient();
        const { data, error: fetchError } = await supabase
          .from('vehicle_types')
          .select('*')
          .order('name');

        if (fetchError) {
          throw new Error(`Failed to fetch vehicle types: ${fetchError.message}`);
        }

        console.log('✅ Vehicle types fetched and cached:', data);
        
        // Update cache
        vehicleTypesCache = data;
        cacheTimestamp = now;
        
        setVehicleTypes(data);
      } catch (err) {
        console.error('❌ Error fetching vehicle types:', err);
        setError(err instanceof Error ? err.message : 'Failed to load vehicle types');
      } finally {
        setLoading(false);
      }
    };

    fetchVehicleTypes();
  }, []);

  return { vehicleTypes, loading, error };
}

// Function to invalidate cache (call after updating vehicle types)
export function invalidateVehicleTypesCache() {
  vehicleTypesCache = null;
  cacheTimestamp = null;
}
