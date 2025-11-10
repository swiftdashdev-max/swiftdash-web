# SwiftDash Delivery Management System - Complete Flow

## 📋 Overview

SwiftDash is a delivery management platform with a **3-tier driver priority system**:
1. **Private Fleet Drivers** (Business-owned, highest priority)
2. **Public Fleet Drivers** (Business-owned but available to global pool when idle)
3. **Independent Drivers** (Global driver pool, B2C fallback)

---

## 🏗️ Database Schema

### Core Tables

#### `business_accounts`
- Stores business account information
- Fields: `id`, `business_name`, `subscription_tier`, `status`, etc.
- RLS: Business owners/admins can view and update their own account

#### `user_profiles`
- Links auth users to business accounts and roles
- Fields: `id`, `user_id` (FK to auth.users), `business_id` (FK to business_accounts), `business_role` (owner/admin/dispatcher), `user_type` (business/driver/admin)
- RLS: Users can view their own profile; business users can view team members

#### `business_fleet`
- Business-owned vehicles
- Fields:
  - `id`, `business_id` (FK)
  - `vehicle_type_id` (FK to vehicle_types)
  - `plate_number`, `vehicle_make`, `vehicle_model`, `vehicle_year`, `vehicle_color`
  - `assigned_driver_id` (FK to driver_profiles)
  - `access_mode` ('private' or 'public')
  - `current_status` ('idle', 'busy', 'offline', 'maintenance')
  - `current_latitude`, `current_longitude`
  - Performance metrics: `total_deliveries`, `total_distance_km`, `average_rating`
- RLS: Business users can view/manage their own fleet

#### `driver_profiles`
- Driver information and employment status
- Fields:
  - `id`, `user_id` (FK to auth.users)
  - `employment_type` ('independent' or 'fleet_driver')
  - `managed_by_business_id` (FK to business_accounts) - NULL for independent
  - `current_status` ('online', 'offline', 'busy')
  - `vehicle_type_id`, location data, ratings
- RLS: Drivers can view/update their own profile; cannot modify `employment_type` or `managed_by_business_id`

#### `deliveries`
- Delivery orders with assignment tracking
- Fields:
  - `id`, `pickup_address`, `dropoff_address`, `status`
  - `driver_id` (FK to driver_profiles)
  - `business_id` (FK to business_accounts) - NULL for B2C deliveries
  - `fleet_vehicle_id` (FK to business_fleet) - populated for fleet deliveries
  - `assignment_type` ('auto' or 'manual')
  - `created_at`, `completed_at`, pricing, customer details
- RLS: Business users can view their deliveries; drivers can view assigned deliveries

#### `fleet_invitation_codes`
- Invitation codes for drivers to join business fleets
- Fields:
  - `id`, `business_id`, `code` (format: FLEET-XXXX-XXXX)
  - `created_by`, `created_at`, `expires_at` (default 7 days)
  - `used_at`, `used_by_driver_id`
  - `max_uses` (default 1), `current_uses`, `is_active`
- RLS: Business admins can create/view/update/delete their own codes

---

## 🔄 Delivery Creation & Assignment Flow

### Step 1: Business Creates Delivery

**Current UI**: `src/app/business/deliveries/create/page.tsx`

**Form Fields**:
- Delivery Type:
  - Single stop vs. Multi-stop
  - Immediate vs. Scheduled (date/time picker)
- Pickup Details:
  - Address, contact name, phone, special instructions
- Dropoff Details:
  - For single: Address, contact, phone, instructions
  - For multi-stop: Array of stops (up to 10)
- Package Details:
  - Vehicle type (motorcycle, sedan, SUV, van, truck)
  - Description, weight (kg), value (₱)

**Current Status**: ✅ UI Complete (mock data)
**TODO**: Connect to Supabase API

**Expected API Flow**:
```typescript
// 1. Insert delivery into `deliveries` table
const { data: delivery, error } = await supabase
  .from('deliveries')
  .insert({
    business_id: currentUser.business_id,
    pickup_address: pickupAddress,
    pickup_latitude: pickupLat, // from geocoding
    pickup_longitude: pickupLng,
    dropoff_address: dropoffAddress,
    dropoff_latitude: dropoffLat,
    dropoff_longitude: dropoffLng,
    vehicle_type_id: selectedVehicleTypeId,
    package_description: packageDesc,
    package_weight: packageWeight,
    package_value: packageValue,
    status: isScheduled ? 'scheduled' : 'pending',
    scheduled_pickup_time: isScheduled ? scheduledDateTime : null,
    pickup_contact_name: pickupContact,
    pickup_contact_phone: pickupPhone,
    pickup_instructions: pickupInstructions,
    dropoff_contact_name: dropoffContact,
    dropoff_contact_phone: dropoffPhone,
    dropoff_instructions: dropoffInstructions,
    // Multi-stop data stored in JSONB field
    stops: isMultiStop ? stops : null
  })
  .select()
  .single()

// 2. If not scheduled, trigger driver assignment
if (!isScheduled) {
  await supabase.functions.invoke('pair-business-driver', {
    body: {
      deliveryId: delivery.id,
      mode: 'auto' // or 'manual' with driverId
    }
  })
}
```

---

### Step 2: Driver Assignment (Edge Function)

**Function**: `supabase/functions/pair-business-driver/index.ts`

**Priority Logic**:

1. **Private Fleet (Tier 1)**:
   - Query `business_fleet` WHERE:
     - `business_id = delivery.business_id`
     - `access_mode = 'private'`
     - `current_status = 'idle'`
     - `vehicle_type_id = delivery.vehicle_type_id`
   - Join with `driver_profiles` on `assigned_driver_id`
   - Filter: `driver.current_status = 'online'`
   - Order by distance (PostGIS calculation)
   - **If found**: Assign and STOP

2. **Public Fleet (Tier 2)**:
   - Query `business_fleet` WHERE:
     - `access_mode = 'public'`
     - `current_status = 'idle'`
     - `vehicle_type_id = delivery.vehicle_type_id`
     - Can be from same business OR other businesses
   - Join with `driver_profiles`
   - Filter: `driver.current_status = 'online'`
   - Order by distance
   - **If found**: Assign and STOP

3. **Independent Drivers (Tier 3 - Fallback)**:
   - Query `driver_profiles` WHERE:
     - `employment_type = 'independent'`
     - `current_status = 'online'`
     - `vehicle_type_id = delivery.vehicle_type_id`
   - Order by distance
   - **If found**: Assign

4. **No Driver Available**:
   - Leave delivery in 'pending' status
   - Business can manually assign later
   - Or wait for driver to come online (webhook notification)

**Assignment Update**:
```sql
UPDATE deliveries
SET 
  driver_id = assigned_driver.id,
  fleet_vehicle_id = assigned_driver.vehicle_id, -- NULL for independent
  assignment_type = 'auto', -- or 'manual'
  status = 'assigned',
  assigned_at = NOW()
WHERE id = delivery_id
```

**Driver/Vehicle Update**:
```sql
-- Update driver status
UPDATE driver_profiles
SET current_status = 'busy'
WHERE id = assigned_driver.id

-- Update vehicle status (if fleet)
UPDATE business_fleet
SET current_status = 'busy'
WHERE id = assigned_driver.vehicle_id
```

---

### Step 3: Driver Accepts & Completes Delivery

**Driver App Flow** (Mobile - Flutter):
1. Driver receives push notification
2. Views delivery details in app
3. Taps "Accept" → `status = 'in_progress'`
4. Arrives at pickup → `status = 'picked_up'`
5. Arrives at dropoff → `status = 'completed'`
6. Uploads proof of delivery (photo)

**Status Updates**:
```sql
-- Driver accepts
UPDATE deliveries
SET 
  status = 'in_progress',
  started_at = NOW()
WHERE id = delivery_id

-- Pickup complete
UPDATE deliveries
SET 
  status = 'picked_up',
  picked_up_at = NOW()
WHERE id = delivery_id

-- Delivery complete
UPDATE deliveries
SET 
  status = 'completed',
  completed_at = NOW(),
  proof_of_delivery = photo_url
WHERE id = delivery_id
```

**Driver/Vehicle Status Reset**:
```sql
-- Reset driver to online
UPDATE driver_profiles
SET current_status = 'online'
WHERE id = driver_id

-- Reset vehicle to idle (if fleet)
UPDATE business_fleet
SET current_status = 'idle'
WHERE id = fleet_vehicle_id
```

---

## 👥 Fleet Management Flow

### Scenario A: Business Adds Own Vehicle

**UI**: `src/app/business/fleet/page.tsx` (empty - to be built)

**Expected Flow**:
1. Business admin navigates to Fleet page
2. Clicks "Add Vehicle"
3. Fills form:
   - Vehicle type (motorcycle, van, truck)
   - Plate number, make, model, year, color
   - Access mode: Private vs. Public
   - Upload documents (registration, insurance)
4. Submits → Inserts into `business_fleet`

**API Call**:
```typescript
const { data, error } = await supabase
  .from('business_fleet')
  .insert({
    business_id: currentUser.business_id,
    vehicle_type_id: selectedVehicleTypeId,
    plate_number: plateNumber,
    vehicle_make: make,
    vehicle_model: model,
    vehicle_year: year,
    vehicle_color: color,
    access_mode: accessMode, // 'private' or 'public'
    current_status: 'idle',
    documents: { registration_url, insurance_url }
  })
  .select()
  .single()
```

**Business Can**:
- View all fleet vehicles
- Edit vehicle details
- Delete vehicles
- Assign drivers to vehicles
- Change access mode (private ↔ public)

---

### Scenario B: Business Invites SwiftDash Partner Driver

**What is a SwiftDash Partner Driver?**
- Independent drivers already registered on SwiftDash
- Have completed verification
- Available in global driver pool
- Can join a business fleet via invitation code

**Fleet Invitation System**:

#### Step 1: Business Generates Invitation Code

**UI**: Fleet page → "Invite Partner Driver" button

**API Call**:
```typescript
const { data, error } = await supabase.rpc('generate_invitation_code')
// Returns: { code: 'FLEET-X7K2-M9P4' }

// Then insert into fleet_invitation_codes
const { data: invitation, error } = await supabase
  .from('fleet_invitation_codes')
  .insert({
    business_id: currentUser.business_id,
    code: generatedCode,
    created_by: currentUser.id,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    max_uses: 1, // or allow multiple uses
    is_active: true
  })
  .select()
  .single()
```

**Business Can**:
- View all active invitation codes
- See usage status (used/unused)
- Deactivate codes
- Delete unused codes
- Set expiration dates
- Set max uses (single-use or multi-use)

#### Step 2: Business Shares Code with Driver

**Methods**:
- SMS
- Email
- WhatsApp
- In-person (print QR code)

**Code Format**: `FLEET-XXXX-XXXX`
- Example: `FLEET-X7K2-M9P4`
- Generated via: `UPPER(SUBSTRING(MD5(random()::TEXT) FROM 1 FOR 4))`

#### Step 3: Driver Validates & Accepts Code (Mobile App)

**Driver App Flow**:
1. Driver opens SwiftDash app
2. Navigates to "Join Fleet" section
3. Enters invitation code
4. App validates code via Edge Function

**Validation API**:
```typescript
const { data, error } = await supabase.functions.invoke(
  'validate-fleet-invitation',
  {
    body: { code: enteredCode }
  }
)

// Response:
{
  valid: true,
  business_id: 'uuid',
  business_name: 'ABC Logistics Inc.',
  subscription_tier: 'premium',
  expires_at: '2025-11-11T10:00:00Z',
  error_message: null
}
```

**Validation Checks** (in database function):
- Code exists in `fleet_invitation_codes`
- Code is active (`is_active = true`)
- Code hasn't expired (`expires_at > NOW()`)
- Code hasn't reached max uses (`current_uses < max_uses`)
- Business account is active

5. If valid, app shows confirmation dialog:
   - "Join ABC Logistics Inc.?"
   - Business details
   - Confirmation buttons

6. Driver taps "Accept"

**Accept Invitation API**:
```typescript
const { data, error } = await supabase.functions.invoke(
  'accept-fleet-invitation',
  {
    body: {
      code: enteredCode,
      driver_id: currentDriver.id
    }
  }
)

// Response:
{
  success: true,
  business_id: 'uuid',
  message: 'Successfully joined ABC Logistics Inc.'
}
```

**Database Updates** (atomic transaction):
```sql
-- 1. Update driver profile
UPDATE driver_profiles
SET 
  employment_type = 'fleet_driver',
  managed_by_business_id = invitation.business_id,
  updated_at = NOW()
WHERE id = driver_id

-- 2. Mark invitation as used
UPDATE fleet_invitation_codes
SET 
  current_uses = current_uses + 1,
  used_at = NOW(),
  used_by_driver_id = driver_id
WHERE code = invitation_code

-- 3. Log audit event
INSERT INTO fleet_audit_logs (
  business_id,
  action,
  performed_by,
  metadata
) VALUES (
  invitation.business_id,
  'driver_joined_fleet',
  invitation.created_by,
  jsonb_build_object(
    'driver_id', driver_id,
    'invitation_code', invitation_code
  )
)
```

**Post-Acceptance**:
- Driver's status changes: `employment_type = 'fleet_driver'`
- Driver's `managed_by_business_id` points to business
- Driver can still see their profile in app
- Driver receives priority for business's deliveries
- Driver can leave fleet later (sets `employment_type = 'independent'`)

---

### Scenario C: Business Assigns Driver to Vehicle

**UI**: Fleet page → Vehicle card → "Assign Driver" dropdown

**API Call**:
```typescript
const { data, error } = await supabase
  .from('business_fleet')
  .update({ assigned_driver_id: selectedDriverId })
  .eq('id', vehicleId)
  .eq('business_id', currentUser.business_id) // RLS enforcement
  .select()
  .single()
```

**Driver Selection**:
- Query `driver_profiles` WHERE:
  - `managed_by_business_id = current_business_id`
  - `employment_type = 'fleet_driver'`
  - `vehicle_type_id` matches vehicle's type (optional constraint)

**Business Can**:
- Assign one driver per vehicle
- Reassign drivers
- Unassign drivers (set to NULL)

**Note**: Driver assignment is NOT permanent. Drivers can be reassigned anytime.

---

### Scenario D: Driver Leaves Fleet

**Driver App Flow**:
1. Driver navigates to Profile → Fleet Settings
2. Taps "Leave Fleet"
3. Confirms action

**API Call**:
```typescript
const { data, error } = await supabase
  .from('driver_profiles')
  .update({
    employment_type: 'independent',
    managed_by_business_id: null
  })
  .eq('id', currentDriver.id)
  .eq('user_id', auth.uid()) // RLS enforcement
  .select()
  .single()
```

**Business Impact**:
- Driver no longer receives priority for business deliveries
- Driver is unassigned from any vehicles
- Business loses access to driver (unless re-invited)

**Constraint**: Driver CANNOT leave fleet if they have active deliveries:
```sql
-- Prevent leaving during active delivery
ALTER TABLE driver_profiles
  ADD CONSTRAINT no_employment_change_during_delivery
  CHECK (
    current_status != 'busy' OR employment_type = employment_type
  );
```

---

## 🔐 Security & RLS Policies

### Business Users

**Can View**:
- Their own business account
- Their own fleet vehicles
- Their own deliveries
- Their own invitation codes
- Drivers managed by their business

**Can Modify**:
- Their business account details (if owner/admin)
- Their fleet vehicles
- Their invitation codes
- Assign drivers to deliveries (manual mode)

**Cannot Access**:
- Other businesses' data
- Independent drivers (except public pool during assignment)
- Other businesses' fleet vehicles (except public mode when idle)

### Drivers

**Can View**:
- Their own driver profile
- Deliveries assigned to them
- Their managing business's name (if fleet driver)

**Can Modify**:
- Their location, availability status
- Delivery status (when assigned)
- Their profile details (name, photo, phone)

**Cannot Modify**:
- `employment_type` (only Edge Functions can change)
- `managed_by_business_id` (only Edge Functions can change)
- Other drivers' data
- Business fleet data

**Edge Cases**:
- Driver switching employment type mid-delivery: PREVENTED via constraint
- Driver accepting invitation while already in fleet: PREVENTED via validation
- Business deleting vehicle with active delivery: CASCADE handled in database

---

## 📊 Fleet Management Page Requirements

### Page Structure

**Route**: `/business/fleet`

**Current Status**: Empty file (`src/app/business/fleet/page.tsx`)

**Required Tabs**:

1. **My Fleet** (Vehicles)
   - Grid/table view of all vehicles
   - Add Vehicle button
   - Vehicle cards showing:
     - Photo/icon, make, model, year, plate number
     - Assigned driver (avatar, name)
     - Status badge (idle, busy, offline, maintenance)
     - Access mode badge (private, public)
     - Actions: Edit, Delete, Assign Driver

2. **Fleet Drivers**
   - Grid/table view of fleet drivers
   - Invite Partner Driver button
   - Driver cards showing:
     - Avatar, name, rating, total deliveries
     - Assigned vehicle
     - Status badge (online, offline, busy)
     - Actions: View Details, Unassign, Remove from Fleet

3. **Invitation Codes**
   - Table of invitation codes
   - Generate Code button
   - Columns:
     - Code, Created Date, Expires At, Uses (X/Y), Status (Active/Used/Expired)
     - Actions: Copy Code, Deactivate, Delete

### Key Features

**Vehicle Management**:
- Add new vehicle (form modal)
- Edit vehicle details
- Delete vehicle (with confirmation)
- Assign/reassign driver (dropdown)
- Change access mode (toggle: private ↔ public)
- View vehicle analytics (deliveries, distance, earnings)

**Driver Management**:
- View fleet drivers
- Invite partner drivers (generate code)
- Unassign driver from vehicle
- Remove driver from fleet (revert to independent)
- View driver performance (rating, deliveries, on-time %)

**Invitation System**:
- Generate invitation codes
- Set expiration date (7/14/30 days)
- Set max uses (1 or unlimited)
- Copy code to clipboard
- View usage history
- Deactivate/delete codes

**Analytics Dashboard** (optional Phase 2):
- Total fleet size
- Active drivers vs. total
- Fleet utilization rate
- Avg delivery time
- Revenue generated by fleet

---

## 🛠️ Technical Implementation Notes

### Database Functions

**Already Created**:
- ✅ `generate_invitation_code()` - Generates unique FLEET-XXXX-XXXX code
- ✅ `validate_invitation_code(code TEXT)` - Validates code and returns business details
- ✅ `accept_invitation_code(code TEXT, driver_id UUID)` - Accepts invitation and updates driver
- ✅ `find_business_fleet_driver()` - Finds available fleet driver for delivery
- ✅ `find_public_pool_driver()` - Finds available independent driver
- ✅ `update_vehicle_status()` - Updates vehicle status and location

### Edge Functions

**Already Deployed**:
- ✅ `pair-business-driver` - 3-tier driver assignment logic
- ✅ `validate-fleet-invitation` - Validates invitation code
- ✅ `accept-fleet-invitation` - Processes invitation acceptance

### Missing Implementations

**Backend (Supabase)**:
- ✅ Database schema complete
- ✅ Edge functions complete
- ✅ RLS policies complete

**Frontend (Next.js)**:
- ✅ Business signup/login
- ✅ Business dashboard (with real data)
- ✅ Delivery creation form (UI only - needs API integration)
- ❌ **Fleet management page** (EMPTY - needs full implementation)
- ❌ Delivery creation API integration
- ❌ Manual driver assignment UI

**Mobile App (Flutter)**:
- ❌ Fleet invitation acceptance flow
- ❌ Driver status management
- ❌ Delivery status updates

---

## 🚀 Next Steps for Fleet Page

### Phase 1: Core UI (Today)
1. Create basic layout with tabs (My Fleet, Drivers, Invitations)
2. Fetch and display vehicles from `business_fleet`
3. Fetch and display fleet drivers from `driver_profiles`
4. Add Vehicle form modal
5. Generate invitation code button

### Phase 2: Functionality (This Week)
1. CRUD operations for vehicles
2. Assign/unassign driver to vehicle
3. Generate and manage invitation codes
4. Real-time status updates (vehicle/driver online status)

### Phase 3: Advanced Features (Next Week)
1. Fleet analytics dashboard
2. Vehicle performance tracking
3. Driver performance tracking
4. Bulk operations (multi-select vehicles/drivers)
5. Export fleet reports (PDF/CSV)

---

## 📝 Summary

**SwiftDash Delivery Flow**:
1. Business creates delivery → `deliveries` table
2. Edge function assigns driver (3-tier priority) → updates `deliveries.driver_id`, `fleet_vehicle_id`
3. Driver accepts & completes → status updates
4. On completion → driver/vehicle reset to idle/online

**Fleet Management**:
- Businesses can add own vehicles → `business_fleet`
- Businesses can invite partner drivers → `fleet_invitation_codes`
- Drivers accept invitation → `driver_profiles.employment_type = 'fleet_driver'`
- Businesses assign drivers to vehicles → `business_fleet.assigned_driver_id`
- Fleet drivers get priority for business deliveries

**Security**:
- RLS policies enforce business data isolation
- Drivers cannot self-modify employment status
- Only Edge Functions (service_role) can change critical fields
- Constraints prevent state changes during active deliveries

**Current State**:
- ✅ Database schema complete
- ✅ Edge functions deployed
- ✅ Authentication system working
- ✅ Dashboard showing real data
- ⏳ Delivery creation needs API integration
- ❌ Fleet page is EMPTY - ready to build

