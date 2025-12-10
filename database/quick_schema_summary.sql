-- ========================================
-- QUICK DATABASE SUMMARY
-- Run this in Supabase SQL Editor for a fast overview
-- ========================================

-- 1. All tables with their row counts
SELECT 
    schemaname,
    tablename,
    (xpath('/row/cnt/text()', xml_count))[1]::text::int as row_count
FROM (
    SELECT 
        schemaname, 
        tablename, 
        query_to_xml(format('select count(*) as cnt from %I.%I', schemaname, tablename), false, true, '') as xml_count
    FROM pg_tables
    WHERE schemaname = 'public'
) t
ORDER BY tablename;

-- 2. Key business metrics
SELECT 
    'Total Users' as metric,
    COUNT(*) as count,
    json_build_object(
        'customers', (SELECT COUNT(*) FROM user_profiles WHERE user_type = 'customer'),
        'drivers', (SELECT COUNT(*) FROM user_profiles WHERE user_type = 'driver'),
        'business', (SELECT COUNT(*) FROM user_profiles WHERE user_type = 'business'),
        'admin', (SELECT COUNT(*) FROM user_profiles WHERE user_type = 'admin')
    ) as breakdown
FROM user_profiles

UNION ALL

SELECT 
    'Total Deliveries',
    COUNT(*),
    json_build_object(
        'pending', (SELECT COUNT(*) FROM deliveries WHERE status = 'pending'),
        'in_progress', (SELECT COUNT(*) FROM deliveries WHERE status IN ('driver_assigned', 'pickup_arrived', 'package_collected', 'in_transit')),
        'completed', (SELECT COUNT(*) FROM deliveries WHERE status = 'delivered'),
        'cancelled', (SELECT COUNT(*) FROM deliveries WHERE status = 'cancelled')
    )
FROM deliveries

UNION ALL

SELECT 
    'Business Accounts',
    COUNT(*),
    json_build_object(
        'active', (SELECT COUNT(*) FROM business_accounts WHERE account_status = 'active'),
        'trial', (SELECT COUNT(*) FROM business_accounts WHERE account_status = 'trial'),
        'suspended', (SELECT COUNT(*) FROM business_accounts WHERE account_status = 'suspended')
    )
FROM business_accounts

UNION ALL

SELECT 
    'Fleet Vehicles',
    COUNT(*),
    json_build_object(
        'idle', (SELECT COUNT(*) FROM business_fleet WHERE current_status = 'idle'),
        'busy', (SELECT COUNT(*) FROM business_fleet WHERE current_status = 'busy'),
        'offline', (SELECT COUNT(*) FROM business_fleet WHERE current_status = 'offline')
    )
FROM business_fleet

UNION ALL

SELECT 
    'Driver Verifications',
    COUNT(*),
    json_build_object(
        'pending', (SELECT COUNT(*) FROM driver_verification_submissions WHERE status = 'pending'),
        'approved', (SELECT COUNT(*) FROM driver_verification_submissions WHERE status = 'approved'),
        'rejected', (SELECT COUNT(*) FROM driver_verification_submissions WHERE status = 'rejected')
    )
FROM driver_verification_submissions;

-- 3. Vehicle types available
SELECT 
    id,
    name,
    base_price,
    price_per_km,
    max_weight_kg,
    additional_stop_charge,
    is_active
FROM vehicle_types
ORDER BY base_price;

-- 4. Recent deliveries (last 5)
SELECT 
    d.id,
    d.status,
    d.pickup_address,
    d.delivery_address,
    d.total_price,
    d.is_multi_stop,
    d.total_stops,
    up.first_name || ' ' || up.last_name as customer_name,
    dp.first_name || ' ' || dp.last_name as driver_name,
    vt.name as vehicle_type,
    d.created_at
FROM deliveries d
LEFT JOIN user_profiles up ON d.customer_id = up.id
LEFT JOIN driver_profiles dr ON d.driver_id = dr.id
LEFT JOIN user_profiles dp ON dr.id = dp.id
LEFT JOIN vehicle_types vt ON d.vehicle_type_id = vt.id
ORDER BY d.created_at DESC
LIMIT 5;

-- 5. Business accounts summary
SELECT 
    ba.id,
    ba.business_name,
    ba.subscription_tier,
    ba.account_status,
    (SELECT COUNT(*) FROM business_fleet WHERE business_id = ba.id) as fleet_count,
    (SELECT COUNT(*) FROM deliveries WHERE business_id = ba.id) as total_deliveries,
    ba.created_at
FROM business_accounts ba
ORDER BY ba.created_at DESC;

-- 6. Driver status overview
SELECT 
    dp.current_status,
    COUNT(*) as driver_count,
    AVG(up.rating)::numeric(10,2) as avg_rating,
    SUM(dp.total_deliveries) as total_deliveries_completed
FROM driver_profiles dp
JOIN user_profiles up ON dp.id = up.id
GROUP BY dp.current_status
ORDER BY driver_count DESC;

-- 7. Payment methods breakdown
SELECT 
    payment_method,
    payment_status,
    COUNT(*) as delivery_count,
    SUM(total_amount)::numeric(10,2) as total_amount,
    AVG(total_amount)::numeric(10,2) as avg_amount
FROM deliveries
WHERE payment_method IS NOT NULL
GROUP BY payment_method, payment_status
ORDER BY delivery_count DESC;

-- 8. Check for missing critical data
SELECT 
    'Missing vehicle_type_id in deliveries' as issue,
    COUNT(*) as count
FROM deliveries 
WHERE vehicle_type_id IS NULL

UNION ALL

SELECT 
    'Drivers without vehicle_type',
    COUNT(*)
FROM driver_profiles 
WHERE vehicle_type_id IS NULL

UNION ALL

SELECT 
    'Users without phone_number',
    COUNT(*)
FROM user_profiles 
WHERE phone_number IS NULL OR phone_number = ''

UNION ALL

SELECT 
    'Deliveries with null customer_id',
    COUNT(*)
FROM deliveries 
WHERE customer_id IS NULL;
