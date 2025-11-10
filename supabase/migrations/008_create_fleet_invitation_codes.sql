-- Migration 008: Fleet Invitation Codes
-- Purpose: Allow businesses to generate invitation codes for drivers to join their fleet
-- Dependencies: 001_create_business_accounts.sql, 004_modify_existing_tables.sql

-- Create fleet_invitation_codes table
CREATE TABLE IF NOT EXISTS public.fleet_invitation_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.business_accounts(id) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    used_at TIMESTAMPTZ,
    used_by_driver_id UUID REFERENCES public.driver_profiles(id) ON DELETE SET NULL,
    max_uses INTEGER NOT NULL DEFAULT 1,
    current_uses INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT valid_uses_count CHECK (current_uses >= 0 AND current_uses <= max_uses)
);

-- Add indexes for performance
CREATE INDEX idx_invitation_codes_business ON public.fleet_invitation_codes(business_id);
CREATE INDEX idx_invitation_codes_expires ON public.fleet_invitation_codes(expires_at) WHERE is_active = true;
CREATE INDEX idx_invitation_codes_active ON public.fleet_invitation_codes(is_active, expires_at);
CREATE UNIQUE INDEX idx_invitation_codes_code_upper ON public.fleet_invitation_codes(UPPER(code));

-- Enable RLS
ALTER TABLE public.fleet_invitation_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Service role can do everything (for Edge Functions)
CREATE POLICY "service_role_full_access"
ON public.fleet_invitation_codes
FOR ALL
USING (auth.jwt()->>'role' = 'service_role')
WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- Business admins can view their own invitation codes
CREATE POLICY "business_admins_view_own_codes"
ON public.fleet_invitation_codes
FOR SELECT
USING (
    business_id IN (
        SELECT business_id 
        FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND business_role IN ('owner', 'admin', 'dispatcher')
        AND business_id IS NOT NULL
    )
);

-- Business admins can create invitation codes for their business
CREATE POLICY "business_admins_create_codes"
ON public.fleet_invitation_codes
FOR INSERT
WITH CHECK (
    business_id IN (
        SELECT business_id 
        FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND business_role IN ('owner', 'admin', 'dispatcher')
        AND business_id IS NOT NULL
    )
    AND created_by = auth.uid()
);

-- Business admins can update their own invitation codes (deactivate, etc)
CREATE POLICY "business_admins_update_codes"
ON public.fleet_invitation_codes
FOR UPDATE
USING (
    business_id IN (
        SELECT business_id 
        FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND business_role IN ('owner', 'admin', 'dispatcher')
        AND business_id IS NOT NULL
    )
);

-- Business admins can delete their own invitation codes
CREATE POLICY "business_admins_delete_codes"
ON public.fleet_invitation_codes
FOR DELETE
USING (
    business_id IN (
        SELECT business_id 
        FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND business_role IN ('owner', 'admin')
        AND business_id IS NOT NULL
    )
);

-- Function to generate unique invitation code
CREATE OR REPLACE FUNCTION generate_invitation_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_code TEXT;
    code_exists BOOLEAN;
BEGIN
    LOOP
        -- Generate code in format: FLEET-XXXX-XXXX
        new_code := 'FLEET-' || 
                    UPPER(SUBSTRING(MD5(random()::TEXT) FROM 1 FOR 4)) || '-' ||
                    UPPER(SUBSTRING(MD5(random()::TEXT) FROM 1 FOR 4));
        
        -- Check if code already exists (case-insensitive)
        SELECT EXISTS(
            SELECT 1 FROM public.fleet_invitation_codes 
            WHERE UPPER(code) = new_code
        ) INTO code_exists;
        
        -- Exit loop if code is unique
        EXIT WHEN NOT code_exists;
    END LOOP;
    
    RETURN new_code;
END;
$$;

-- Function to validate invitation code
CREATE OR REPLACE FUNCTION validate_invitation_code(p_code TEXT)
RETURNS TABLE(
    valid BOOLEAN,
    business_id UUID,
    business_name TEXT,
    business_tier TEXT,
    expires_at TIMESTAMPTZ,
    error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_invitation RECORD;
    v_business RECORD;
BEGIN
    -- Look up invitation code (case-insensitive)
    SELECT * INTO v_invitation
    FROM public.fleet_invitation_codes
    WHERE UPPER(code) = UPPER(p_code);
    
    -- Check if code exists
    IF v_invitation IS NULL THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ, 'Invalid invitation code'::TEXT;
        RETURN;
    END IF;
    
    -- Check if code is active
    IF NOT v_invitation.is_active THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ, 'Invitation code has been deactivated'::TEXT;
        RETURN;
    END IF;
    
    -- Check if code is expired
    IF v_invitation.expires_at < NOW() THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ, 'Invitation code has expired'::TEXT;
        RETURN;
    END IF;
    
    -- Check if code has reached max uses
    IF v_invitation.current_uses >= v_invitation.max_uses THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ, 'Invitation code has already been used'::TEXT;
        RETURN;
    END IF;
    
    -- Get business details
    SELECT * INTO v_business
    FROM public.business_accounts
    WHERE id = v_invitation.business_id;
    
    -- Check if business is active
    IF v_business.status != 'active' THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ, 'Business account is not active'::TEXT;
        RETURN;
    END IF;
    
    -- Return valid response with business details
    RETURN QUERY SELECT 
        true,
        v_business.id,
        v_business.business_name,
        v_business.subscription_tier::TEXT,
        v_invitation.expires_at,
        NULL::TEXT;
END;
$$;

-- Function to accept invitation (marks code as used, updates driver profile)
CREATE OR REPLACE FUNCTION accept_invitation_code(p_code TEXT, p_driver_id UUID)
RETURNS TABLE(
    success BOOLEAN,
    business_id UUID,
    error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_invitation RECORD;
    v_driver RECORD;
    v_validation RECORD;
BEGIN
    -- Validate the code first
    SELECT * INTO v_validation
    FROM validate_invitation_code(p_code);
    
    IF NOT v_validation.valid THEN
        RETURN QUERY SELECT false, NULL::UUID, v_validation.error_message;
        RETURN;
    END IF;
    
    -- Get invitation details
    SELECT * INTO v_invitation
    FROM public.fleet_invitation_codes
    WHERE UPPER(code) = UPPER(p_code)
    FOR UPDATE; -- Lock row to prevent race conditions
    
    -- Double-check current_uses hasn't changed
    IF v_invitation.current_uses >= v_invitation.max_uses THEN
        RETURN QUERY SELECT false, NULL::UUID, 'Invitation code was just used by another driver'::TEXT;
        RETURN;
    END IF;
    
    -- Get driver details
    SELECT * INTO v_driver
    FROM public.driver_profiles
    WHERE id = p_driver_id;
    
    IF v_driver IS NULL THEN
        RETURN QUERY SELECT false, NULL::UUID, 'Driver profile not found'::TEXT;
        RETURN;
    END IF;
    
    -- Check if driver is already managed by another business
    IF v_driver.managed_by_business_id IS NOT NULL AND v_driver.employment_type = 'fleet' THEN
        RETURN QUERY SELECT false, NULL::UUID, 'Driver is already part of another fleet'::TEXT;
        RETURN;
    END IF;
    
    -- Update driver profile
    UPDATE public.driver_profiles
    SET 
        managed_by_business_id = v_invitation.business_id,
        employment_type = 'fleet',
        updated_at = NOW()
    WHERE id = p_driver_id;
    
    -- Mark invitation as used
    UPDATE public.fleet_invitation_codes
    SET 
        current_uses = current_uses + 1,
        used_at = NOW(),
        used_by_driver_id = p_driver_id
    WHERE id = v_invitation.id;
    
    -- Log the event
    INSERT INTO public.fleet_audit_logs (
        business_id,
        vehicle_id,
        action,
        performed_by,
        metadata
    ) VALUES (
        v_invitation.business_id,
        NULL,
        'driver_joined_fleet',
        v_invitation.created_by,
        jsonb_build_object(
            'driver_id', p_driver_id,
            'invitation_code', p_code,
            'driver_name', v_driver.full_name
        )
    );
    
    -- Return success
    RETURN QUERY SELECT true, v_invitation.business_id, NULL::TEXT;
END;
$$;

-- Add comment
COMMENT ON TABLE public.fleet_invitation_codes IS 'Stores invitation codes for drivers to join business fleets';
COMMENT ON FUNCTION generate_invitation_code() IS 'Generates a unique invitation code in format FLEET-XXXX-XXXX';
COMMENT ON FUNCTION validate_invitation_code(TEXT) IS 'Validates an invitation code and returns business details if valid';
COMMENT ON FUNCTION accept_invitation_code(TEXT, UUID) IS 'Accepts an invitation code and adds driver to fleet';
