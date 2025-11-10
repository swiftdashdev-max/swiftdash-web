-- Migration 010: Allow businesses to view their fleet drivers' user profiles
-- Purpose: Business users need to see user_profiles of their fleet drivers
-- Dependencies: 003_create_business_users.sql, 004_modify_existing_tables.sql

-- Drop and recreate the user_profiles SELECT policy to include fleet drivers
DROP POLICY IF EXISTS user_profiles_select_business ON user_profiles;

CREATE POLICY user_profiles_select_business ON user_profiles
  FOR SELECT
  USING (
    -- Can view users in same business
    business_id IN (
      SELECT business_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND status = 'active'
      AND business_id IS NOT NULL
    )
    OR
    -- Can view their fleet drivers' profiles
    (
      user_type = 'driver'
      AND id IN (
        SELECT id FROM driver_profiles
        WHERE managed_by_business_id IN (
          SELECT business_id FROM user_profiles
          WHERE id = auth.uid()
          AND user_type = 'business'
          AND status = 'active'
        )
      )
    )
  );

COMMENT ON POLICY user_profiles_select_business ON user_profiles IS 'Business users can view colleagues and their fleet drivers';
