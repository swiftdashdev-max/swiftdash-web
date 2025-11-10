# Driver Authentication Flow - SwiftDash Driver App

**Date:** November 4, 2025  
**For:** SwiftDash Admin Team  
**From:** Driver App Development Team

---

## 📱 Overview

The SwiftDash Driver app uses **email/password authentication** via Supabase Auth. We previously attempted SMS OTP but removed it due to Twilio configuration complexity and cost.

---

## 🔐 Authentication Method

**Current:** Email + Password (Supabase Auth)  
**Previous:** ~~SMS OTP (removed Nov 4, 2025)~~

---

## 📋 Driver Signup Flow

### **Step 1: User Opens Signup Screen**

**Screen:** `lib/screens/signup_screen.dart`

**Required Fields:**
- ✅ First Name (required)
- ✅ Last Name (required)
- ✅ Email (required, validated)
- ✅ Phone Number (required, stored but not used for auth)
- ✅ Password (required, min 6 characters)
- ✅ Confirm Password (required, must match)
- ✅ Vehicle Type (dropdown, required)
- ⚪ License Number (optional)
- ⚪ Vehicle Model (optional)
- ✅ Accept Terms & Conditions (checkbox, required)

---

### **Step 2: Validation**

**Client-side Validation:**
```dart
// Email validation
if (!value.contains('@')) {
  return 'Please enter a valid email';
}

// Password validation
if (value.length < 6) {
  return 'Password must be at least 6 characters';
}

// Phone validation
if (value.length < 10) {
  return 'Please enter a valid phone number';
}

// Vehicle type check
if (_selectedVehicleType == null) {
  return 'Please select a vehicle type';
}

// Terms acceptance
if (!_acceptTerms) {
  return 'Please accept the Terms and Conditions';
}
```

---

### **Step 3: Create Supabase Auth Account**

**Service:** `lib/services/auth_service.dart`  
**Method:** `signUpDriver()`

**Process:**
```dart
// 1. Create auth user in Supabase
final response = await _supabase.auth.signUp(
  email: email,
  password: password,
  data: {
    'first_name': firstName,
    'last_name': lastName,
    'phone_number': phoneNumber,
    'user_type': 'driver',
  },
);
```

**What Happens:**
- Creates user in `auth.users` table (Supabase managed)
- User receives **email confirmation** (if email confirmation enabled)
- Returns `AuthResponse` with user ID

---

### **Step 4: Create Driver Profiles**

**Automatically triggered after successful signup**

**Creates 2 database records:**

#### **A. User Profile** (`user_profiles` table)
```dart
await _supabase.from('user_profiles').insert({
  'id': userId,                    // Same as auth.users.id
  'first_name': firstName,
  'last_name': lastName,
  'phone_number': phoneNumber,
  'user_type': 'driver',           // Important: distinguishes from customers
  'status': 'active',
  'created_at': DateTime.now(),
  'updated_at': DateTime.now(),
});
```

#### **B. Driver Profile** (`driver_profiles` table)
```dart
await _supabase.from('driver_profiles').insert({
  'id': userId,                    // Same as auth.users.id
  'is_verified': true,             // Set to true so drivers can receive deliveries
  'is_online': false,
  'is_available': false,
  'rating': 0.00,
  'total_deliveries': 0,
  'vehicle_type_id': vehicleTypeId,
  'license_number': licenseNumber,
  'vehicle_model': vehicleModel,
  'created_at': DateTime.now(),
  'updated_at': DateTime.now(),
});
```

---

### **Step 5: Success Response**

**On Success:**
- Shows success message: "Account created successfully! Please log in."
- Navigates back to login screen
- User must now log in with email/password

**On Error:**
- Shows error message with details
- User stays on signup screen to retry

---

## 🔑 Driver Login Flow

### **Step 1: User Opens Login Screen**

**Screen:** `lib/screens/login_screen.dart`

**Required Fields:**
- ✅ Email
- ✅ Password

---

### **Step 2: Authenticate with Supabase**

**Service:** `lib/services/auth_service.dart`  
**Method:** `signInWithEmailAndPassword()`

```dart
final response = await _supabase.auth.signInWithPassword(
  email: email,
  password: password,
);
```

**What Happens:**
- Checks `auth.users` table for matching email/password
- Returns session with access token (JWT)
- Session stored in device secure storage

---

### **Step 3: Verify Driver Account**

**Service:** `lib/screens/auth_wrapper.dart`  
**Method:** `_checkDriverVerification()`

**Process:**
```dart
// Check if user is actually a driver
final response = await _supabase
    .from('user_profiles')
    .select('user_type')
    .eq('id', userId)
    .maybeSingle();

if (response['user_type'] != 'driver') {
  throw Exception('This account is not a driver account');
}
```

**Why This Matters:**
- Prevents customer accounts from logging into driver app
- Ensures only verified drivers can access the app

---

### **Step 4: Load Driver Profile**

**Service:** `lib/services/auth_service.dart`  
**Method:** `getCurrentDriverProfile()`

**Fetches:**
```dart
// Get user profile
final userResponse = await _supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .eq('user_type', 'driver')
    .single();

// Get driver profile
final driverResponse = await _supabase
    .from('driver_profiles')
    .select('*')
    .eq('id', userId)
    .single();

// Combine into Driver model
return Driver.fromJson({
  ...userResponse,
  ...driverResponse,
});
```

**Driver Model Contains:**
- Personal info (name, email, phone)
- Vehicle info (type, model, license)
- Status (is_verified, is_online, is_available)
- Stats (rating, total_deliveries)
- Fleet info (employment_type, managed_by_business_id) ← NEW

---

### **Step 5: Navigate to Dashboard**

**On Success:**
- Loads main map screen (`lib/screens/main_map_screen.dart`)
- Driver starts as **OFFLINE** by default (safety)
- Driver must manually toggle "Go Online" to receive deliveries

**On Error:**
- Shows error message
- User stays on login screen

---

## 🔄 Session Management

### **Persistent Login**

**How It Works:**
```dart
// Supabase automatically persists session
final session = _supabase.auth.currentSession;
final user = _supabase.auth.currentUser;
```

**Session Duration:**
- Access token: 1 hour (auto-refreshes)
- Refresh token: 7 days
- Auto-logout after 7 days of inactivity

---

### **Auth State Listener**

**Service:** `lib/screens/auth_wrapper.dart`

```dart
_supabase.auth.onAuthStateChange.listen((authState) {
  if (authState.session != null) {
    // User logged in
    _checkDriverVerification(authState);
  } else {
    // User logged out
    Navigator.pushReplacement('/login');
  }
});
```

**Automatically handles:**
- Login → Navigate to dashboard
- Logout → Navigate to login
- Session expired → Navigate to login
- Token refresh → Silent background update

---

## 🗄️ Database Schema

### **Tables Used:**

#### **1. `auth.users`** (Supabase managed)
```sql
id                UUID PRIMARY KEY
email             TEXT UNIQUE
encrypted_password TEXT
created_at        TIMESTAMP
updated_at        TIMESTAMP
```

#### **2. `user_profiles`** (Custom)
```sql
id           UUID PRIMARY KEY REFERENCES auth.users(id)
first_name   TEXT
last_name    TEXT
phone_number TEXT
user_type    TEXT ('driver' or 'customer')
status       TEXT ('active', 'inactive', 'suspended')
created_at   TIMESTAMP
updated_at   TIMESTAMP
```

#### **3. `driver_profiles`** (Custom)
```sql
id                    UUID PRIMARY KEY REFERENCES auth.users(id)
is_verified           BOOLEAN DEFAULT false
is_online             BOOLEAN DEFAULT false
is_available          BOOLEAN DEFAULT false
rating                DECIMAL DEFAULT 0.00
total_deliveries      INTEGER DEFAULT 0
vehicle_type_id       UUID REFERENCES vehicle_types(id)
license_number        TEXT
vehicle_model         TEXT
profile_picture_url   TEXT
vehicle_picture_url   TEXT
current_latitude      DECIMAL
current_longitude     DECIMAL
employment_type       TEXT DEFAULT 'independent'    -- NEW: fleet management
managed_by_business_id UUID REFERENCES business_accounts(id)  -- NEW
current_status        TEXT DEFAULT 'offline'         -- NEW
created_at            TIMESTAMP
updated_at            TIMESTAMP
```

---

## 🔒 Security Features

### **Row Level Security (RLS)**

**Drivers can only:**
- ✅ Read their own profile
- ✅ Update their own location/status
- ❌ Cannot modify `employment_type` or `managed_by_business_id` (admin-only)
- ❌ Cannot read other drivers' profiles

**Example Policy:**
```sql
CREATE POLICY "driver_view_own"
ON driver_profiles
FOR SELECT
USING (id = auth.uid());

CREATE POLICY "driver_update_own"
ON driver_profiles
FOR UPDATE
USING (id = auth.uid())
WITH CHECK (
  -- Cannot modify employment type or business assignment
  employment_type = OLD.employment_type AND
  managed_by_business_id = OLD.managed_by_business_id
);
```

---

## 🚨 Error Handling

### **Common Errors:**

**1. Invalid Credentials**
```
Error: Invalid login credentials
User Action: Check email/password, try again
```

**2. Email Already Exists**
```
Error: User already registered
User Action: Try logging in instead, or use password reset
```

**3. Weak Password**
```
Error: Password must be at least 6 characters
User Action: Choose stronger password
```

**4. Not a Driver Account**
```
Error: This account is not a driver account
User Action: Customer accounts cannot access driver app
```

**5. Network Error**
```
Error: Network request failed
User Action: Check internet connection, retry
```

---

## 📊 Monitoring & Analytics

### **Events Logged:**

**Signup:**
- ✅ Signup attempt
- ✅ Signup success (with user_id)
- ❌ Signup failure (with error)

**Login:**
- ✅ Login attempt
- ✅ Login success (with user_id)
- ❌ Login failure (with error)

**Session:**
- ✅ Session started
- ✅ Session refreshed
- ✅ Session expired
- ✅ User logged out

---

## 🔧 Admin Requirements

### **What You Need to Know:**

**1. Email Confirmation**
- **Current:** Disabled (drivers can login immediately)
- **Recommendation:** Keep disabled for faster onboarding
- **If Enabled:** Drivers must verify email before first login

**2. Password Reset**
- **Method:** Email-based password reset via Supabase
- **Flow:** Forgot Password → Enter Email → Receive Reset Link → Set New Password

**3. Account Status**
- **Active:** Can login and receive deliveries
- **Inactive:** Cannot login (blocked by RLS)
- **Suspended:** Cannot login, shown suspension message

**4. Driver Verification**
- **`is_verified`:** Set to `true` by default
- **Purpose:** Allows driver to receive delivery offers immediately
- **Admin Control:** You can set to `false` to manually approve drivers

---

## 🔄 Migration from SMS OTP

### **What Changed (Nov 4, 2025):**

**Removed:**
- ❌ SMS OTP verification
- ❌ Twilio integration
- ❌ Phone-based authentication
- ❌ `lib/services/otp_service.dart`
- ❌ `lib/screens/otp_verification_screen.dart`

**Kept:**
- ✅ Phone number field (still collected, stored in `user_profiles`)
- ✅ Phone number used for delivery contact purposes
- ✅ Phone number shown in driver profile

**Why We Removed OTP:**
- Twilio configuration complexity
- Cost of SMS messages
- Error 21612 (sender ID restrictions for Philippines)
- Email/password is simpler and free

---

## 📞 Integration Points

### **For Customer App:**

**Driver Login Status:**
```dart
// Check if driver is online via database
final response = await supabase
    .from('driver_profiles')
    .select('is_online, is_available')
    .eq('id', driverId)
    .single();

if (response['is_online'] && response['is_available']) {
  // Driver is available for deliveries
}
```

**Driver Profile Access:**
```dart
// Get driver info for delivery display
final driver = await supabase
    .from('driver_profiles')
    .select('*, user_profiles!inner(*)')
    .eq('id', driverId)
    .single();

// Returns:
// {
//   "id": "...",
//   "rating": 4.8,
//   "total_deliveries": 150,
//   "user_profiles": {
//     "first_name": "Juan",
//     "last_name": "Dela Cruz",
//     "phone_number": "+639171234567"
//   }
// }
```

---

## 🎯 Future Enhancements

### **Potential Improvements:**

**1. Social Login**
- Google Sign-In
- Facebook Login
- Apple Sign-In

**2. Biometric Authentication**
- Fingerprint login
- Face ID (iOS)
- Quick re-authentication

**3. Two-Factor Authentication (2FA)**
- SMS OTP as second factor (not primary)
- Authenticator app support

**4. Account Linking**
- Link phone number after email signup
- Add multiple login methods

---

## 📝 Testing Credentials

### **For Development/Staging:**

**Test Driver Account:**
```
Email: testdriver@swiftdash.ph
Password: Test123456
User Type: driver
Status: active
Is Verified: true
```

**How to Create Test Accounts:**
```sql
-- 1. Create auth user (via Supabase Dashboard or API)
-- 2. Insert user profile
INSERT INTO user_profiles (id, first_name, last_name, phone_number, user_type, status)
VALUES ('user-uuid', 'Test', 'Driver', '+639171234567', 'driver', 'active');

-- 3. Insert driver profile
INSERT INTO driver_profiles (id, is_verified, is_online, is_available)
VALUES ('user-uuid', true, false, false);
```

---

## 🆘 Support & Troubleshooting

### **Common Issues:**

**Issue:** "User not found" after signup
```
Cause: Profile creation failed
Fix: Check `user_profiles` and `driver_profiles` tables
SQL: SELECT * FROM user_profiles WHERE id = 'user-uuid';
```

**Issue:** "Not a driver account"
```
Cause: user_type is 'customer' not 'driver'
Fix: Update user_type in user_profiles table
SQL: UPDATE user_profiles SET user_type = 'driver' WHERE id = 'user-uuid';
```

**Issue:** Driver cannot receive deliveries
```
Cause: is_verified = false
Fix: Set is_verified to true
SQL: UPDATE driver_profiles SET is_verified = true WHERE id = 'user-uuid';
```

---

## 📧 Contact

**Driver App Team:**
- GitHub: juanpaynor/swiftdash-driver
- Issues: Create GitHub issue with "auth" label

**Questions About:**
- Email configuration → Check Supabase Auth settings
- Database schema → See schema.md
- RLS policies → Check Supabase SQL Editor

---

**Last Updated:** November 4, 2025  
**Version:** 1.0.0  
**Auth Method:** Email/Password (Supabase Auth)
