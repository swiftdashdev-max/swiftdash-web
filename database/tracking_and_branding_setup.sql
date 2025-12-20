-- Migration: Add tracking_number index and document branding settings
-- Purpose: Optimize public tracking page lookups and establish branding schema

-- Add tracking_number column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deliveries' AND column_name = 'tracking_number'
  ) THEN
    ALTER TABLE deliveries ADD COLUMN tracking_number TEXT UNIQUE;
    
    -- Generate tracking numbers for existing deliveries
    UPDATE deliveries 
    SET tracking_number = 'SD-' || TO_CHAR(created_at, 'YYYYMMDD') || '-' || SUBSTRING(id::TEXT, 1, 8)
    WHERE tracking_number IS NULL;
    
    -- Make it NOT NULL after backfilling
    ALTER TABLE deliveries ALTER COLUMN tracking_number SET NOT NULL;
  END IF;
END $$;

-- Add index for tracking number lookups (public tracking page)
CREATE INDEX IF NOT EXISTS idx_deliveries_tracking_number 
ON deliveries(tracking_number);

-- Document business_accounts.settings JSONB structure for white-label branding
COMMENT ON COLUMN business_accounts.settings IS 
'JSONB configuration including:
{
  "logo_url": "https://...",           -- Business logo for tracking page
  "primary_color": "#3b82f6",          -- Brand color (hex) for UI elements
  "auto_dispatch": true,               -- Auto-assign to drivers
  "notification_channels": [],         -- SMS, email, push
  "default_vehicle_mode": "private",   -- private fleet vs marketplace
  "tracking_page": {
    "show_driver_info": true,          -- Show driver name/phone on tracking
    "show_support_contact": true,      -- Display support phone
    "custom_message": "..."            -- Custom message on tracking page
  }
}';

-- Add share_count column to track link sharing analytics (optional)
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS share_count INT DEFAULT 0;

COMMENT ON COLUMN deliveries.share_count IS 'Number of times tracking link was copied/shared';

-- Function to increment share count when tracking link is copied
CREATE OR REPLACE FUNCTION increment_share_count(tracking_num TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE deliveries 
  SET share_count = COALESCE(share_count, 0) + 1
  WHERE tracking_number = tracking_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION increment_share_count(TEXT) TO authenticated;

-- Auto-generate tracking numbers on delivery creation
CREATE OR REPLACE FUNCTION generate_tracking_number()
RETURNS TRIGGER AS $$
DECLARE
  new_tracking_number TEXT;
  max_attempts INT := 10;
  attempt INT := 0;
BEGIN
  -- Only generate if tracking_number is NULL
  IF NEW.tracking_number IS NULL THEN
    LOOP
      -- Generate tracking number: SD-YYYYMMDD-UUID(8 chars)
      new_tracking_number := 'SD-' || 
                            TO_CHAR(NEW.created_at, 'YYYYMMDD') || 
                            '-' || 
                            SUBSTRING(gen_random_uuid()::TEXT, 1, 8);
      
      -- Check if it's unique (highly unlikely collision, but safety check)
      IF NOT EXISTS (SELECT 1 FROM deliveries WHERE tracking_number = new_tracking_number) THEN
        NEW.tracking_number := new_tracking_number;
        EXIT;
      END IF;
      
      attempt := attempt + 1;
      IF attempt >= max_attempts THEN
        RAISE EXCEPTION 'Failed to generate unique tracking number after % attempts', max_attempts;
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate tracking numbers
DROP TRIGGER IF EXISTS trigger_generate_tracking_number ON deliveries;
CREATE TRIGGER trigger_generate_tracking_number
  BEFORE INSERT ON deliveries
  FOR EACH ROW
  EXECUTE FUNCTION generate_tracking_number();

COMMENT ON FUNCTION generate_tracking_number() IS 
'Automatically generates unique tracking numbers in format SD-YYYYMMDD-UUID for new deliveries';

