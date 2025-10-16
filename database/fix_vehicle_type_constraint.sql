-- Update vehicle_type_id column to UUID and add foreign key constraint
-- Run this in your Supabase SQL Editor

-- Change the vehicle_type_id column from TEXT to UUID
ALTER TABLE driver_verification_submissions 
ALTER COLUMN vehicle_type_id TYPE UUID USING vehicle_type_id::UUID;

-- Add foreign key constraint now that types match
ALTER TABLE driver_verification_submissions
ADD CONSTRAINT fk_vehicle_type 
FOREIGN KEY (vehicle_type_id) REFERENCES vehicle_types(id);