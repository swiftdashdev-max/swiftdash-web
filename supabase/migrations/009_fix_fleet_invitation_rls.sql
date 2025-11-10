-- Migration 009: Fix Fleet Invitation Codes RLS (Remove business_role dependency)
-- Purpose: Update RLS policies to work without business_role column
-- Dependencies: 008_create_fleet_invitation_codes.sql

-- Drop old policies
DROP POLICY IF EXISTS "business_admins_view_own_codes" ON public.fleet_invitation_codes;
DROP POLICY IF EXISTS "business_admins_create_codes" ON public.fleet_invitation_codes;
DROP POLICY IF EXISTS "business_admins_update_codes" ON public.fleet_invitation_codes;
DROP POLICY IF EXISTS "business_admins_delete_codes" ON public.fleet_invitation_codes;

-- Business users can view their own invitation codes
CREATE POLICY "business_users_view_own_codes"
ON public.fleet_invitation_codes
FOR SELECT
USING (
    business_id IN (
        SELECT business_id 
        FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND user_type = 'business'
        AND business_id IS NOT NULL
        AND status = 'active'
    )
);

-- Business users can create invitation codes for their business
CREATE POLICY "business_users_create_codes"
ON public.fleet_invitation_codes
FOR INSERT
WITH CHECK (
    business_id IN (
        SELECT business_id 
        FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND user_type = 'business'
        AND business_id IS NOT NULL
        AND status = 'active'
    )
    AND created_by = auth.uid()
);

-- Business users can update their own invitation codes (deactivate, etc)
CREATE POLICY "business_users_update_codes"
ON public.fleet_invitation_codes
FOR UPDATE
USING (
    business_id IN (
        SELECT business_id 
        FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND user_type = 'business'
        AND business_id IS NOT NULL
        AND status = 'active'
    )
);

-- Business users can delete their own invitation codes
CREATE POLICY "business_users_delete_codes"
ON public.fleet_invitation_codes
FOR DELETE
USING (
    business_id IN (
        SELECT business_id 
        FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND user_type = 'business'
        AND business_id IS NOT NULL
        AND status = 'active'
    )
);
