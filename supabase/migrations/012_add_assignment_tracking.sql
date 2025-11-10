-- Migration 012: Add Assignment Tracking to Deliveries
-- Purpose: Track when and by whom drivers are assigned to deliveries
-- Date: November 9, 2025

-- Add assignment tracking columns
ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL;

-- Comments
COMMENT ON COLUMN deliveries.assigned_at IS 'Timestamp when driver was assigned to this delivery';
COMMENT ON COLUMN deliveries.assigned_by IS 'User ID of dispatcher/admin who assigned the driver (NULL for auto-assignment)';

-- Index for assignment analytics and queries
CREATE INDEX IF NOT EXISTS idx_deliveries_assignment_tracking 
  ON deliveries(assigned_by, assigned_at DESC)
  WHERE assigned_by IS NOT NULL;

-- Index for driver assignment history
CREATE INDEX IF NOT EXISTS idx_deliveries_driver_assignment_time 
  ON deliveries(driver_id, assigned_at DESC)
  WHERE driver_id IS NOT NULL AND assigned_at IS NOT NULL;

-- Function to automatically set assigned_at when driver_id is set
CREATE OR REPLACE FUNCTION set_delivery_assigned_at()
RETURNS TRIGGER AS $$
BEGIN
  -- If driver_id is being set for the first time (was NULL, now has value)
  IF OLD.driver_id IS NULL AND NEW.driver_id IS NOT NULL THEN
    NEW.assigned_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-set assigned_at
DROP TRIGGER IF EXISTS trigger_set_assigned_at ON deliveries;
CREATE TRIGGER trigger_set_assigned_at
  BEFORE UPDATE ON deliveries
  FOR EACH ROW
  EXECUTE FUNCTION set_delivery_assigned_at();

COMMENT ON FUNCTION set_delivery_assigned_at IS 'Automatically sets assigned_at timestamp when driver is assigned';
COMMENT ON TRIGGER trigger_set_assigned_at ON deliveries IS 'Sets assigned_at when driver_id changes from NULL to a value';
