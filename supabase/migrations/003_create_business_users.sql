-- Migration 003: Modify User Profiles for Business Multi-User Access
-- Purpose: Add business association and roles to existing user_profiles table
-- Performance: Fast auth lookups and permission checks

-- Add business-related columns to existing user_profiles table
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES business_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS business_role VARCHAR(50) DEFAULT NULL CHECK (business_role IN ('owner', 'admin', 'dispatcher', 'viewer', NULL));

-- Comments
COMMENT ON COLUMN user_profiles.business_id IS 'Which business this user belongs to (NULL for customers/drivers)';
COMMENT ON COLUMN user_profiles.business_role IS 'Role within business: owner > admin > dispatcher > viewer';

-- Performance Indexes
-- Auth lookup: Most common query for business users
CREATE INDEX IF NOT EXISTS idx_user_profiles_business 
  ON user_profiles(business_id, user_type, status)
  WHERE business_id IS NOT NULL AND status = 'active';

-- Business user lookup
CREATE INDEX IF NOT EXISTS idx_user_profiles_business_role 
  ON user_profiles(business_id, business_role, status)
  WHERE business_role IS NOT NULL;

-- Update RLS policies for business users
-- Note: Assuming RLS is already enabled on user_profiles

-- Policy: Business users can view colleagues in same business
DROP POLICY IF EXISTS user_profiles_select_business ON user_profiles;
CREATE POLICY user_profiles_select_business ON user_profiles
  FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND status = 'active'
      AND business_id IS NOT NULL
    )
  );

-- Policy: Business owners/admins can update team members
DROP POLICY IF EXISTS user_profiles_update_business ON user_profiles;
CREATE POLICY user_profiles_update_business ON user_profiles
  FOR UPDATE
  USING (
    business_id IN (
      SELECT business_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND business_role IN ('owner', 'admin')
      AND status = 'active'
    )
    AND business_role != 'owner' -- Can't modify owners
  );

-- ============================================
-- ADD RLS POLICIES TO BUSINESS_ACCOUNTS
-- ============================================

-- Now that business_id exists in user_profiles, add proper RLS policies

-- Policy: Business owners can view their own account
DROP POLICY IF EXISTS business_accounts_select_own ON business_accounts;
CREATE POLICY business_accounts_select_own ON business_accounts
  FOR SELECT
  USING (
    id IN (
      SELECT business_id FROM user_profiles 
      WHERE id = auth.uid()
    )
  );

-- Policy: Business owners/admins can update their account
DROP POLICY IF EXISTS business_accounts_update_own ON business_accounts;
CREATE POLICY business_accounts_update_own ON business_accounts
  FOR UPDATE
  USING (
    id IN (
      SELECT business_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND business_role IN ('owner', 'admin')
    )
  );

-- ============================================
-- ADD RLS POLICIES TO BUSINESS_FLEET
-- ============================================

-- Policy: Business users can view their own fleet
DROP POLICY IF EXISTS business_fleet_select_own ON business_fleet;
CREATE POLICY business_fleet_select_own ON business_fleet
  FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND business_id IS NOT NULL
    )
  );

-- Policy: Business owners/admins can insert vehicles
DROP POLICY IF EXISTS business_fleet_insert_own ON business_fleet;
CREATE POLICY business_fleet_insert_own ON business_fleet
  FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND business_role IN ('owner', 'admin')
    )
  );

-- Policy: Business users can update their vehicles
DROP POLICY IF EXISTS business_fleet_update_own ON business_fleet;
CREATE POLICY business_fleet_update_own ON business_fleet
  FOR UPDATE
  USING (
    business_id IN (
      SELECT business_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND business_role IN ('owner', 'admin', 'dispatcher')
    )
  );

-- Policy: Business owners/admins can delete vehicles
DROP POLICY IF EXISTS business_fleet_delete_own ON business_fleet;
CREATE POLICY business_fleet_delete_own ON business_fleet
  FOR DELETE
  USING (
    business_id IN (
      SELECT business_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND business_role IN ('owner', 'admin')
    )
  );

-- Policy: Public vehicles visible for matching
DROP POLICY IF EXISTS business_fleet_public_pool ON business_fleet;
CREATE POLICY business_fleet_public_pool ON business_fleet
  FOR SELECT
  USING (
    auth.role() = 'service_role' 
    OR (access_mode = 'public' AND current_status = 'idle')
  );

COMMENT ON COLUMN user_profiles.user_type IS 'User type: customer, driver, admin, business, crm';

