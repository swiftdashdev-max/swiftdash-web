-- Enable public read access for tracking deliveries by tracking number
-- This allows the shareable tracking link to work without authentication

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Public can view deliveries by tracking number" ON deliveries;
DROP POLICY IF EXISTS "Public can view delivery stops by tracking number" ON delivery_stops;
DROP POLICY IF EXISTS "Public can view business branding" ON business_accounts;
DROP POLICY IF EXISTS "Public can view driver profiles for tracking" ON driver_profiles;
DROP POLICY IF EXISTS "Public can view user profiles for tracking" ON user_profiles;

-- Allow public to read deliveries using tracking number
CREATE POLICY "Public can view deliveries by tracking number"
ON deliveries
FOR SELECT
TO public
USING (tracking_number IS NOT NULL);

-- Allow public to read delivery stops for multi-stop tracking
CREATE POLICY "Public can view delivery stops by tracking number"
ON delivery_stops
FOR SELECT
TO public
USING (true);

-- Allow public to read business branding for white-label tracking
CREATE POLICY "Public can view business branding"
ON business_accounts
FOR SELECT
TO public
USING (true);

-- Allow public to read driver profiles (limited info) for tracking
CREATE POLICY "Public can view driver profiles for tracking"
ON driver_profiles
FOR SELECT
TO public
USING (true);

-- Allow public to read user profiles (driver names) for tracking
CREATE POLICY "Public can view user profiles for tracking"
ON user_profiles
FOR SELECT
TO public
USING (true);

-- Note: These policies allow read-only access to enable tracking functionality
-- Write operations still require authentication through other policies
