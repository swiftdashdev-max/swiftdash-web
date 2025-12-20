-- Migration: Add email fields for notification system
-- Purpose: Store sender and recipient email addresses for SMS/Email notifications

-- Add email fields to deliveries table
ALTER TABLE deliveries 
ADD COLUMN IF NOT EXISTS pickup_contact_email TEXT,
ADD COLUMN IF NOT EXISTS delivery_contact_email TEXT;

-- Add indexes for email lookups (helpful for notification queries)
CREATE INDEX IF NOT EXISTS idx_deliveries_pickup_email 
ON deliveries(pickup_contact_email) WHERE pickup_contact_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_deliveries_delivery_email 
ON deliveries(delivery_contact_email) WHERE delivery_contact_email IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN deliveries.pickup_contact_email IS 
'Email address of sender/pickup contact for notification delivery (in_transit, delivered status updates)';

COMMENT ON COLUMN deliveries.delivery_contact_email IS 
'Email address of recipient/delivery contact for notification delivery (in_transit, delivered status updates with invoice)';
