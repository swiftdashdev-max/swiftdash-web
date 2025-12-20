-- Migration: Database trigger for delivery status notifications
-- Purpose: Automatically invoke Edge Function when delivery status changes to in_transit or delivered

-- Create function to trigger Edge Function
CREATE OR REPLACE FUNCTION notify_delivery_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger for in_transit and delivered statuses
  IF NEW.status IN ('in_transit', 'delivered') AND 
     (OLD.status IS NULL OR OLD.status != NEW.status) THEN
    
    -- Invoke Edge Function asynchronously
    PERFORM
      net.http_post(
        url := (SELECT CONCAT(current_setting('app.settings.supabase_url'), '/functions/v1/notify-delivery-status')),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', CONCAT('Bearer ', current_setting('app.settings.service_role_key'))
        ),
        body := jsonb_build_object('record', row_to_json(NEW))
      );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_notify_delivery_status ON deliveries;
CREATE TRIGGER trigger_notify_delivery_status
  AFTER UPDATE OF status ON deliveries
  FOR EACH ROW
  EXECUTE FUNCTION notify_delivery_status_change();

COMMENT ON FUNCTION notify_delivery_status_change() IS 
'Triggers SMS and email notifications when delivery status changes to in_transit or delivered';

-- Note: Requires Supabase pg_net extension to be enabled
-- Run: CREATE EXTENSION IF NOT EXISTS pg_net;
-- Set environment variables in Supabase dashboard:
-- - TWILIO_ACCOUNT_SID
-- - TWILIO_AUTH_TOKEN  
-- - TWILIO_PHONE_NUMBER
-- - RESEND_API_KEY
-- - RESEND_DOMAIN
-- - APP_URL (e.g., https://swiftdash.app)
