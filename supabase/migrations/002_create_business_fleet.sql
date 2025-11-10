-- Migration 002: Create Business Fleet Table
-- Purpose: Store business-owned vehicles with public/private access modes
-- Performance: Spatial indexes for location queries, composite indexes for status filtering

-- Create business_fleet table
CREATE TABLE IF NOT EXISTS business_fleet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Business Association
  business_id UUID NOT NULL REFERENCES business_accounts(id) ON DELETE CASCADE,
  
  -- Vehicle Information
  vehicle_type_id UUID NOT NULL REFERENCES vehicle_types(id),
  plate_number VARCHAR(50) NOT NULL,
  vehicle_make VARCHAR(100),
  vehicle_model VARCHAR(100),
  vehicle_year INT,
  vehicle_color VARCHAR(50),
  
  -- Driver Assignment
  assigned_driver_id UUID REFERENCES driver_profiles(id) ON DELETE SET NULL,
  
  -- Access Control
  access_mode VARCHAR(20) DEFAULT 'private' CHECK (access_mode IN ('private', 'public')),
  -- private: Only for business's own deliveries
  -- public: Available in global driver pool when idle
  
  -- Status & Location
  current_status VARCHAR(50) DEFAULT 'idle' CHECK (current_status IN ('idle', 'busy', 'offline', 'maintenance')),
  current_latitude NUMERIC(10, 8),
  current_longitude NUMERIC(11, 8),
  last_location_update TIMESTAMPTZ,
  
  -- Performance Metrics
  total_deliveries INT DEFAULT 0,
  total_distance_km DECIMAL(10, 2) DEFAULT 0,
  average_rating DECIMAL(3, 2),
  
  -- Vehicle Documents
  registration_expiry DATE,
  insurance_expiry DATE,
  documents JSONB DEFAULT '{}'::jsonb, -- URLs to uploaded docs
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(business_id, plate_number) -- Same business can't register same plate twice
);

-- Performance Indexes
-- Most common query: Find available vehicles for a business
CREATE INDEX idx_business_fleet_lookup 
  ON business_fleet(business_id, current_status, vehicle_type_id)
  WHERE current_status = 'idle';

-- Location lookup: Index both lat/lng for proximity queries
CREATE INDEX idx_business_fleet_latitude 
  ON business_fleet(current_latitude)
  WHERE current_status = 'idle' AND current_latitude IS NOT NULL;

CREATE INDEX idx_business_fleet_longitude 
  ON business_fleet(current_longitude)
  WHERE current_status = 'idle' AND current_longitude IS NOT NULL;

-- Public pool query: Find public vehicles when business fleet is busy
CREATE INDEX idx_business_fleet_public 
  ON business_fleet(access_mode, current_status, vehicle_type_id)
  WHERE access_mode = 'public' AND current_status = 'idle';

-- Driver assignment lookups
CREATE INDEX idx_business_fleet_driver 
  ON business_fleet(assigned_driver_id)
  WHERE assigned_driver_id IS NOT NULL;

-- Business dashboard queries
CREATE INDEX idx_business_fleet_status 
  ON business_fleet(business_id, current_status);

-- Document expiry monitoring
CREATE INDEX idx_business_fleet_expiry 
  ON business_fleet(business_id, registration_expiry)
  WHERE registration_expiry IS NOT NULL;

-- Updated timestamp trigger
CREATE TRIGGER update_business_fleet_updated_at
  BEFORE UPDATE ON business_fleet
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE business_fleet ENABLE ROW LEVEL SECURITY;

-- Policy: Service role has full access (for now, refined in migration 003)
CREATE POLICY business_fleet_service_role ON business_fleet
  FOR ALL
  USING (auth.role() = 'service_role');

-- Note: Business user policies will be added in migration 003
-- after user_profiles.business_id and business_role columns are created

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON business_fleet TO authenticated;
GRANT ALL ON business_fleet TO service_role;

-- Comments for documentation
COMMENT ON TABLE business_fleet IS 'Business-owned vehicles with public/private access control';
COMMENT ON COLUMN business_fleet.access_mode IS 'private = business only, public = available to global pool when idle';
COMMENT ON COLUMN business_fleet.current_status IS 'idle = available, busy = on delivery, offline = not working, maintenance = in shop';
COMMENT ON COLUMN business_fleet.documents IS 'JSON: {or_cr: "url", insurance: "url", inspection: "url"}';
