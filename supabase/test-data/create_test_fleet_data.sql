-- ============================================
-- TEST DATA FOR FLEET MANAGEMENT INTEGRATION
-- Run this in your Supabase SQL Editor
-- ============================================

-- IMPORTANT: Replace the placeholder IDs with your actual IDs
-- - YOUR_USER_ID: Get from auth.users table
-- - VEHICLE_TYPE_ID: Get from vehicle_types table

BEGIN;

-- 1. Create test business account
INSERT INTO public.business_accounts (
  id,
  business_name,
  business_email,
  phone,
  subscription_tier,
  status,
  settings,
  created_at,
  updated_at
) VALUES (
  'f47ac10b-58cc-4372-a567-0e02b2c3d479', -- Test business ID (fixed for consistency)
  'Test Logistics Inc',
  'test@logistics.com',
  '+63-917-123-4567',
  'professional',
  'active',
  jsonb_build_object(
    'max_drivers', 10,
    'max_vehicles', 5,
    'notifications_enabled', true
  ),
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  business_name = EXCLUDED.business_name,
  updated_at = NOW();

-- 2. Create test fleet vehicles
INSERT INTO public.business_fleet (
  id,
  business_id,
  vehicle_type_id,
  plate_number,
  model,
  year,
  color,
  access_mode,
  current_status,
  current_latitude,
  current_longitude,
  created_at,
  updated_at
) VALUES 
-- Vehicle 1: Private fleet vehicle (idle)
(
  'a1234567-89ab-cdef-0123-456789abcdef',
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  (SELECT id FROM public.vehicle_types WHERE name ILIKE '%motor%' LIMIT 1),
  'TEST-001',
  'Honda Wave 125',
  2023,
  'Red',
  'private',
  'idle',
  14.5547, -- Manila area
  121.0244,
  NOW(),
  NOW()
),
-- Vehicle 2: Public pool vehicle (idle)
(
  'b2345678-9abc-def0-1234-56789abcdef0',
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  (SELECT id FROM public.vehicle_types WHERE name ILIKE '%motor%' LIMIT 1),
  'TEST-002',
  'Yamaha Mio i125',
  2023,
  'Blue',
  'public',
  'idle',
  14.5647,
  121.0344,
  NOW(),
  NOW()
),
-- Vehicle 3: Private fleet vehicle (for multi-vehicle testing)
(
  'c3456789-abcd-ef01-2345-6789abcdef01',
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  (SELECT id FROM public.vehicle_types WHERE name ILIKE '%motor%' LIMIT 1),
  'TEST-003',
  'Honda TMX 155',
  2024,
  'Black',
  'private',
  'idle',
  14.5747,
  121.0444,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  current_status = 'idle',
  updated_at = NOW();

-- 3. Create test invitation codes
INSERT INTO public.fleet_invitation_codes (
  id,
  business_id,
  code,
  created_by,
  created_at,
  expires_at,
  max_uses,
  current_uses,
  is_active,
  metadata
) VALUES 
-- Code 1: Valid, single-use
(
  'd4567890-abcd-ef01-2345-6789abcdef02',
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  'FLEET-TEST-0001',
  (SELECT id FROM auth.users ORDER BY created_at LIMIT 1), -- First user in system
  NOW(),
  NOW() + INTERVAL '7 days',
  1,
  0,
  true,
  '{"test": true, "purpose": "single-use testing"}'::jsonb
),
-- Code 2: Valid, multi-use (5 drivers can use)
(
  'e5678901-abcd-ef01-2345-6789abcdef03',
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  'FLEET-TEST-0002',
  (SELECT id FROM auth.users ORDER BY created_at LIMIT 1),
  NOW(),
  NOW() + INTERVAL '7 days',
  5,
  0,
  true,
  '{"test": true, "purpose": "multi-use testing"}'::jsonb
),
-- Code 3: Expired (for error testing)
(
  'f6789012-abcd-ef01-2345-6789abcdef04',
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  'FLEET-EXPIRED-01',
  (SELECT id FROM auth.users ORDER BY created_at LIMIT 1),
  NOW() - INTERVAL '10 days',
  NOW() - INTERVAL '3 days', -- Expired 3 days ago
  1,
  0,
  true,
  '{"test": true, "purpose": "expired code testing"}'::jsonb
),
-- Code 4: Already used (for error testing)
(
  'a7890123-abcd-ef01-2345-6789abcdef05',
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  'FLEET-USED-001',
  (SELECT id FROM auth.users ORDER BY created_at LIMIT 1),
  NOW() - INTERVAL '2 days',
  NOW() + INTERVAL '5 days',
  1,
  1, -- Already used
  true,
  '{"test": true, "purpose": "already used testing"}'::jsonb
),
-- Code 5: Deactivated (for error testing)
(
  'b8901234-abcd-ef01-2345-6789abcdef06',
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  'FLEET-INACTIVE-01',
  (SELECT id FROM auth.users ORDER BY created_at LIMIT 1),
  NOW() - INTERVAL '1 day',
  NOW() + INTERVAL '6 days',
  1,
  0,
  false, -- Deactivated
  '{"test": true, "purpose": "inactive code testing"}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  is_active = EXCLUDED.is_active,
  current_uses = EXCLUDED.current_uses;

COMMIT;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify business was created
SELECT 
  '✅ Business Created' as status,
  business_name,
  subscription_tier,
  status as account_status,
  created_at
FROM public.business_accounts
WHERE id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

-- Verify vehicles were created
SELECT 
  '✅ Vehicles Created' as status,
  plate_number,
  model,
  access_mode,
  current_status,
  current_latitude,
  current_longitude
FROM public.business_fleet
WHERE business_id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
ORDER BY plate_number;

-- Verify invitation codes were created
SELECT 
  '✅ Invitation Codes' as status,
  code,
  CASE 
    WHEN NOT is_active THEN '❌ Inactive'
    WHEN current_uses >= max_uses THEN '❌ Used'
    WHEN expires_at < NOW() THEN '❌ Expired'
    ELSE '✅ Valid'
  END as validation_status,
  expires_at > NOW() as is_not_expired,
  is_active,
  max_uses - current_uses as remaining_uses,
  expires_at
FROM public.fleet_invitation_codes
WHERE business_id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
ORDER BY code;

-- ============================================
-- QUICK REFERENCE - TEST CODES
-- ============================================

/*
✅ VALID CODES (Use these for successful testing):
- FLEET-TEST-0001   (single-use, valid for 7 days)
- FLEET-TEST-0002   (5 uses available, valid for 7 days)

❌ ERROR CODES (Use these for error handling testing):
- FLEET-EXPIRED-01  (expired 3 days ago)
- FLEET-USED-001    (already used up)
- FLEET-INACTIVE-01 (deactivated by admin)

📋 TEST BUSINESS:
- ID: f47ac10b-58cc-4372-a567-0e02b2c3d479
- Name: Test Logistics Inc
- Tier: professional

🚗 TEST VEHICLES:
- TEST-001 (private fleet, idle)
- TEST-002 (public pool, idle)
- TEST-003 (private fleet, idle)
*/

-- ============================================
-- CLEANUP (Run this to remove test data)
-- ============================================

/*
-- Uncomment to clean up test data

BEGIN;

DELETE FROM public.fleet_invitation_codes
WHERE business_id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

DELETE FROM public.business_fleet
WHERE business_id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

DELETE FROM public.business_accounts
WHERE id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

COMMIT;

SELECT '✅ Test data cleaned up' as status;
*/
