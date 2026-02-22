-- Create public storage bucket for business logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'business-logos',
  'business-logos',
  true,
  2097152, -- 2MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own logo
CREATE POLICY "Businesses can upload their own logo"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'business-logos');

-- Allow authenticated users to update/replace their own logo
CREATE POLICY "Businesses can update their own logo"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'business-logos');

-- Allow anyone to view logos (needed for tracking page)
CREATE POLICY "Anyone can view business logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'business-logos');

-- Allow authenticated users to delete their own logo
CREATE POLICY "Businesses can delete their own logo"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'business-logos');
