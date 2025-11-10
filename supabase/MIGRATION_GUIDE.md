# Fleet Management Migration Guide

## Overview

This guide walks through the **Incremental Migration** approach for adding fleet management to SwiftDash. Each migration builds on the previous one and can be tested independently.

## Prerequisites

- Supabase project with existing schema (vehicle_types, driver_profiles, deliveries)
- Supabase CLI installed: `npm install -g supabase`
- Database access via Supabase Studio or psql

## Migration Phases

### Phase 1: Business Accounts (001)
**File:** `001_create_business_accounts.sql`  
**Duration:** ~2 minutes  
**Purpose:** Core table for enterprise customers

#### What It Does:
- Creates `business_accounts` table with subscription tiers
- Adds indexes for email and status lookups
- Sets up RLS policies for multi-tenant isolation
- Creates updated_at trigger

#### Testing:
```sql
-- Insert test business
INSERT INTO business_accounts (
  business_name, 
  business_email, 
  subscription_tier
) VALUES (
  'Test Logistics Inc',
  'test@logistics.com',
  'professional'
);

-- Verify creation
SELECT * FROM business_accounts;

-- Check indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'business_accounts';
```

#### Rollback:
```sql
DROP TABLE IF EXISTS business_accounts CASCADE;
```

---

### Phase 2: Business Fleet (002)
**File:** `002_create_business_fleet.sql`  
**Duration:** ~3 minutes  
**Purpose:** Vehicle inventory with public/private access modes

#### What It Does:
- Creates `business_fleet` table with geospatial support
- Adds composite indexes for fast driver matching
- Spatial index (GIST) for location queries
- RLS policies for fleet isolation

#### Key Indexes:
- `idx_business_fleet_lookup` - Business + status + vehicle type
- `idx_business_fleet_location` - Spatial queries (GIST)
- `idx_business_fleet_public` - Public pool queries

#### Testing:
```sql
-- Get a business_id and vehicle_type_id first
SELECT id FROM business_accounts LIMIT 1;
SELECT id FROM vehicle_types WHERE name = 'Motorcycle' LIMIT 1;

-- Insert test vehicle
INSERT INTO business_fleet (
  business_id,
  vehicle_type_id,
  plate_number,
  access_mode,
  current_status,
  current_location
) VALUES (
  '< business_id >',
  < vehicle_type_id >,
  'ABC-1234',
  'private',
  'idle',
  ST_SetSRID(ST_MakePoint(121.0244, 14.5547), 4326)::geography -- Makati
);

-- Test spatial query
SELECT 
  plate_number,
  current_status,
  ST_AsText(current_location::geometry) as location
FROM business_fleet;

-- Verify indexes
EXPLAIN ANALYZE
SELECT * FROM business_fleet 
WHERE business_id = '< business_id >' 
AND current_status = 'idle';
```

#### Performance Check:
```sql
-- Should use idx_business_fleet_lookup
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM business_fleet
WHERE business_id = '< your_business_id >'
AND current_status = 'idle'
AND vehicle_type_id = 1;

-- Look for "Index Scan using idx_business_fleet_lookup"
```

#### Rollback:
```sql
DROP TABLE IF EXISTS business_fleet CASCADE;
```

---

### Phase 3: Business Users (003)
**File:** `003_create_business_users.sql`  
**Duration:** ~2 minutes  
**Purpose:** Multi-user access control (owner, admin, dispatcher, viewer)

#### What It Does:
- Creates `business_users` table with role-based access
- Links Supabase Auth users to business accounts
- Hierarchical permissions (owner > admin > dispatcher > viewer)
- RLS policies for team management

#### Testing:
```sql
-- You need a real auth.users.id for this test
-- Get one from Supabase Auth dashboard or create test user

-- Insert business owner
INSERT INTO business_users (
  user_id,
  business_id,
  full_name,
  email,
  role
) VALUES (
  '< auth_user_id >',
  '< business_id >',
  'John Doe',
  'john@logistics.com',
  'owner'
);

-- Insert dispatcher
INSERT INTO business_users (
  user_id,
  business_id,
  full_name,
  email,
  role,
  invited_by
) VALUES (
  '< another_auth_user_id >',
  '< same_business_id >',
  'Jane Smith',
  'jane@logistics.com',
  'dispatcher',
  (SELECT id FROM business_users WHERE role = 'owner' LIMIT 1)
);

-- Verify team
SELECT full_name, email, role, status 
FROM business_users 
WHERE business_id = '< business_id >';
```

#### Rollback:
```sql
DROP TABLE IF EXISTS business_users CASCADE;
```

---

### Phase 4: Modify Existing Tables (004)
**File:** `004_modify_existing_tables.sql`  
**Duration:** ~3 minutes  
**Purpose:** Add business_id to deliveries and driver_profiles

#### What It Does:
- Adds `business_id`, `fleet_vehicle_id`, `assignment_type` to deliveries
- Adds `employment_type`, `managed_by_business_id` to driver_profiles
- Creates indexes for business queries
- Updates RLS policies

#### Testing:
```sql
-- Check new columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'deliveries' 
AND column_name IN ('business_id', 'fleet_vehicle_id', 'assignment_type');

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'driver_profiles' 
AND column_name IN ('employment_type', 'managed_by_business_id');

-- Test delivery with business context
INSERT INTO deliveries (
  business_id,
  pickup_location,
  dropoff_location,
  package_type,
  payment_method,
  assignment_type
) VALUES (
  '< business_id >',
  ST_SetSRID(ST_MakePoint(121.0244, 14.5547), 4326)::geography,
  ST_SetSRID(ST_MakePoint(121.0344, 14.5647), 4326)::geography,
  'Documents',
  'cash',
  'manual'
);

-- Test driver conversion
UPDATE driver_profiles 
SET 
  employment_type = 'fleet_driver',
  managed_by_business_id = '< business_id >'
WHERE id = '< test_driver_id >';
```

#### Performance Check:
```sql
-- Should use idx_deliveries_business
EXPLAIN ANALYZE
SELECT * FROM deliveries 
WHERE business_id = '< business_id >' 
AND status = 'pending'
ORDER BY created_at DESC;
```

#### Rollback:
```sql
ALTER TABLE deliveries 
  DROP COLUMN IF EXISTS business_id,
  DROP COLUMN IF EXISTS fleet_vehicle_id,
  DROP COLUMN IF EXISTS assignment_type;

ALTER TABLE driver_profiles
  DROP COLUMN IF EXISTS employment_type,
  DROP COLUMN IF EXISTS managed_by_business_id;
```

---

### Phase 5: Matching Functions (005)
**File:** `005_create_matching_functions.sql`  
**Duration:** ~2 minutes  
**Purpose:** Smart driver assignment algorithms

#### What It Does:
- `find_business_fleet_driver()` - Search business's own fleet
- `find_public_pool_driver()` - Search public pool (other fleets + independent)
- `get_business_fleet_stats()` - Dashboard statistics
- `update_vehicle_status()` - Status management

#### Testing:
```sql
-- Test business fleet search (private vehicles)
SELECT * FROM find_business_fleet_driver(
  '< business_id >',
  14.5547, -- pickup latitude (Makati)
  121.0244, -- pickup longitude
  1, -- vehicle_type_id (e.g., motorcycle)
  10, -- max distance in km
  'private' -- access mode
);

-- Test public pool search
SELECT * FROM find_public_pool_driver(
  '< business_id >',
  14.5547,
  121.0244,
  1,
  15, -- slightly larger radius
  true -- include other business fleets
);

-- Test fleet statistics
SELECT * FROM get_business_fleet_stats('< business_id >');

-- Test status update
SELECT update_vehicle_status(
  '< vehicle_id >',
  'busy',
  14.5547,
  121.0244
);
```

#### Performance Check:
```sql
-- Should complete in < 50ms
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM find_business_fleet_driver(
  '< business_id >',
  14.5547,
  121.0244,
  1,
  10,
  'private'
);

-- Look for:
-- - Index Scan on business_fleet
-- - Index Scan on driver_profiles
-- - Execution time < 50ms
```

#### Rollback:
```sql
DROP FUNCTION IF EXISTS find_business_fleet_driver;
DROP FUNCTION IF EXISTS find_public_pool_driver;
DROP FUNCTION IF EXISTS get_business_fleet_stats;
DROP FUNCTION IF EXISTS update_vehicle_status;
```

---

### Phase 6: Audit Logs (006)
**File:** `006_create_audit_logs.sql`  
**Duration:** ~2 minutes  
**Purpose:** Track fleet operations and administrative actions

#### What It Does:
- Creates `fleet_audit_logs` table
- Helper function `log_fleet_action()`
- Indexes for efficient log queries
- RLS for business isolation

#### Testing:
```sql
-- Test logging
SELECT log_fleet_action(
  '< business_id >',
  '< user_id >',
  'vehicle_created',
  'vehicle',
  '< vehicle_id >',
  'Added new motorcycle to fleet',
  NULL,
  '{"plate_number": "ABC-1234", "vehicle_type": "motorcycle"}'::jsonb
);

-- View logs
SELECT 
  action_type,
  entity_type,
  description,
  new_values,
  created_at
FROM fleet_audit_logs
WHERE business_id = '< business_id >'
ORDER BY created_at DESC;
```

#### Rollback:
```sql
DROP FUNCTION IF EXISTS log_fleet_action;
DROP TABLE IF EXISTS fleet_audit_logs CASCADE;
```

---

## Complete Migration Execution

### Option A: Supabase Studio (Recommended for beginners)

1. Go to Supabase Dashboard → SQL Editor
2. Run each migration file in order (001 → 006)
3. Wait for "Success" confirmation after each
4. Test using the SQL snippets above

### Option B: Supabase CLI

```powershell
# Navigate to project
cd e:\SD-Admin\swiftdash-admin

# Link to Supabase project (if not linked)
supabase link --project-ref <your-project-ref>

# Run migrations in order
supabase db push

# Or run individually
supabase db execute --file supabase/migrations/001_create_business_accounts.sql
supabase db execute --file supabase/migrations/002_create_business_fleet.sql
supabase db execute --file supabase/migrations/003_create_business_users.sql
supabase db execute --file supabase/migrations/004_modify_existing_tables.sql
supabase db execute --file supabase/migrations/005_create_matching_functions.sql
supabase db execute --file supabase/migrations/006_create_audit_logs.sql
```

### Option C: Direct PostgreSQL

```powershell
# Connect to Supabase PostgreSQL
psql "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# Run each migration
\i supabase/migrations/001_create_business_accounts.sql
\i supabase/migrations/002_create_business_fleet.sql
\i supabase/migrations/003_create_business_users.sql
\i supabase/migrations/004_modify_existing_tables.sql
\i supabase/migrations/005_create_matching_functions.sql
\i supabase/migrations/006_create_audit_logs.sql
```

---

## Performance Validation

After all migrations, run these checks:

### 1. Index Usage
```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as scans,
  idx_tup_read as tuples_read
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
AND tablename IN ('business_accounts', 'business_fleet', 'business_users', 'deliveries', 'driver_profiles')
ORDER BY tablename, indexname;
```

### 2. Table Sizes
```sql
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('business_accounts', 'business_fleet', 'business_users', 'fleet_audit_logs', 'deliveries', 'driver_profiles')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### 3. Query Performance
```sql
-- Test matching function performance
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT * FROM find_business_fleet_driver(
  '< business_id >',
  14.5547,
  121.0244,
  1,
  10,
  'private'
);

-- Expected: < 50ms execution time
-- Should use Index Scan, not Seq Scan
```

---

## Troubleshooting

### Issue: Foreign key constraint fails
**Cause:** Referenced table doesn't exist  
**Solution:** Ensure migrations run in order (001 → 006)

### Issue: RLS policy blocks access
**Cause:** JWT doesn't have business_id claim  
**Solution:** Use service_role key for testing, or set up auth properly

### Issue: Spatial query slow
**Cause:** GIST index not being used  
**Solution:** Run `ANALYZE business_fleet;` to update statistics

### Issue: Function not found
**Cause:** Migration 005 not executed  
**Solution:** Check `\df find_business_fleet_driver` in psql

---

## Next Steps

After successful migration:

1. ✅ **Deploy Enhanced Pair Driver Edge Function**
   - Use new matching functions
   - Test auto/manual assignment

2. ✅ **Update Dispatch UI**
   - Enable manual driver selection
   - Show fleet availability

3. ✅ **Create Fleet Management Page**
   - Vehicle CRUD operations
   - Driver assignment UI

4. ✅ **Test End-to-End**
   - Create business account
   - Add vehicles
   - Create delivery
   - Assign driver (auto + manual)

---

## Performance Benchmarks

**Expected Query Times (with proper indexes):**

- Business fleet lookup: **< 10ms**
- Spatial driver search: **< 50ms**
- Public pool search: **< 100ms**
- Fleet statistics: **< 20ms**
- Audit log insertion: **< 5ms**

If queries exceed these times, check:
1. Indexes are created: `\d+ business_fleet`
2. Statistics updated: `ANALYZE <table_name>;`
3. Connection pooling enabled
4. No missing WHERE clauses causing Seq Scans

---

## Rollback All Migrations

If you need to completely rollback:

```sql
-- WARNING: This deletes ALL fleet management data!

DROP FUNCTION IF EXISTS log_fleet_action CASCADE;
DROP TABLE IF EXISTS fleet_audit_logs CASCADE;
DROP FUNCTION IF EXISTS find_business_fleet_driver CASCADE;
DROP FUNCTION IF EXISTS find_public_pool_driver CASCADE;
DROP FUNCTION IF EXISTS get_business_fleet_stats CASCADE;
DROP FUNCTION IF EXISTS update_vehicle_status CASCADE;

ALTER TABLE deliveries 
  DROP COLUMN IF EXISTS business_id,
  DROP COLUMN IF EXISTS fleet_vehicle_id,
  DROP COLUMN IF EXISTS assignment_type CASCADE;

ALTER TABLE driver_profiles
  DROP COLUMN IF EXISTS employment_type,
  DROP COLUMN IF EXISTS managed_by_business_id CASCADE;

DROP TABLE IF EXISTS business_users CASCADE;
DROP TABLE IF EXISTS business_fleet CASCADE;
DROP TABLE IF EXISTS business_accounts CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
```

---

## Support

- **Database Issues:** Check Supabase Studio → Database → Logs
- **Performance Issues:** Use `EXPLAIN ANALYZE` on slow queries
- **RLS Issues:** Test with service_role key first
- **Migration Errors:** Check PostgreSQL error messages for details
