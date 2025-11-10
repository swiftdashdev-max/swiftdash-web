-- Migration 004: Modify Existing Tables for Fleet Management
-- Purpose: Add business_id foreign keys and fleet tracking to existing tables
-- Performance: Indexed foreign keys for fast joins

-- ============================================
-- DELIVERIES TABLE MODIFICATIONS
-- ============================================

-- Add business context to deliveries
ALTER TABLE deliveries 
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES business_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fleet_vehicle_id UUID REFERENCES business_fleet(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assignment_type VARCHAR(20) DEFAULT 'auto' CHECK (assignment_type IN ('auto', 'manual'));

-- Comments
COMMENT ON COLUMN deliveries.business_id IS 'Which business created this delivery (NULL for consumer orders)';
COMMENT ON COLUMN deliveries.fleet_vehicle_id IS 'If assigned to business fleet vehicle';
COMMENT ON COLUMN deliveries.assignment_type IS 'How driver was assigned: auto (algorithm) or manual (dispatcher)';

-- Performance indexes for business queries
CREATE INDEX IF NOT EXISTS idx_deliveries_business 
  ON deliveries(business_id, status, created_at DESC)
  WHERE business_id IS NOT NULL;

-- Index for fleet vehicle tracking
CREATE INDEX IF NOT EXISTS idx_deliveries_fleet_vehicle 
  ON deliveries(fleet_vehicle_id, status)
  WHERE fleet_vehicle_id IS NOT NULL;

-- Index for assignment analytics
CREATE INDEX IF NOT EXISTS idx_deliveries_assignment_type 
  ON deliveries(business_id, assignment_type, created_at DESC)
  WHERE business_id IS NOT NULL;

-- ============================================
-- DRIVER_PROFILES TABLE MODIFICATIONS
-- ============================================

-- Add employment type and business association
ALTER TABLE driver_profiles
  ADD COLUMN IF NOT EXISTS employment_type VARCHAR(20) DEFAULT 'independent' CHECK (employment_type IN ('independent', 'fleet_driver')),
  ADD COLUMN IF NOT EXISTS managed_by_business_id UUID REFERENCES business_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS current_status VARCHAR(50) DEFAULT 'offline' CHECK (current_status IN ('online', 'offline', 'busy'));

-- Comments
COMMENT ON COLUMN driver_profiles.employment_type IS 'independent (public pool) or fleet_driver (employed by business)';
COMMENT ON COLUMN driver_profiles.managed_by_business_id IS 'Which business employs this driver (NULL for independent)';
COMMENT ON COLUMN driver_profiles.current_status IS 'online (available), offline (not working), busy (on delivery)';

-- Performance indexes for driver matching
CREATE INDEX IF NOT EXISTS idx_driver_employment 
  ON driver_profiles(employment_type, managed_by_business_id, current_status)
  WHERE current_status = 'online';

-- Index for business fleet driver lookup
CREATE INDEX IF NOT EXISTS idx_driver_business_fleet 
  ON driver_profiles(managed_by_business_id, current_status, vehicle_type_id)
  WHERE employment_type = 'fleet_driver' AND current_status = 'online';

-- Index for online status (replaces is_online boolean)
CREATE INDEX IF NOT EXISTS idx_driver_status 
  ON driver_profiles(current_status)
  WHERE current_status = 'online';

-- ============================================
-- UPDATE RLS POLICIES
-- ============================================

-- Deliveries: Allow business users to view their deliveries
DROP POLICY IF EXISTS deliveries_select_business ON deliveries;
CREATE POLICY deliveries_select_business ON deliveries
  FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND status = 'active'
      AND business_id IS NOT NULL
    )
  );

-- Deliveries: Allow business dispatchers to create deliveries
DROP POLICY IF EXISTS deliveries_insert_business ON deliveries;
CREATE POLICY deliveries_insert_business ON deliveries
  FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND business_role IN ('owner', 'admin', 'dispatcher')
      AND status = 'active'
    )
  );

-- Deliveries: Allow business users to update their deliveries
DROP POLICY IF EXISTS deliveries_update_business ON deliveries;
CREATE POLICY deliveries_update_business ON deliveries
  FOR UPDATE
  USING (
    business_id IN (
      SELECT business_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND business_role IN ('owner', 'admin', 'dispatcher')
      AND status = 'active'
    )
  );

-- Driver Profiles: Business admins can view their fleet drivers
DROP POLICY IF EXISTS driver_profiles_select_business ON driver_profiles;
CREATE POLICY driver_profiles_select_business ON driver_profiles
  FOR SELECT
  USING (
    managed_by_business_id IN (
      SELECT business_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND status = 'active'
    )
  );

-- Driver Profiles: Business admins can update their fleet drivers
DROP POLICY IF EXISTS driver_profiles_update_business ON driver_profiles;
CREATE POLICY driver_profiles_update_business ON driver_profiles
  FOR UPDATE
  USING (
    managed_by_business_id IN (
      SELECT business_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND business_role IN ('owner', 'admin')
      AND status = 'active'
    )
  );

-- ============================================
-- DATA MIGRATION HELPERS
-- ============================================

-- Function to migrate existing deliveries (if needed)
CREATE OR REPLACE FUNCTION migrate_delivery_to_business(
  p_delivery_id UUID,
  p_business_id UUID
)
RETURNS VOID AS $$
BEGIN
  UPDATE deliveries 
  SET business_id = p_business_id
  WHERE id = p_delivery_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to convert independent driver to fleet driver
CREATE OR REPLACE FUNCTION convert_driver_to_fleet(
  p_driver_id UUID,
  p_business_id UUID
)
RETURNS VOID AS $$
BEGIN
  UPDATE driver_profiles 
  SET 
    employment_type = 'fleet_driver',
    managed_by_business_id = p_business_id
  WHERE id = p_driver_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION migrate_delivery_to_business IS 'Admin function to assign existing delivery to business account';
COMMENT ON FUNCTION convert_driver_to_fleet IS 'Admin function to convert independent driver to fleet driver';
