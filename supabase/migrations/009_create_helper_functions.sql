-- Migration 009: Helper Functions for Driver App
-- Purpose: Database-level transaction functions to prevent race conditions
-- Dependencies: 004_modify_existing_tables.sql

-- Function 1: Complete Delivery Safe
-- Atomically completes delivery, resets driver status, and resets fleet vehicle
CREATE OR REPLACE FUNCTION complete_delivery_safe(
  p_delivery_id UUID,
  p_driver_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_fleet_vehicle_id UUID;
  v_business_id UUID;
  v_total_amount NUMERIC;
  v_result JSONB;
BEGIN
  -- Get delivery details
  SELECT fleet_vehicle_id, business_id, total_amount
  INTO v_fleet_vehicle_id, v_business_id, v_total_amount
  FROM public.deliveries
  WHERE id = p_delivery_id;
  
  -- Check if delivery exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Delivery not found'
    );
  END IF;
  
  -- Start atomic transaction
  BEGIN
    -- 1. Mark delivery as completed
    UPDATE public.deliveries 
    SET 
      status = 'completed',
      completed_at = NOW(),
      updated_at = NOW()
    WHERE id = p_delivery_id;
    
    -- 2. Reset driver status to online
    UPDATE public.driver_profiles 
    SET 
      is_available = true,
      current_status = 'online',
      updated_at = NOW()
    WHERE id = p_driver_id;
    
    -- 3. Reset fleet vehicle if applicable (only if currently busy)
    IF v_fleet_vehicle_id IS NOT NULL THEN
      UPDATE public.business_fleet 
      SET 
        current_status = 'idle',
        total_deliveries = total_deliveries + 1,
        updated_at = NOW()
      WHERE id = v_fleet_vehicle_id 
        AND current_status = 'busy'; -- Only reset if actually busy (prevents race)
    END IF;
    
    -- Build success response
    v_result := jsonb_build_object(
      'success', true,
      'delivery_id', p_delivery_id,
      'driver_id', p_driver_id,
      'fleet_vehicle_id', v_fleet_vehicle_id,
      'business_id', v_business_id,
      'total_amount', v_total_amount,
      'completed_at', NOW()
    );
    
    RETURN v_result;
    
  EXCEPTION WHEN OTHERS THEN
    -- Rollback on any error
    RAISE;
  END;
END;
$$;

-- Function 2: Accept Delivery Safe
-- Atomically assigns delivery to driver and sets driver as busy
CREATE OR REPLACE FUNCTION accept_delivery_safe(
  p_delivery_id UUID,
  p_driver_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_delivery_status TEXT;
  v_business_id UUID;
  v_fleet_vehicle_id UUID;
  v_result JSONB;
BEGIN
  -- Check current delivery status
  SELECT status, business_id, fleet_vehicle_id
  INTO v_delivery_status, v_business_id, v_fleet_vehicle_id
  FROM public.deliveries
  WHERE id = p_delivery_id;
  
  -- Verify delivery exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Delivery not found'
    );
  END IF;
  
  -- Verify delivery is still available
  IF v_delivery_status != 'driver_offered' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Delivery already assigned or completed',
      'current_status', v_delivery_status
    );
  END IF;
  
  -- Start atomic transaction
  BEGIN
    -- 1. Assign delivery to driver
    UPDATE public.deliveries 
    SET 
      status = 'driver_assigned',
      driver_id = p_driver_id,
      updated_at = NOW()
    WHERE id = p_delivery_id
      AND status = 'driver_offered'; -- Double-check to prevent race
    
    -- Check if update actually happened
    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Delivery was just assigned to another driver'
      );
    END IF;
    
    -- 2. Set driver as busy
    UPDATE public.driver_profiles 
    SET 
      is_available = false,
      current_status = 'busy',
      updated_at = NOW()
    WHERE id = p_driver_id;
    
    -- 3. Set fleet vehicle as busy (if applicable)
    IF v_fleet_vehicle_id IS NOT NULL THEN
      UPDATE public.business_fleet
      SET
        current_status = 'busy',
        assigned_driver_id = p_driver_id,
        updated_at = NOW()
      WHERE id = v_fleet_vehicle_id;
    END IF;
    
    -- Build success response
    v_result := jsonb_build_object(
      'success', true,
      'delivery_id', p_delivery_id,
      'driver_id', p_driver_id,
      'business_id', v_business_id,
      'fleet_vehicle_id', v_fleet_vehicle_id,
      'assigned_at', NOW()
    );
    
    RETURN v_result;
    
  EXCEPTION WHEN OTHERS THEN
    -- Rollback on any error
    RAISE;
  END;
END;
$$;

-- Function 3: Cancel Delivery Safe
-- Atomically cancels delivery and resets driver/vehicle status
CREATE OR REPLACE FUNCTION cancel_delivery_safe(
  p_delivery_id UUID,
  p_driver_id UUID,
  p_reason TEXT DEFAULT 'Driver cancelled'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_fleet_vehicle_id UUID;
  v_result JSONB;
BEGIN
  -- Get delivery details
  SELECT fleet_vehicle_id
  INTO v_fleet_vehicle_id
  FROM public.deliveries
  WHERE id = p_delivery_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Delivery not found'
    );
  END IF;
  
  -- Start atomic transaction
  BEGIN
    -- 1. Mark delivery as cancelled
    UPDATE public.deliveries 
    SET 
      status = 'cancelled',
      updated_at = NOW(),
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'cancelled_by', 'driver',
        'cancelled_at', NOW(),
        'reason', p_reason
      )
    WHERE id = p_delivery_id;
    
    -- 2. Reset driver to available
    UPDATE public.driver_profiles 
    SET 
      is_available = true,
      current_status = 'online',
      updated_at = NOW()
    WHERE id = p_driver_id;
    
    -- 3. Reset fleet vehicle if applicable
    IF v_fleet_vehicle_id IS NOT NULL THEN
      UPDATE public.business_fleet 
      SET 
        current_status = 'idle',
        assigned_driver_id = NULL,
        updated_at = NOW()
      WHERE id = v_fleet_vehicle_id;
    END IF;
    
    v_result := jsonb_build_object(
      'success', true,
      'delivery_id', p_delivery_id,
      'cancelled_at', NOW(),
      'reason', p_reason
    );
    
    RETURN v_result;
    
  EXCEPTION WHEN OTHERS THEN
    RAISE;
  END;
END;
$$;

-- Function 4: Go Online Safe
-- Sets driver status to online
CREATE OR REPLACE FUNCTION driver_go_online(
  p_driver_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.driver_profiles
  SET
    is_online = true,
    is_available = true,
    current_status = 'online',
    location_updated_at = NOW(),
    updated_at = NOW()
  WHERE id = p_driver_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Driver profile not found'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'driver_id', p_driver_id,
    'status', 'online'
  );
END;
$$;

-- Function 5: Go Offline Safe
-- Sets driver status to offline
CREATE OR REPLACE FUNCTION driver_go_offline(
  p_driver_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.driver_profiles
  SET
    is_online = false,
    is_available = false,
    current_status = 'offline',
    updated_at = NOW()
  WHERE id = p_driver_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Driver profile not found'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'driver_id', p_driver_id,
    'status', 'offline'
  );
END;
$$;

-- Add comments
COMMENT ON FUNCTION complete_delivery_safe(UUID, UUID) IS 'Atomically completes delivery and resets driver/vehicle status';
COMMENT ON FUNCTION accept_delivery_safe(UUID, UUID) IS 'Atomically assigns delivery to driver and sets busy status';
COMMENT ON FUNCTION cancel_delivery_safe(UUID, UUID, TEXT) IS 'Atomically cancels delivery and resets driver/vehicle status';
COMMENT ON FUNCTION driver_go_online(UUID) IS 'Sets driver status to online';
COMMENT ON FUNCTION driver_go_offline(UUID) IS 'Sets driver status to offline';
