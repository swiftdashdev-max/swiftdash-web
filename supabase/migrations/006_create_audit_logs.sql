-- Migration 006: Create Audit Logs Table
-- Purpose: Track fleet operations, driver assignments, and administrative actions
-- Performance: Partitioned by date for efficient queries and archival

-- Create audit logs table
CREATE TABLE IF NOT EXISTS fleet_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Context
  business_id UUID REFERENCES business_accounts(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Action Details
  action_type VARCHAR(50) NOT NULL, -- 'vehicle_created', 'driver_assigned', 'delivery_dispatched', etc.
  entity_type VARCHAR(50) NOT NULL, -- 'vehicle', 'driver', 'delivery', 'user'
  entity_id UUID,
  
  -- Change Tracking
  old_values JSONB,
  new_values JSONB,
  
  -- Metadata
  ip_address INET,
  user_agent TEXT,
  description TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX idx_fleet_audit_business 
  ON fleet_audit_logs(business_id, created_at DESC);

CREATE INDEX idx_fleet_audit_action 
  ON fleet_audit_logs(action_type, created_at DESC);

CREATE INDEX idx_fleet_audit_entity 
  ON fleet_audit_logs(entity_type, entity_id);

CREATE INDEX idx_fleet_audit_user 
  ON fleet_audit_logs(user_id, created_at DESC);

-- Partition by month for better performance (optional, for high-volume usage)
-- Uncomment if audit logs exceed 1M rows
/*
CREATE TABLE fleet_audit_logs_2025_11 PARTITION OF fleet_audit_logs
  FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
  
CREATE TABLE fleet_audit_logs_2025_12 PARTITION OF fleet_audit_logs
  FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');
*/

-- Row Level Security
ALTER TABLE fleet_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Business admins can view their logs
CREATE POLICY fleet_audit_logs_select ON fleet_audit_logs
  FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM user_profiles 
      WHERE id = auth.uid() 
      AND business_role IN ('owner', 'admin')
      AND status = 'active'
    )
  );

-- Policy: Service role can insert logs
CREATE POLICY fleet_audit_logs_insert ON fleet_audit_logs
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Grant permissions
GRANT SELECT ON fleet_audit_logs TO authenticated;
GRANT INSERT ON fleet_audit_logs TO service_role;

-- Helper function to log actions
CREATE OR REPLACE FUNCTION log_fleet_action(
  p_business_id UUID,
  p_user_id UUID,
  p_action_type VARCHAR,
  p_entity_type VARCHAR,
  p_entity_id UUID,
  p_description TEXT DEFAULT NULL,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO fleet_audit_logs (
    business_id,
    user_id,
    action_type,
    entity_type,
    entity_id,
    description,
    old_values,
    new_values
  ) VALUES (
    p_business_id,
    p_user_id,
    p_action_type,
    p_entity_type,
    p_entity_id,
    p_description,
    p_old_values,
    p_new_values
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION log_fleet_action TO service_role, authenticated;

COMMENT ON TABLE fleet_audit_logs IS 'Audit trail for fleet management operations';
COMMENT ON FUNCTION log_fleet_action IS 'Helper to create audit log entries';

-- Example usage in comments:
/*
SELECT log_fleet_action(
  '123e4567-e89b-12d3-a456-426614174000'::uuid, -- business_id
  '123e4567-e89b-12d3-a456-426614174001'::uuid, -- user_id
  'vehicle_created',
  'vehicle',
  '123e4567-e89b-12d3-a456-426614174002'::uuid, -- vehicle_id
  'Added new motorcycle to fleet',
  NULL,
  '{"plate_number": "ABC123", "vehicle_type": "motorcycle"}'::jsonb
);
*/
