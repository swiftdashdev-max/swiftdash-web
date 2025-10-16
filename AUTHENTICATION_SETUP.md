# 🔐 SwiftDash Authentication Setup Guide

## Current Issue: 401 Unauthorized Error

The error `https://lygzxmhskkqrntnmxtbb.supabase.co/auth/v1/token?grant_type=password 401 (Unauthorized)` occurs because:

1. ✅ You have users in the `user_profiles` table
2. ❌ Supabase Authentication is NOT enabled/configured
3. ❌ No users exist in Supabase's `auth.users` table

## Solution Options

### Option 1: Enable Supabase Email/Password Authentication (Recommended)

#### Step 1: Enable Email Provider in Supabase
1. Go to https://supabase.com/dashboard/project/lygzxmhskkqrntnmxtbb
2. Navigate to **Authentication** → **Providers**
3. Enable **Email** provider
4. Configure settings:
   - ✅ Enable Email provider
   - ✅ Confirm email (optional - can disable for development)
   - ✅ Set redirect URLs

#### Step 2: Create Admin User in Supabase Auth
Run this in your Supabase SQL Editor:

```sql
-- Create admin user with password
-- This creates a user in auth.users table
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  confirmation_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@swiftdash.com',
  crypt('admin123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"user_type":"admin"}',
  false,
  ''
);
```

OR use Supabase dashboard:
1. Go to **Authentication** → **Users**
2. Click **Add user**
3. Enter:
   - Email: `admin@swiftdash.com`
   - Password: `admin123`
   - Auto Confirm: Yes

#### Step 3: Link Auth User to user_profiles
After creating the auth user, link it to your existing user_profiles:

```sql
-- Update user_profiles with auth user ID
UPDATE user_profiles
SET id = (SELECT id FROM auth.users WHERE email = 'admin@swiftdash.com')
WHERE user_type = 'admin'
LIMIT 1;
```

---

### Option 2: Use Phone-Based Authentication (Current DB Structure)

Your database uses `phone_number` as the primary identifier. You can:

#### Enable Phone Authentication:
1. Go to **Authentication** → **Providers**
2. Enable **Phone** provider
3. Configure SMS provider (Twilio, etc.)

Then update login to use phone instead of email.

---

### Option 3: Bypass Authentication (Development Only)

For quick development, use the hardcoded admin login at `/admin/login`:

```
URL: http://localhost:9002/admin/login
Email: admin@swiftdash.com
Password: admin123
```

This page doesn't use Supabase auth and will let you access the dashboard immediately.

---

## Current Database Users

From the analysis, you have these users in `user_profiles`:

| User Type | Phone | Status |
|-----------|-------|--------|
| driver | 09619478642 | active |
| customer | +1234567890 | active |
| admin | (check DB) | active |
| crm | (check DB) | active |

None of these are in Supabase's `auth.users` table, which is why login fails.

---

## Recommended Steps (Quick Fix)

1. **Immediate Fix**: Use `/admin/login` page (no Supabase auth)
2. **Proper Solution**: 
   - Enable Email provider in Supabase Dashboard
   - Create admin user via Supabase Dashboard UI
   - Link auth.users to user_profiles table

---

## Migration Script (If Needed)

To migrate all existing users to Supabase Auth:

```sql
-- This script creates auth users for all existing user_profiles
-- WARNING: Run in Supabase SQL Editor, not client code

DO $$
DECLARE
  profile_record RECORD;
  new_auth_id UUID;
BEGIN
  FOR profile_record IN 
    SELECT id, phone_number, first_name, last_name, user_type, status
    FROM user_profiles
  LOOP
    -- Create auth user with phone-based email
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      phone,
      phone_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      profile_record.id,
      'authenticated',
      'authenticated',
      profile_record.phone_number || '@swiftdash.com', -- Temporary email
      crypt('changeme123', gen_salt('bf')), -- Default password
      now(),
      profile_record.phone_number,
      now(),
      now(),
      now(),
      jsonb_build_object(
        'provider', 'phone',
        'providers', ARRAY['phone']
      ),
      jsonb_build_object(
        'user_type', profile_record.user_type,
        'first_name', profile_record.first_name,
        'last_name', profile_record.last_name
      ),
      CASE WHEN profile_record.user_type = 'admin' THEN true ELSE false END
    )
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;
```

---

## Testing Authentication

After setup, test with:

```javascript
// Test script: scripts/test-auth.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://lygzxmhskkqrntnmxtbb.supabase.co',
  'your-anon-key'
);

async function testLogin() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'admin@swiftdash.com',
    password: 'admin123'
  });
  
  if (error) {
    console.error('❌ Login failed:', error.message);
  } else {
    console.log('✅ Login successful!');
    console.log('User:', data.user);
  }
}

testLogin();
```

Run: `node scripts/test-auth.js`
