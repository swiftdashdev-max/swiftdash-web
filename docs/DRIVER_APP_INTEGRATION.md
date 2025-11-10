# Driver App Integration Guide - Fleet Management Support

**Document Version:** 1.0  
**Date:** November 3, 2025  
**Purpose:** Coordinate driver app changes for B2B fleet management integration

---

## 📋 Overview

The web admin (SwiftDash Admin) now supports **B2B fleet management** where businesses can:
- Manage their own vehicle fleets
- Employ drivers directly
- Get priority driver assignment for deliveries

This requires **minimal changes** to the existing driver app, primarily around driver profiles and status management.

---

## 🔄 Database Schema Changes

### **New Columns Added to `driver_profiles`**

```sql
-- Migration 004 (Already deployed)
ALTER TABLE driver_profiles
  ADD COLUMN employment_type VARCHAR(20) DEFAULT 'independent' 
    CHECK (employment_type IN ('independent', 'fleet_driver')),
  ADD COLUMN managed_by_business_id UUID REFERENCES business_accounts(id),
  ADD COLUMN current_status VARCHAR(50) DEFAULT 'offline' 
    CHECK (current_status IN ('online', 'offline', 'busy'));
```

### **Column Descriptions:**

| Column | Type | Values | Purpose |
|--------|------|--------|---------|
| `employment_type` | VARCHAR(20) | `independent` or `fleet_driver` | Is driver self-employed or employed by a business? |
| `managed_by_business_id` | UUID | NULL or business ID | Which business employs this driver (NULL for independent) |
| `current_status` | VARCHAR(50) | `online`, `offline`, `busy` | Replaces/complements `is_available` boolean |

### **New Column in `deliveries`**

```sql
-- Migration 007 (Already deployed)
ALTER TABLE deliveries 
  ADD COLUMN driver_source VARCHAR(50);
```

**Values:** `private_fleet`, `public_fleet`, `independent_driver`, `other_business_fleet`

---

## 🚗 Driver Types

### **Type 1: Independent Driver** (Existing - No Changes)
- `employment_type = 'independent'`
- `managed_by_business_id = NULL`
- Works for themselves
- Receives deliveries from global pool
- **App Flow:** Same as current implementation ✅

### **Type 2: Fleet Driver** (New)
- `employment_type = 'fleet_driver'`
- `managed_by_business_id = <business_uuid>`
- Employed by a specific business
- Gets **priority** for their business's deliveries
- Can also accept public deliveries when available
- **App Flow:** Mostly same, minor UI additions

---

## 📱 Driver App Questions

To ensure smooth integration, we need to understand your current driver app:

### **1. Current Driver Onboarding Flow**
- [ ] How does a new driver sign up?
- [ ] What authentication method? (Supabase Auth, custom, etc.)
- [ ] What profile information is collected?
- [ ] Is there an approval/verification process?

### **2. Delivery Assignment Flow**
- [ ] How does the driver receive delivery offers?
  - Push notifications?
  - Real-time subscriptions?
  - Polling?
- [ ] What does the "Accept Delivery" function do?
  - Direct database update?
  - Call an Edge Function?
  - Update multiple tables?

### **3. Current Status Management**
- [ ] How is `is_available` currently set?
  - Manual toggle by driver?
  - Automatic based on delivery status?
  - Both?
- [ ] How is `is_online` managed?
  - App open/close?
  - Manual toggle?
  - Background service?

### **4. Delivery Lifecycle**
- [ ] What happens when driver accepts delivery?
- [ ] How is "Start Delivery" handled?
- [ ] How is "Complete Delivery" handled?
- [ ] Are there intermediate statuses? (picked_up, in_transit, etc.)

### **5. Location Tracking**
- [ ] How often is `current_latitude`/`current_longitude` updated?
- [ ] Continuous tracking or periodic updates?
- [ ] Does it stop when driver is offline?

### **6. Earnings & Payments**
- [ ] Is there a `driver_earnings` table integration?
- [ ] How are earnings calculated currently?
- [ ] Any payment gateway integration?

### **7. Technology Stack**
- [ ] What framework? (React Native, Flutter, Native, etc.)
- [ ] Supabase client library version?
- [ ] State management? (Redux, Context, etc.)
- [ ] Real-time subscriptions used?

---

## 🔧 Required Driver App Changes

### **Priority 1: Must Implement** ⚠️

#### **A. Update Delivery Completion Logic**

**Current (Assumed):**
```typescript
async function completeDelivery(deliveryId: string) {
  await supabase
    .from('deliveries')
    .update({ status: 'completed' })
    .eq('id', deliveryId)
  
  // Set driver available
  await supabase
    .from('driver_profiles')
    .update({ is_available: true })
    .eq('id', currentDriverId)
}
```

**Updated (Required):**
```typescript
async function completeDelivery(deliveryId: string) {
  // Get delivery details
  const { data: delivery } = await supabase
    .from('deliveries')
    .select('fleet_vehicle_id, business_id')
    .eq('id', deliveryId)
    .single()

  // Mark delivery complete
  await supabase
    .from('deliveries')
    .update({ 
      status: 'completed',
      completed_at: new Date().toISOString()
    })
    .eq('id', deliveryId)

  // Reset driver status to online
  await supabase
    .from('driver_profiles')
    .update({ 
      current_status: 'online',
      is_available: true // Keep for backward compatibility
    })
    .eq('id', currentDriverId)

  // ⭐ NEW: If fleet vehicle, reset vehicle status
  if (delivery.fleet_vehicle_id) {
    await supabase
      .from('business_fleet')
      .update({ current_status: 'idle' })
      .eq('id', delivery.fleet_vehicle_id)
  }
}
```

#### **B. Update Driver Status Management**

Add `current_status` updates alongside existing `is_available`:

```typescript
// When driver goes online
async function goOnline() {
  await supabase
    .from('driver_profiles')
    .update({ 
      is_online: true,
      is_available: true,
      current_status: 'online' // ⭐ NEW
    })
    .eq('id', currentDriverId)
}

// When driver goes offline
async function goOffline() {
  await supabase
    .from('driver_profiles')
    .update({ 
      is_online: false,
      is_available: false,
      current_status: 'offline' // ⭐ NEW
    })
    .eq('id', currentDriverId)
}

// When driver accepts delivery
async function acceptDelivery(deliveryId: string) {
  await supabase
    .from('deliveries')
    .update({ status: 'driver_assigned' })
    .eq('id', deliveryId)

  await supabase
    .from('driver_profiles')
    .update({ 
      is_available: false,
      current_status: 'busy' // ⭐ NEW
    })
    .eq('id', currentDriverId)
}
```

---

### **Priority 2: Should Implement** ✅

#### **C. Show Fleet Driver Badge (UI Only)**

Add visual indicator for fleet drivers:

```typescript
// In driver profile screen
function DriverProfile() {
  const { data: profile } = useDriverProfile()
  
  return (
    <View>
      <Text>{profile.name}</Text>
      
      {/* ⭐ NEW: Fleet driver indicator */}
      {profile.employment_type === 'fleet_driver' && (
        <Badge color="blue">
          Fleet Driver - {profile.business_name}
        </Badge>
      )}
      
      <Text>Rating: {profile.rating}</Text>
    </View>
  )
}
```

#### **D. Show Delivery Source (Optional Enhancement)**

Help drivers understand delivery priority:

```typescript
// In delivery offer card
function DeliveryOfferCard({ delivery }) {
  const { data: driver } = useDriverProfile()
  
  // Check if this is from driver's own fleet
  const isPriority = delivery.business_id === driver.managed_by_business_id
  
  return (
    <Card>
      <Text>Pickup: {delivery.pickup_address}</Text>
      <Text>Delivery: {delivery.delivery_address}</Text>
      <Text>Payment: ₱{delivery.total_amount}</Text>
      
      {/* ⭐ NEW: Priority indicator */}
      {isPriority && (
        <Tag color="green">⭐ Priority Delivery - Your Fleet</Tag>
      )}
      
      <Button onPress={() => acceptDelivery(delivery.id)}>
        Accept
      </Button>
    </Card>
  )
}
```

---

### **Priority 3: Future Enhancements** 💡

#### **E. Fleet Driver Invitation Flow**

Allow businesses to invite drivers:

1. Business admin sends invitation with code
2. Driver signs up with invitation code
3. System automatically sets:
   - `employment_type = 'fleet_driver'`
   - `managed_by_business_id = <business_id>`

#### **F. Earnings Breakdown**

Show different rates for fleet vs public deliveries:

```typescript
function EarningsScreen() {
  return (
    <View>
      <Text>Fleet Deliveries: ₱5,000 (salary)</Text>
      <Text>Public Deliveries: ₱2,500 (commission)</Text>
      <Text>Total: ₱7,500</Text>
    </View>
  )
}
```

---

## 🔌 New Edge Function Integration

### **Business Driver Pairing**

A new Edge Function `pair-business-driver` handles B2B delivery assignment.

**Your existing driver app doesn't need to call this** - it's called by the business dashboard.

However, drivers will receive delivery offers from this function the same way they do from the global `pair-driver` function.

---

## ✅ Migration Checklist

- [ ] Run migration 004 (adds employment_type, managed_by_business_id, current_status)
- [ ] Run migration 007 (adds driver_source to deliveries)
- [ ] Update delivery completion logic (reset current_status)
- [ ] Update driver online/offline logic (set current_status)
- [ ] Update delivery acceptance logic (set current_status = 'busy')
- [ ] Add fleet driver badge in profile UI (optional)
- [ ] Add priority delivery indicator (optional)
- [ ] Test with both independent and fleet drivers

---

## 🧪 Testing Scenarios

### **Test Case 1: Independent Driver (No Changes)**
1. Driver signs up normally
2. Goes online
3. Receives delivery offer
4. Accepts delivery
5. Completes delivery
6. **Expected:** Works exactly as before ✅

### **Test Case 2: Fleet Driver (New)**
1. Driver signs up with fleet invitation
2. Goes online (`current_status = 'online'`)
3. Receives priority delivery from their fleet
4. Accepts delivery (`current_status = 'busy'`)
5. Completes delivery
6. **Expected:** 
   - Driver status → `online`
   - Vehicle status → `idle`
   - Can receive new deliveries ✅

---

## 📞 Coordination Needed

Please provide answers to the questions in the **"Driver App Questions"** section above so we can:

1. Ensure smooth integration
2. Identify any conflicts with current implementation
3. Plan the rollout strategy
4. Create detailed implementation guide specific to your codebase

---

## � API Contract & Data Flow

### **What the Driver App Receives (No Changes)**

Delivery offers will continue to come through your existing mechanism, but with additional fields:

```typescript
// Delivery object structure
{
  id: "uuid",
  pickup_latitude: 14.5547,
  pickup_longitude: 121.0244,
  delivery_latitude: 14.5647,
  delivery_longitude: 121.0344,
  status: "driver_offered" | "driver_assigned" | "completed",
  total_amount: 250.00,
  distance_km: 5.2,
  
  // ⭐ NEW FIELDS (may be null for consumer deliveries)
  business_id: "uuid" | null,           // Which business created this
  fleet_vehicle_id: "uuid" | null,      // Which fleet vehicle (if applicable)
  driver_source: "private_fleet" | "public_fleet" | "independent_driver" | null,
  assignment_type: "auto" | "manual"     // How driver was assigned
}
```

### **What the Driver App Sends (Updated)**

When updating driver status, include `current_status`:

```typescript
// Example: Going online
PATCH /rest/v1/driver_profiles?id=eq.{driver_id}
{
  "is_online": true,
  "is_available": true,
  "current_status": "online"  // ⭐ NEW
}

// Example: Accepting delivery
PATCH /rest/v1/driver_profiles?id=eq.{driver_id}
{
  "is_available": false,
  "current_status": "busy"    // ⭐ NEW
}

// Example: Completing delivery
PATCH /rest/v1/driver_profiles?id=eq.{driver_id}
{
  "is_available": true,
  "current_status": "online"  // ⭐ NEW
}
```

---

## 🔄 Real-Time Subscription Updates

### **Current Subscriptions (Assumed)**

If you're using Supabase real-time subscriptions:

```typescript
// Existing subscription for delivery offers
supabase
  .channel('delivery-offers')
  .on('postgres_changes', 
    { 
      event: 'UPDATE', 
      schema: 'public', 
      table: 'deliveries',
      filter: `driver_id=eq.${currentDriverId}`
    },
    (payload) => handleDeliveryOffer(payload.new)
  )
  .subscribe()
```

**No changes needed** - this will continue to work! ✅

### **Optional: Subscribe to Fleet Vehicle Status**

For fleet drivers who want to monitor their assigned vehicle:

```typescript
// NEW: Subscribe to fleet vehicle updates
supabase
  .channel('fleet-vehicle')
  .on('postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'business_fleet',
      filter: `assigned_driver_id=eq.${currentDriverId}`
    },
    (payload) => {
      console.log('Vehicle status changed:', payload.new.current_status)
    }
  )
  .subscribe()
```

---

## 🚨 Breaking Changes & Backward Compatibility

### **Breaking Changes: NONE** ✅

All new columns have default values:
- `employment_type` defaults to `'independent'`
- `managed_by_business_id` defaults to `NULL`
- `current_status` defaults to `'offline'`

**Existing drivers will continue to work without any code changes.**

### **Backward Compatibility Strategy**

```typescript
// Old code (still works)
await supabase
  .from('driver_profiles')
  .update({ is_available: true })
  .eq('id', driverId)

// New code (recommended)
await supabase
  .from('driver_profiles')
  .update({ 
    is_available: true,
    current_status: 'online'  // Also set new field
  })
  .eq('id', driverId)
```

Both approaches work! Gradually migrate to new fields.

---

## 🛠️ Development Environment Setup

### **For Driver Team Testing**

1. **Get database access:**
   - Request Supabase project URL
   - Request test environment credentials
   - Verify migrations 004 & 007 are deployed

2. **Create test data:**

```sql
-- Create test business account
INSERT INTO business_accounts (business_name, business_email)
VALUES ('Test Logistics Inc', 'test@logistics.com');

-- Create test fleet vehicle
INSERT INTO business_fleet (
  business_id, 
  vehicle_type_id, 
  plate_number,
  access_mode,
  current_status
) VALUES (
  '<business_id>',
  '<vehicle_type_id>',
  'TEST-123',
  'private',
  'idle'
);

-- Convert test driver to fleet driver
UPDATE driver_profiles
SET 
  employment_type = 'fleet_driver',
  managed_by_business_id = '<business_id>'
WHERE id = '<your_test_driver_id>';
```

3. **Test scenarios:**
   - [ ] Independent driver receives consumer delivery
   - [ ] Fleet driver receives priority business delivery
   - [ ] Fleet driver completes delivery (vehicle status resets)
   - [ ] Independent driver receives business delivery (fallback)

---

## 📊 Monitoring & Observability

### **Key Metrics to Track**

Help us monitor the integration:

```sql
-- Fleet driver adoption rate
SELECT 
  employment_type,
  COUNT(*) as driver_count,
  AVG(rating) as avg_rating
FROM driver_profiles
GROUP BY employment_type;

-- Driver source distribution (for businesses)
SELECT 
  driver_source,
  COUNT(*) as delivery_count,
  AVG(total_amount) as avg_amount
FROM deliveries
WHERE business_id IS NOT NULL
GROUP BY driver_source;

-- Status distribution
SELECT 
  current_status,
  COUNT(*) as driver_count
FROM driver_profiles
WHERE employment_type = 'fleet_driver'
GROUP BY current_status;
```

### **Error Scenarios to Log**

Please log these scenarios for debugging:

1. **Fleet vehicle status mismatch:**
   ```
   Delivery completed but vehicle still shows 'busy'
   ```

2. **Driver status inconsistency:**
   ```
   Driver shows 'busy' but has no active delivery
   ```

3. **Missing business_id:**
   ```
   Fleet driver assigned to delivery with business_id = NULL
   ```

---

## 🔐 Security & Permissions

### **Row-Level Security (RLS) Notes**

The admin dashboard uses **service_role** key for business operations.

The driver app should continue using **anon/authenticated** keys with these policies:

```sql
-- Drivers can update their own profile
CREATE POLICY driver_update_own ON driver_profiles
  FOR UPDATE
  USING (id = auth.uid());

-- Drivers can view deliveries assigned to them
CREATE POLICY driver_view_own_deliveries ON deliveries
  FOR SELECT
  USING (driver_id = auth.uid());
```

**Important:** Drivers should NOT be able to:
- ❌ View other drivers' profiles
- ❌ Modify `employment_type` or `managed_by_business_id` directly
- ❌ View business_fleet table details

---

## 🐛 Known Issues & Workarounds

### **Issue 1: Legacy `is_online` vs `current_status`**

**Problem:** Two fields tracking similar state  
**Workaround:** Update both fields during transition period  
**Long-term:** Deprecate `is_online` after 3 months

### **Issue 2: Driver Completion Race Condition**

**Problem:** Driver completes delivery before vehicle status updates  
**Solution:** Use database transaction:

```typescript
const { error } = await supabase.rpc('complete_delivery_transaction', {
  p_delivery_id: deliveryId,
  p_driver_id: currentDriverId
});
```

We can provide this helper function if needed.

---

## 📞 Coordination Needed

Please provide answers to the questions in the **"Driver App Questions"** section above so we can:

1. Ensure smooth integration
2. Identify any conflicts with current implementation
3. Plan the rollout strategy
4. Create detailed implementation guide specific to your codebase

### **Response Format**

Please reply with:

```markdown
## Driver App Current State

### 1. Onboarding Flow
[Your answer here]

### 2. Delivery Assignment
[Your answer here]

### 3. Status Management
[Your answer here]

### 4. Technology Stack
- Framework: [e.g., React Native]
- Supabase Client: [version]
- State Management: [e.g., Redux]
- Real-time: [Yes/No]

### 5. Timeline
- Review completed: [Date]
- Implementation start: [Date]
- Testing start: [Date]
- Production deploy: [Date]

### 6. Concerns/Blockers
[List any concerns or blockers]
```

---

## �📚 Related Documents

- **Database Migrations:** `supabase/migrations/004_modify_existing_tables.sql`
- **Driver Source Migration:** `supabase/migrations/007_add_driver_source.sql`
- **Edge Function:** `supabase/functions/pair-business-driver/index.ts`
- **Migration Guide:** `supabase/MIGRATION_GUIDE.md`

---

## 🤝 Next Steps

### **Week 1: Discovery**
1. **Driver Team:** Review this document thoroughly
2. **Driver Team:** Answer all questions in "Driver App Questions" section
3. **Both Teams:** Schedule 1-hour sync meeting

### **Week 2: Planning**
4. **Both Teams:** Discuss integration approach in sync meeting
5. **Admin Team:** Provide helper functions if needed
6. **Driver Team:** Create implementation plan with timeline

### **Week 3-4: Implementation**
7. **Driver Team:** Implement Priority 1 changes
8. **Admin Team:** Provide testing support
9. **Both Teams:** Daily standups for blockers

### **Week 5: Testing**
10. **Driver Team:** Test with sample fleet drivers in staging
11. **Admin Team:** Test end-to-end business → driver flow
12. **QA Team:** Regression testing for existing flows

### **Week 6: Deployment**
13. **Both Teams:** Production deployment plan
14. **Both Teams:** Monitor metrics post-deployment
15. **Both Teams:** Retrospective meeting

---

## 📞 Contact & Support

**Admin Team Lead:** [Your Name]  
**Driver Team Lead:** [TBD]  

**Slack Channels:**
- `#fleet-management-integration` - General discussion
- `#driver-app-dev` - Driver team technical discussion
- `#incidents` - Production issues

**Meeting Schedule:**
- Integration Syncs: [TBD - Propose time]
- Daily Standups: [TBD - During implementation]

---

**Questions or concerns?** Let's discuss! 🚀

---

## 📎 Appendix: Sample Responses

### **Example: Complete Delivery Function**

Here's a complete example implementation for reference:

```typescript
/**
 * Complete delivery and reset driver + vehicle status
 * @param deliveryId - UUID of delivery to complete
 */
export async function completeDelivery(deliveryId: string): Promise<void> {
  try {
    // 1. Get delivery details
    const { data: delivery, error: fetchError } = await supabase
      .from('deliveries')
      .select('driver_id, fleet_vehicle_id, business_id, total_amount')
      .eq('id', deliveryId)
      .single();

    if (fetchError) throw fetchError;

    // 2. Mark delivery as completed
    const { error: updateError } = await supabase
      .from('deliveries')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', deliveryId);

    if (updateError) throw updateError;

    // 3. Reset driver status to online
    const { error: driverError } = await supabase
      .from('driver_profiles')
      .update({
        current_status: 'online',
        is_available: true
      })
      .eq('id', delivery.driver_id);

    if (driverError) throw driverError;

    // 4. Reset fleet vehicle status (if applicable)
    if (delivery.fleet_vehicle_id) {
      const { error: vehicleError } = await supabase
        .from('business_fleet')
        .update({
          current_status: 'idle',
          total_deliveries: supabase.raw('total_deliveries + 1')
        })
        .eq('id', delivery.fleet_vehicle_id);

      if (vehicleError) throw vehicleError;
    }

    // 5. Record earnings (your existing logic)
    await recordDriverEarnings(delivery.driver_id, deliveryId, delivery.total_amount);

    console.log(`✅ Delivery ${deliveryId} completed successfully`);
  } catch (error) {
    console.error('❌ Error completing delivery:', error);
    throw error;
  }
}
```

### **Example: Go Online Function**

```typescript
export async function goOnline(driverId: string): Promise<void> {
  const { error } = await supabase
    .from('driver_profiles')
    .update({
      is_online: true,
      is_available: true,
      current_status: 'online',
      location_updated_at: new Date().toISOString()
    })
    .eq('id', driverId);

  if (error) throw error;
  console.log('✅ Driver is now online');
}
```

### **Example: Accept Delivery Function**

```typescript
export async function acceptDelivery(deliveryId: string, driverId: string): Promise<void> {
  // Update delivery status
  const { error: deliveryError } = await supabase
    .from('deliveries')
    .update({ status: 'driver_assigned' })
    .eq('id', deliveryId)
    .eq('driver_id', driverId); // Security: only assigned driver can accept

  if (deliveryError) throw deliveryError;

  // Set driver as busy
  const { error: driverError } = await supabase
    .from('driver_profiles')
    .update({
      current_status: 'busy',
      is_available: false
    })
    .eq('id', driverId);

  if (driverError) throw driverError;

  console.log('✅ Delivery accepted');
}
```

---

## 📡 API Documentation

### **Edge Function: pair-business-driver**

**Purpose:** Assign a driver to a business delivery with fleet priority logic

**Endpoint:** `https://<your-project>.supabase.co/functions/v1/pair-business-driver`

**Method:** `POST`

**Authentication:** Required (Bearer token)

**Headers:**
```
Authorization: Bearer <supabase-anon-key>
Content-Type: application/json
```

**Request Body:**
```json
{
  "delivery_id": "string (UUID)",
  "business_id": "string (UUID)",
  "mode": "auto | manual (optional, default: auto)",
  "driver_id": "string (UUID, required if mode=manual)"
}
```

**Response (Success):**
```json
{
  "success": true,
  "delivery_id": "string",
  "driver_id": "string",
  "driver_source": "private_fleet | public_fleet | independent_driver",
  "assignment_type": "auto | manual",
  "message": "string",
  "details": {
    "driver_name": "string",
    "driver_phone": "string",
    "current_latitude": "number",
    "current_longitude": "number",
    "distance_km": "number",
    "vehicle_id": "string (optional)",
    "vehicle_plate": "string (optional)"
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "string",
  "code": "NO_DRIVERS_AVAILABLE | INVALID_DELIVERY | DRIVER_UNAVAILABLE | UNAUTHORIZED"
}
```

**Assignment Priority:**
1. **Tier 1:** Private fleet drivers (business's own drivers)
2. **Tier 2:** Public fleet drivers (shared pool)
3. **Tier 3:** Independent drivers (fallback to global pool)

**Example cURL:**
```bash
curl -X POST 'https://<project>.supabase.co/functions/v1/pair-business-driver' \
  -H 'Authorization: Bearer <anon-key>' \
  -H 'Content-Type: application/json' \
  -d '{
    "delivery_id": "123e4567-e89b-12d3-a456-426614174000",
    "business_id": "987fcdeb-51a2-43f7-9c4d-8e1234567890",
    "mode": "auto"
  }'
```

---

### **Edge Function: validate-fleet-invitation**

**Purpose:** Validate an invitation code before driver accepts it

**Endpoint:** `https://<your-project>.supabase.co/functions/v1/validate-fleet-invitation`

**Method:** `POST`

**Authentication:** Required (Driver must be logged in)

**Headers:**
```
Authorization: Bearer <user-jwt-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "code": "string (e.g., FLEET-X7K2-M9P4)"
}
```

**Response (Valid Code):**
```json
{
  "valid": true,
  "business_id": "string",
  "business_name": "string",
  "business_tier": "starter | professional | enterprise",
  "expires_at": "string (ISO 8601 timestamp)"
}
```

**Response (Invalid Code):**
```json
{
  "valid": false,
  "error": "Invalid invitation code | Invitation code has expired | Invitation code has already been used | Business account is not active"
}
```

**Example Usage (Dart/Flutter):**
```dart
// Validate invitation code
final response = await supabase.functions.invoke(
  'validate-fleet-invitation',
  body: {'code': invitationCode},
);

final data = response.data as Map<String, dynamic>;

if (data['valid'] == true) {
  // Show confirmation dialog
  showDialog(
    context: context,
    builder: (context) => AlertDialog(
      title: Text('Join Fleet?'),
      content: Text('Join ${data['business_name']}?'),
      actions: [
        TextButton(
          onPressed: () => acceptInvitation(invitationCode),
          child: Text('Accept'),
        ),
      ],
    ),
  );
}
```

---

### **Edge Function: accept-fleet-invitation**

**Purpose:** Accept invitation and join business fleet

**Endpoint:** `https://<your-project>.supabase.co/functions/v1/accept-fleet-invitation`

**Method:** `POST`

**Authentication:** Required (Driver must be logged in)

**Headers:**
```
Authorization: Bearer <user-jwt-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "code": "string (invitation code)",
  "driver_id": "string (driver's profile UUID)"
}
```

**Response (Success):**
```json
{
  "success": true,
  "business_id": "string",
  "business_name": "string",
  "message": "string (e.g., Successfully joined Acme Logistics)"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Driver is already part of another fleet | Driver profile not found | Unauthorized: Driver profile does not belong to you | Invalid invitation code"
}
```

**Security:**
- Validates driver_id belongs to authenticated user
- Prevents drivers from joining multiple fleets
- Marks invitation code as used
- Creates audit log entry

**Example Usage (Dart/Flutter):**
```dart
// Accept invitation
Future<void> acceptInvitation(String code) async {
  final response = await supabase.functions.invoke(
    'accept-fleet-invitation',
    body: {
      'code': code,
      'driver_id': currentDriver.id,
    },
  );

  final data = response.data as Map<String, dynamic>;

  if (data['success'] == true) {
    // Update local state
    setState(() {
      currentDriver.employmentType = 'fleet';
      currentDriver.managedByBusinessId = data['business_id'];
    });

    // Show success message
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(data['message'])),
    );
  }
}
```

---

## 🔄 Updated RLS Policy Examples

**Important:** The driver app uses `driver_profiles.user_id → auth.users.id` pattern, NOT `driver_profiles.id = auth.uid()`.

### **Correct Pattern:**
```sql
-- Driver can view their own profile
CREATE POLICY "driver_view_own_profile"
ON driver_profiles
FOR SELECT
USING (user_id = auth.uid());

-- Driver can update their own profile
CREATE POLICY "driver_update_own_profile"
ON driver_profiles
FOR UPDATE
USING (user_id = auth.uid());

-- Driver can view deliveries assigned to them
CREATE POLICY "driver_view_assigned_deliveries"
ON deliveries
FOR SELECT
USING (
  driver_id IN (
    SELECT id FROM driver_profiles 
    WHERE user_id = auth.uid()
  )
);
```

### **Incorrect Pattern (Don't Use):**
```sql
-- ❌ WRONG - Assumes driver_profiles.id = auth.uid()
USING (id = auth.uid())

-- ✅ CORRECT - Uses user_id foreign key
USING (user_id = auth.uid())
```

````
}
```
