-- Add missing vehicle_type_id column to driver_verification_submissions table
-- Run this in your Supabase SQL Editor

-- First, let's check the vehicle_types table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'vehicle_types' 
AND column_name = 'id';

-- Add the vehicle_type_id column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'driver_verification_submissions' 
        AND column_name = 'vehicle_type_id'
    ) THEN
        -- Add column as TEXT first (we'll determine the correct type)
        ALTER TABLE driver_verification_submissions 
        ADD COLUMN vehicle_type_id TEXT;
        
        -- Add index for performance
        CREATE INDEX IF NOT EXISTS idx_driver_verification_vehicle_type 
        ON driver_verification_submissions(vehicle_type_id);
        
    END IF;
END $$;