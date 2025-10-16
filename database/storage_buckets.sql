-- Storage buckets for driver verification system
-- Run these commands in your Supabase SQL Editor

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('license_pictures', 'license_pictures', true, 10485760, '{"image/jpeg","image/png","image/jpg","application/pdf"}'),
  ('OR_CR_pictures', 'OR_CR_pictures', true, 10485760, '{"image/jpeg","image/png","image/jpg","application/pdf"}'),
  ('vehicle_photos', 'vehicle_photos', true, 10485760, '{"image/jpeg","image/png","image/jpg"}'),
  ('LTFRB_pictures', 'LTFRB_pictures', true, 10485760, '{"image/jpeg","image/png","image/jpg","application/pdf"}'),
  ('driver_profile_pictures', 'driver_profile_pictures', true, 10485760, '{"image/jpeg","image/png","image/jpg"}')
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for storage buckets
-- Drop existing policies if they exist (ignore errors if they don't exist)
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Allow driver uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow driver updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow driver deletes" ON storage.objects;

-- Allow public read access to all buckets
CREATE POLICY "Public read access" ON storage.objects
FOR SELECT USING (true);

-- Allow anonymous uploads to driver verification buckets (since drivers aren't authenticated users)
CREATE POLICY "Allow driver uploads" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id IN ('license_pictures', 'OR_CR_pictures', 'vehicle_photos', 'LTFRB_pictures', 'driver_profile_pictures')
);

-- Allow anonymous updates to driver verification buckets
CREATE POLICY "Allow driver updates" ON storage.objects
FOR UPDATE USING (
  bucket_id IN ('license_pictures', 'OR_CR_pictures', 'vehicle_photos', 'LTFRB_pictures', 'driver_profile_pictures')
);

-- Allow anonymous deletes to driver verification buckets  
CREATE POLICY "Allow driver deletes" ON storage.objects
FOR DELETE USING (
  bucket_id IN ('license_pictures', 'OR_CR_pictures', 'vehicle_photos', 'LTFRB_pictures', 'driver_profile_pictures')
);