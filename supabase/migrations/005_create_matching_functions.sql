-- Migration 005: Create Driver Matching Functions
-- Purpose: Optimized PostgreSQL functions for smart driver assignment
-- Performance: Uses spatial indexes and composite indexes for fast queries

-- ============================================
-- FUNCTION: Find Business Fleet Driver (Priority 1)
-- ============================================

CREATE OR REPLACE FUNCTION find_business_fleet_driver(
  p_business_id UUID,
  p_pickup_lat DOUBLE PRECISION,
  p_pickup_lng DOUBLE PRECISION,
  p_vehicle_type_id UUID,
  p_max_distance_km DOUBLE PRECISION DEFAULT 10,
  p_access_mode VARCHAR DEFAULT 'private' -- 'private' or 'public'
)
RETURNS TABLE(
  driver_id UUID,
  driver_name VARCHAR,
  vehicle_id UUID,
  plate_number VARCHAR,
  distance_km DOUBLE PRECISION,
  rating DECIMAL,
  employment_type VARCHAR,
  access_mode VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dp.id AS driver_id,
    (dp.profile_picture_url || ' - Driver')::VARCHAR AS driver_name,
    bf.id AS vehicle_id,
    bf.plate_number,
    ROUND(
      CAST(
        6371 * acos(
          LEAST(1.0, GREATEST(-1.0,
            cos(radians(p_pickup_lat)) * 
            cos(radians(bf.current_latitude)) * 
            cos(radians(bf.current_longitude) - radians(p_pickup_lng)) + 
            sin(radians(p_pickup_lat)) * 
            sin(radians(bf.current_latitude))
          ))
        ) AS NUMERIC
      ),
      2
    ) AS distance_km,
    dp.rating,
    dp.employment_type,
    bf.access_mode
  FROM business_fleet bf
  INNER JOIN driver_profiles dp ON bf.assigned_driver_id = dp.id
  WHERE 
    -- Business ownership
    bf.business_id = p_business_id
    
    -- Access mode filter
    AND bf.access_mode = p_access_mode
    
    -- Vehicle must be available
    AND bf.current_status = 'idle'
    
    -- Driver must be online
    AND dp.current_status = 'online'
    
    -- Vehicle type match
    AND bf.vehicle_type_id = p_vehicle_type_id
    
    -- Driver must have vehicle
    AND bf.assigned_driver_id IS NOT NULL
    
    -- Location proximity (haversine formula)
    AND bf.current_latitude IS NOT NULL
    AND bf.current_longitude IS NOT NULL
    AND (
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(p_pickup_lat)) * 
          cos(radians(bf.current_latitude)) * 
          cos(radians(bf.current_longitude) - radians(p_pickup_lng)) + 
          sin(radians(p_pickup_lat)) * 
          sin(radians(bf.current_latitude))
        ))
      )
    ) <= p_max_distance_km
  ORDER BY 
    distance_km ASC,
    dp.rating DESC NULLS LAST
  LIMIT 10;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION find_business_fleet_driver IS 'Find available drivers from business fleet with distance sorting';

-- ============================================
-- FUNCTION: Find Public Pool Driver (Priority 2 & 3)
-- ============================================

CREATE OR REPLACE FUNCTION find_public_pool_driver(
  p_business_id UUID, -- For excluding if needed
  p_pickup_lat DOUBLE PRECISION,
  p_pickup_lng DOUBLE PRECISION,
  p_vehicle_type_id UUID,
  p_max_distance_km DOUBLE PRECISION DEFAULT 15,
  p_include_other_business_fleets BOOLEAN DEFAULT TRUE
)
RETURNS TABLE(
  driver_id UUID,
  driver_name VARCHAR,
  vehicle_id UUID,
  plate_number VARCHAR,
  distance_km DOUBLE PRECISION,
  rating DECIMAL,
  employment_type VARCHAR,
  access_mode VARCHAR,
  owner_business_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dp.id AS driver_id,
    (dp.profile_picture_url || ' - Driver')::VARCHAR AS driver_name,
    bf.id AS vehicle_id,
    bf.plate_number,
    ROUND(
      CAST(
        6371 * acos(
          LEAST(1.0, GREATEST(-1.0,
            cos(radians(p_pickup_lat)) * 
            cos(radians(bf.current_latitude)) * 
            cos(radians(bf.current_longitude) - radians(p_pickup_lng)) + 
            sin(radians(p_pickup_lat)) * 
            sin(radians(bf.current_latitude))
          ))
        ) AS NUMERIC
      ),
      2
    ) AS distance_km,
    dp.rating,
    dp.employment_type,
    bf.access_mode,
    bf.business_id AS owner_business_id
  FROM business_fleet bf
  INNER JOIN driver_profiles dp ON bf.assigned_driver_id = dp.id
  WHERE 
    -- Public access only
    bf.access_mode = 'public'
    
    -- Not from requesting business (they already checked their own fleet)
    AND (
      NOT p_include_other_business_fleets 
      OR bf.business_id != p_business_id
    )
    
    -- Vehicle must be available
    AND bf.current_status = 'idle'
    
    -- Driver must be online
    AND dp.current_status = 'online'
    
    -- Vehicle type match
    AND bf.vehicle_type_id = p_vehicle_type_id
    
    -- Driver must have vehicle
    AND bf.assigned_driver_id IS NOT NULL
    
    -- Location proximity (haversine formula)
    AND bf.current_latitude IS NOT NULL
    AND bf.current_longitude IS NOT NULL
    AND (
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(p_pickup_lat)) * 
          cos(radians(bf.current_latitude)) * 
          cos(radians(bf.current_longitude) - radians(p_pickup_lng)) + 
          sin(radians(p_pickup_lat)) * 
          sin(radians(bf.current_latitude))
        ))
      )
    ) <= p_max_distance_km
    
  UNION ALL
  
  -- Also include independent drivers (no fleet association)
  SELECT 
    dp.id AS driver_id,
    (dp.profile_picture_url || ' - Driver')::VARCHAR AS driver_name,
    NULL AS vehicle_id,
    dp.plate_number,
    ROUND(
      CAST(
        6371 * acos(
          LEAST(1.0, GREATEST(-1.0,
            cos(radians(p_pickup_lat)) * 
            cos(radians(dp.current_latitude)) * 
            cos(radians(dp.current_longitude) - radians(p_pickup_lng)) + 
            sin(radians(p_pickup_lat)) * 
            sin(radians(dp.current_latitude))
          ))
        ) AS NUMERIC
      ),
      2
    ) AS distance_km,
    dp.rating,
    dp.employment_type,
    NULL AS access_mode,
    NULL AS owner_business_id
  FROM driver_profiles dp
  WHERE 
    -- Independent drivers only
    dp.employment_type = 'independent'
    
    -- Driver must be online
    AND dp.current_status = 'online'
    
    -- Vehicle type match
    AND dp.vehicle_type_id = p_vehicle_type_id
    
    -- Location proximity (haversine formula)
    AND dp.current_latitude IS NOT NULL
    AND dp.current_longitude IS NOT NULL
    AND (
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(p_pickup_lat)) * 
          cos(radians(dp.current_latitude)) * 
          cos(radians(dp.current_longitude) - radians(p_pickup_lng)) + 
          sin(radians(p_pickup_lat)) * 
          sin(radians(dp.current_latitude))
        ))
      )
    ) <= p_max_distance_km
    
  ORDER BY 
    distance_km ASC,
    rating DESC NULLS LAST
  LIMIT 20;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION find_public_pool_driver IS 'Find drivers from public pool (other business fleets + independent drivers)';

-- ============================================
-- FUNCTION: Get Fleet Statistics
-- ============================================

CREATE OR REPLACE FUNCTION get_business_fleet_stats(p_business_id UUID)
RETURNS TABLE(
  total_vehicles INT,
  idle_vehicles INT,
  busy_vehicles INT,
  offline_vehicles INT,
  private_vehicles INT,
  public_vehicles INT,
  avg_rating DECIMAL,
  total_deliveries_completed INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INT AS total_vehicles,
    COUNT(*) FILTER (WHERE current_status = 'idle')::INT AS idle_vehicles,
    COUNT(*) FILTER (WHERE current_status = 'busy')::INT AS busy_vehicles,
    COUNT(*) FILTER (WHERE current_status = 'offline')::INT AS offline_vehicles,
    COUNT(*) FILTER (WHERE access_mode = 'private')::INT AS private_vehicles,
    COUNT(*) FILTER (WHERE access_mode = 'public')::INT AS public_vehicles,
    ROUND(AVG(average_rating), 2) AS avg_rating,
    COALESCE(SUM(total_deliveries), 0)::INT AS total_deliveries_completed
  FROM business_fleet
  WHERE business_id = p_business_id;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_business_fleet_stats IS 'Dashboard statistics for business fleet';

-- ============================================
-- FUNCTION: Update Vehicle Status
-- ============================================

CREATE OR REPLACE FUNCTION update_vehicle_status(
  p_vehicle_id UUID,
  p_new_status VARCHAR,
  p_location_lat DOUBLE PRECISION DEFAULT NULL,
  p_location_lng DOUBLE PRECISION DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE business_fleet
  SET 
    current_status = p_new_status,
    current_latitude = COALESCE(p_location_lat, current_latitude),
    current_longitude = COALESCE(p_location_lng, current_longitude),
    last_location_update = CASE 
      WHEN p_location_lat IS NOT NULL AND p_location_lng IS NOT NULL 
      THEN NOW()
      ELSE last_location_update
    END
  WHERE id = p_vehicle_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_vehicle_status IS 'Update vehicle status and optionally location';

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

GRANT EXECUTE ON FUNCTION find_business_fleet_driver TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION find_public_pool_driver TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION get_business_fleet_stats TO authenticated;
GRANT EXECUTE ON FUNCTION update_vehicle_status TO service_role;
