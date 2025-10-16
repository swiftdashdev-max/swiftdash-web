-- Remove foreign key constraint for testing with mock users
-- Run this in your Supabase SQL Editor

-- Drop the foreign key constraint that's causing the issue
ALTER TABLE driver_verification_submissions 
DROP CONSTRAINT IF EXISTS driver_verification_submissions_user_id_fkey;

-- Also drop any other foreign key constraints that might cause issues
ALTER TABLE driver_verification_submissions 
DROP CONSTRAINT IF EXISTS fk_vehicle_type;