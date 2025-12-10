-- ========================================
-- SCHEMA INSPECTION: Payment & Fleet Tables
-- Purpose: Check current schema before implementing Option 1
-- ========================================

-- 1. Inspect deliveries table structure
SELECT 
    column_name, 
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'deliveries'
ORDER BY ordinal_position;

-- 2. Check constraints on deliveries table
SELECT
    con.conname AS constraint_name,
    con.contype AS constraint_type,
    CASE con.contype
        WHEN 'c' THEN pg_get_constraintdef(con.oid)
        WHEN 'f' THEN 'FK: ' || (SELECT relname FROM pg_class WHERE oid = con.confrelid)
        ELSE ''
    END AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'deliveries'
  AND rel.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY con.contype, con.conname;

-- 3. Inspect business_fleet table (if exists)
SELECT 
    column_name, 
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'business_fleet'
ORDER BY ordinal_position;

-- 4. Inspect vehicle_types table structure
SELECT 
    column_name, 
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'vehicle_types'
ORDER BY ordinal_position;

-- 5. Check driver_profiles employment types
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'driver_profiles'
  AND column_name IN ('employment_type', 'managed_by_business_id', 'vehicle_type_id')
ORDER BY ordinal_position;

-- 6. Check if fleet_vehicle_id already exists in deliveries
SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'deliveries' 
      AND column_name = 'fleet_vehicle_id'
) AS fleet_vehicle_id_exists;

-- 7. Check business_id column in deliveries
SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'deliveries' 
      AND column_name = 'business_id'
) AS business_id_exists;

-- 8. List all tables that contain 'fleet' or 'business' in name
SELECT 
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (table_name LIKE '%fleet%' OR table_name LIKE '%business%')
ORDER BY table_name;

-- 9. Check current payment-related columns in deliveries
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'deliveries'
  AND column_name IN ('payment_by', 'payment_method', 'payment_status', 'total_price', 'delivery_fee', 'total_amount')
ORDER BY ordinal_position;

-- 10. Check if there's a pricing table for vehicle types
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'vehicle_types'
  AND column_name IN ('base_price', 'price_per_km', 'price_per_minute')
ORDER BY ordinal_position;
