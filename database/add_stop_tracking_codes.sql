-- Add tracking_code trigger and backfill for delivery_stops table
-- This enables stop-specific tracking for multi-stop deliveries
-- Format: SD-20241218-abc123-1, SD-20241218-abc123-2, etc.
-- Note: tracking_code column already exists in schema

-- Create index for fast lookups (skip if exists)
CREATE INDEX IF NOT EXISTS idx_delivery_stops_tracking_code 
ON public.delivery_stops(tracking_code) 
WHERE tracking_code IS NOT NULL;

-- Function to generate stop-specific tracking codes
-- Combines parent delivery tracking number with stop number
CREATE OR REPLACE FUNCTION generate_stop_tracking_code()
RETURNS TRIGGER AS $$
DECLARE
  parent_tracking TEXT;
BEGIN
  -- Get the parent delivery's tracking number
  SELECT tracking_number INTO parent_tracking
  FROM deliveries
  WHERE id = NEW.delivery_id;
  
  -- Generate stop-specific code: parent_tracking_number-stop_number
  -- Example: SD-20241218-abc123-1, SD-20241218-abc123-2
  NEW.tracking_code := parent_tracking || '-' || NEW.stop_number;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS set_stop_tracking_code ON public.delivery_stops;

-- Create trigger to auto-generate tracking codes on insert
-- Only for dropoff stops (stop_number > 0) - pickup stop doesn't get tracking code
CREATE TRIGGER set_stop_tracking_code
  BEFORE INSERT ON public.delivery_stops
  FOR EACH ROW
  WHEN (NEW.tracking_code IS NULL AND NEW.stop_number > 0)
  EXECUTE FUNCTION generate_stop_tracking_code();

-- Backfill tracking codes for existing stops (if any)
-- Only update stops that don't have tracking codes yet
UPDATE public.delivery_stops ds
SET tracking_code = d.tracking_number || '-' || ds.stop_number
FROM public.deliveries d
WHERE ds.delivery_id = d.id
  AND ds.tracking_code IS NULL
  AND ds.stop_number > 0;

-- Add comment for documentation
COMMENT ON COLUMN public.delivery_stops.tracking_code IS 'Stop-specific tracking code for privacy (e.g., SD-20241218-abc123-1)';
