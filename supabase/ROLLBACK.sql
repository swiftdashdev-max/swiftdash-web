-- ROLLBACK SCRIPT
-- Run this to remove migrations 001 and 002, then re-run them after 003

-- Drop migration 002 (business_fleet)
DROP TABLE IF EXISTS business_fleet CASCADE;

-- Drop migration 001 (business_accounts)
DROP TABLE IF EXISTS business_accounts CASCADE;

-- Drop the trigger function if no other tables use it
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;

-- Verify cleanup
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('business_accounts', 'business_fleet');
-- Should return 0 rows

COMMENT ON DATABASE postgres IS 'Rolled back migrations 001 and 002. Ready to run 003 → 001 → 002 → 004 → 005 → 006';
