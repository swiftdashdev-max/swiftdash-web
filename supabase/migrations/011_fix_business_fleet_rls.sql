-- Migration 011: Fix Business Fleet RLS (Remove business_role dependency)
-- Purpose: Update RLS policies to work without business_role column
-- Dependencies: 003_create_business_users.sql

-- ============================================
-- FIX BUSINESS_ACCOUNTS POLICIES
-- ============================================

DROP POLICY IF EXISTS business_accounts_update_own ON business_accounts;

CREATE POLICY business_accounts_update_own ON business_accounts
  FOR UPDATE
  USING (
    id IN (
      SELECT business_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND user_type = 'business'
      AND status = 'active'
    )
  );

-- ============================================
-- FIX USER_PROFILES POLICIES
-- ============================================

DROP POLICY IF EXISTS user_profiles_update_business ON user_profiles;

CREATE POLICY user_profiles_update_business ON user_profiles
  FOR UPDATE
  USING (
    business_id IN (
      SELECT business_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND user_type = 'business'
      AND status = 'active'
    )
  );

-- ============================================
-- FIX BUSINESS_FLEET POLICIES
-- ============================================

-- Drop old policies
DROP POLICY IF EXISTS business_fleet_select_own ON business_fleet;
DROP POLICY IF EXISTS business_fleet_insert_own ON business_fleet;
DROP POLICY IF EXISTS business_fleet_update_own ON business_fleet;
DROP POLICY IF EXISTS business_fleet_delete_own ON business_fleet;

-- Business users can view their own fleet vehicles
CREATE POLICY business_fleet_select_own ON business_fleet
  FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND user_type = 'business'
      AND business_id IS NOT NULL
      AND status = 'active'
    )
  );

-- Business users can insert vehicles to their fleet
CREATE POLICY business_fleet_insert_own ON business_fleet
  FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND user_type = 'business'
      AND business_id IS NOT NULL
      AND status = 'active'
    )
  );

-- Business users can update their own fleet vehicles
CREATE POLICY business_fleet_update_own ON business_fleet
  FOR UPDATE
  USING (
    business_id IN (
      SELECT business_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND user_type = 'business'
      AND business_id IS NOT NULL
      AND status = 'active'
    )
  );

-- Business users can delete their own fleet vehicles
CREATE POLICY business_fleet_delete_own ON business_fleet
  FOR DELETE
  USING (
    business_id IN (
      SELECT business_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND user_type = 'business'
      AND business_id IS NOT NULL
      AND status = 'active'
    )
  );

COMMENT ON POLICY business_fleet_select_own ON business_fleet IS 'Business users can view their fleet vehicles';
COMMENT ON POLICY business_fleet_insert_own ON business_fleet IS 'Business users can add vehicles to their fleet';
COMMENT ON POLICY business_fleet_update_own ON business_fleet IS 'Business users can update their fleet vehicles';
COMMENT ON POLICY business_fleet_delete_own ON business_fleet IS 'Business users can delete their fleet vehicles';
