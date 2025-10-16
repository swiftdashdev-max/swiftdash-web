import { createClient } from './client';

export interface VehicleType {
  id: string;
  name: string;
  description?: string;
  capacity?: string;
  base_rate?: number;
  per_km_rate?: number;
  created_at?: string;
  updated_at?: string;
}

// Get all vehicle types from the database
export const getVehicleTypes = async () => {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('vehicle_types')
      .select('*')
      .order('name');

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Error fetching vehicle types:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch vehicle types'
    };
  }
};

// Get a specific vehicle type by ID
export const getVehicleTypeById = async (id: string) => {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('vehicle_types')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error fetching vehicle type:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch vehicle type'
    };
  }
};

// Create a new vehicle type (admin function)
export const createVehicleType = async (vehicleType: Omit<VehicleType, 'id' | 'created_at' | 'updated_at'>) => {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('vehicle_types')
      .insert([vehicleType])
      .select('*')
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error creating vehicle type:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create vehicle type'
    };
  }
};

// Update vehicle type (admin function)
export const updateVehicleType = async (id: string, updates: Partial<VehicleType>) => {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('vehicle_types')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Error updating vehicle type:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update vehicle type'
    };
  }
};

// Delete vehicle type (admin function)
export const deleteVehicleType = async (id: string) => {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('vehicle_types')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error deleting vehicle type:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete vehicle type'
    };
  }
};