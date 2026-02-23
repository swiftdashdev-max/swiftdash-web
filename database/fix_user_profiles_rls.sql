-- Fix user_profiles RLS: allow users to always read their own row.
-- The existing policy had a self-referential loop: to check if a user
-- belongs to a business it queried user_profiles WHERE id = auth.uid(),
-- which itself was blocked by RLS — causing CORS/network errors on the client.
-- Adding `id = auth.uid()` as the first condition breaks the loop.

DROP POLICY IF EXISTS user_profiles_select_business ON user_profiles;

CREATE POLICY user_profiles_select_business ON user_profiles
  FOR SELECT
  USING (
    -- Always allow a user to read their own row (breaks self-referential loop)
    id = auth.uid()
    OR
    -- Can view users in same business
    business_id IN (
      SELECT business_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND status = 'active'
      AND business_id IS NOT NULL
    )
    OR
    -- Business users can view their fleet drivers' profiles
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

COMMENT ON POLICY user_profiles_select_business ON user_profiles
  IS 'Users can read own row; business users can view colleagues and fleet drivers';
