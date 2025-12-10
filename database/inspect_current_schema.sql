-- ========================================
-- COMPREHENSIVE DATABASE SCHEMA INSPECTION
-- Run this in Supabase SQL Editor
-- ========================================

-- 1. List all tables in the public schema
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
ORDER BY table_name;

-- 2. Get detailed column information for each table
SELECT 
    table_name,
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- 3. List all foreign key relationships
SELECT
    tc.table_name as table_name,
    kcu.column_name as column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- 4. Check all constraints (CHECK, UNIQUE, PRIMARY KEY)
SELECT
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.check_constraints cc
    ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_type;

-- 5. Count records in key tables
SELECT 'user_profiles' as table_name, COUNT(*) as record_count FROM user_profiles
UNION ALL
SELECT 'driver_profiles', COUNT(*) FROM driver_profiles
UNION ALL
SELECT 'deliveries', COUNT(*) FROM deliveries
UNION ALL
SELECT 'vehicle_types', COUNT(*) FROM vehicle_types
UNION ALL
SELECT 'driver_verification_submissions', COUNT(*) FROM driver_verification_submissions
UNION ALL
SELECT 'delivery_stops', COUNT(*) FROM delivery_stops
ORDER BY table_name;

-- 6. Check if specific tables exist that we might need
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_profiles') 
        THEN '✓ user_profiles exists'
        ELSE '✗ user_profiles missing'
    END as user_profiles_status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'driver_profiles') 
        THEN '✓ driver_profiles exists'
        ELSE '✗ driver_profiles missing'
    END as driver_profiles_status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'deliveries') 
        THEN '✓ deliveries exists'
        ELSE '✗ deliveries missing'
    END as deliveries_status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vehicle_types') 
        THEN '✓ vehicle_types exists'
        ELSE '✗ vehicle_types missing'
    END as vehicle_types_status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'delivery_stops') 
        THEN '✓ delivery_stops exists'
        ELSE '✗ delivery_stops missing'
    END as delivery_stops_status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'business_fleet') 
        THEN '✓ business_fleet exists'
        ELSE '✗ business_fleet missing'
    END as business_fleet_status,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'business_team_members') 
        THEN '✓ business_team_members exists'
        ELSE '✗ business_team_members missing'
    END as business_team_status;

-- 7. Sample data from key tables (first 3 rows)
SELECT 'DELIVERIES SAMPLE:' as info;
SELECT id, customer_id, status, pickup_address, delivery_address, total_price, created_at
FROM deliveries
ORDER BY created_at DESC
LIMIT 3;

SELECT 'USER_PROFILES SAMPLE:' as info;
SELECT id, email, user_type, full_name, created_at
FROM user_profiles
ORDER BY created_at DESC
LIMIT 3;

SELECT 'VEHICLE_TYPES SAMPLE:' as info;
SELECT id, name, base_price, price_per_km, max_weight, max_dimensions
FROM vehicle_types
ORDER BY name
LIMIT 5;
