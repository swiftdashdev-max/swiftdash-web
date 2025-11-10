-- Migration 001: Create Business Accounts Table
-- Purpose: Core table for enterprise customers managing their own fleets
-- Performance: Includes indexes for auth lookups and business queries

-- Create business_accounts table
CREATE TABLE IF NOT EXISTS business_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Business Information
  business_name VARCHAR(255) NOT NULL,
  business_email VARCHAR(255) NOT NULL UNIQUE,
  business_phone VARCHAR(50),
  business_address TEXT,
  
  -- Registration & Legal
  registration_number VARCHAR(100), -- SEC/DTI registration
  tax_id VARCHAR(100),
  
  -- Subscription & Status
  subscription_tier VARCHAR(50) DEFAULT 'starter' CHECK (subscription_tier IN ('starter', 'professional', 'enterprise')),
  account_status VARCHAR(50) DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'trial', 'cancelled')),
  trial_ends_at TIMESTAMPTZ,
  subscription_started_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Contact Person
  primary_contact_name VARCHAR(255),
  primary_contact_email VARCHAR(255),
  primary_contact_phone VARCHAR(50),
  
  -- Settings
  settings JSONB DEFAULT '{}'::jsonb, -- Business preferences, notification settings, etc.
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX idx_business_accounts_email ON business_accounts(business_email);
CREATE INDEX idx_business_accounts_status ON business_accounts(account_status) WHERE account_status = 'active';
CREATE INDEX idx_business_accounts_created ON business_accounts(created_at DESC);

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_business_accounts_updated_at
  BEFORE UPDATE ON business_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE business_accounts ENABLE ROW LEVEL SECURITY;

-- Policy: Service role has full access (for now, refined in migration 003)
CREATE POLICY business_accounts_service_role ON business_accounts
  FOR ALL
  USING (auth.role() = 'service_role');

-- Note: Business user policies will be added in migration 003
-- after user_profiles.business_id column is created

-- Grant permissions
GRANT SELECT, UPDATE ON business_accounts TO authenticated;
GRANT ALL ON business_accounts TO service_role;

-- Comments for documentation
COMMENT ON TABLE business_accounts IS 'Enterprise customer accounts for fleet management';
COMMENT ON COLUMN business_accounts.subscription_tier IS 'starter (5 vehicles), professional (20 vehicles), enterprise (unlimited)';
COMMENT ON COLUMN business_accounts.settings IS 'JSON config: {auto_dispatch: true, notification_channels: [], default_vehicle_mode: "private"}';
