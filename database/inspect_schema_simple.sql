-- Run each query ONE AT A TIME and share results

-- QUERY 1: All deliveries columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'deliveries'
ORDER BY ordinal_position;

-- QUERY 2: Check if fleet_vehicle_id exists
SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'deliveries' 
      AND column_name = 'fleet_vehicle_id'
) AS fleet_vehicle_id_exists;

-- QUERY 3: Check if business_id exists
SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'deliveries' 
      AND column_name = 'business_id'
) AS business_id_exists;

-- QUERY 4: Payment columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'deliveries'
  AND column_name IN ('payment_by', 'payment_method', 'payment_status', 'total_price', 'delivery_fee', 'total_amount');

-- QUERY 5: business_fleet table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'business_fleet'
ORDER BY ordinal_position;

-- QUERY 6: driver_profiles employment columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'driver_profiles'
  AND column_name IN ('employment_type', 'managed_by_business_id', 'vehicle_type_id');
