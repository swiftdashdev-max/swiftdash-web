-- Migration 007: Add Driver Source Tracking
-- Purpose: Track which pool/fleet the assigned driver came from
-- Required for: Business analytics and pricing transparency

ALTER TABLE deliveries 
  ADD COLUMN IF NOT EXISTS driver_source VARCHAR(50);

COMMENT ON COLUMN deliveries.driver_source IS 'Driver source: private_fleet, public_fleet, independent_driver, other_business_fleet';

-- Index for business analytics
CREATE INDEX IF NOT EXISTS idx_deliveries_driver_source 
  ON deliveries(business_id, driver_source, created_at DESC)
  WHERE business_id IS NOT NULL;

-- Update existing deliveries
UPDATE deliveries 
SET driver_source = 'independent_driver'
WHERE driver_source IS NULL 
  AND driver_id IS NOT NULL
  AND business_id IS NULL;
