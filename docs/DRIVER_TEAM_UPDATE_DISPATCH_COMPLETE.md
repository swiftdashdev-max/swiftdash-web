# Driver Team Update: Business Dispatch Integration Complete

**Date:** November 9, 2025  
**From:** Business Admin Team  
**To:** Driver App Team  
**Priority:** HIGH - Integration Ready for Testing

---

## ✅ Business Dispatch Integration - COMPLETED & DEPLOYED

We have successfully implemented and deployed the business dispatch system using the **direct assignment approach** you recommended (via `deliveries` table, NO `driver_offers` table).

---

## 🚀 What's Live in Production

### 1. Database Changes (Migration 012)
**New columns in `deliveries` table:**
- `assigned_at TIMESTAMPTZ NULL` - Timestamp when driver was assigned
- `assigned_by UUID REFERENCES user_profiles(id)` - Dispatcher who assigned
- Auto-trigger: `assigned_at` is automatically set when `driver_id` changes from NULL to a value

**Indexes added:**
- `idx_deliveries_assignment_tracking` - For analytics queries
- `idx_deliveries_driver_assignment_time` - For driver assignment history

### 2. Edge Function: `assign-business-driver` (DEPLOYED)
**Endpoint:** `https://[your-project].supabase.co/functions/v1/assign-business-driver`

**What it does:**
1. ✅ Validates driver exists and `current_status = 'online'`
2. ✅ Validates delivery exists, `status = 'pending'`, not already assigned
3. ✅ Updates `deliveries` table:
   ```sql
   driver_id = {selected_driver}
   status = 'driver_assigned'
   driver_source = 'business_dispatch'
   assignment_type = 'manual'
   assigned_by = {dispatcher_user_id}
   assigned_at = {current_timestamp}
   ```
4. ✅ Updates `driver_profiles` table:
   ```sql
   current_status = 'busy'
   current_delivery_id = {delivery_id}
   ```
5. ✅ Prepares FCM notification payload (see below)
6. ✅ Atomic transaction with rollback on failure

**Request Format:**
```json
POST /functions/v1/assign-business-driver
{
  "delivery_id": "uuid",
  "driver_id": "uuid",
  "assigned_by": "uuid",
  "assignment_type": "manual"
}
```

**Response Format:**
```json
{
  "success": true,
  "message": "Driver assigned successfully",
  "data": {
    "delivery_id": "uuid",
    "driver_id": "uuid",
    "status": "driver_assigned",
    "assigned_at": "2025-11-09T10:30:00Z"
  }
}
```

---

## 📱 ACTION REQUIRED: Driver App Integration

### How Driver App Should Discover Assignments

You mentioned drivers poll the `deliveries` table every 30 seconds. Here's what to query:

```sql
SELECT * FROM deliveries
WHERE driver_id = {current_driver_id}
  AND status = 'driver_assigned'
  AND driver_source = 'business_dispatch'
ORDER BY assigned_at DESC
LIMIT 10
```

**Key fields to check:**
- `driver_id` = your driver's ID
- `status` = 'driver_assigned' (new assignment from business)
- `driver_source` = 'business_dispatch' (vs 'customer_booking')
- `assignment_type` = 'manual' (dispatcher selected you)
- `assigned_at` = when assignment happened
- `assigned_by` = dispatcher who assigned (for audit trail)

### FCM Push Notification Payload (READY TO IMPLEMENT)

The edge function already prepares this payload structure. **You need to:**
1. Ensure `fcm_token` column exists in `driver_profiles` table
2. Driver app uploads FCM token on app launch
3. Listen for this notification format:

```json
{
  "notification": {
    "title": "New Business Delivery Assigned",
    "body": "Pickup: {business_name} - ₱{total_amount}"
  },
  "data": {
    "type": "business_delivery_assigned",
    "delivery_id": "uuid",
    "business_name": "ABC Logistics",
    "business_id": "uuid",
    "pickup_address": "123 Business St",
    "dropoff_address": "456 Customer Ave",
    "total_amount": "500",
    "priority": "normal",
    "assignment_type": "manual",
    "auto_accept": "true"
  }
}
```

**Note:** FCM integration is NOT yet implemented in the edge function (Firebase Admin SDK needs setup). For now, **polling every 30 seconds is the primary discovery method**. FCM will be added as an enhancement.

---

## 🔄 Status Flow for Business Deliveries

```
pending (business creates)
  ↓
driver_assigned (business dispatcher assigns via matching/page.tsx)
  ↓
going_to_pickup (driver accepts and starts pickup)
  ↓
arrived_at_pickup (driver arrives at business)
  ↓
picked_up (driver picks up package)
  ↓
going_to_dropoff (driver heads to customer)
  ↓
arrived_at_dropoff (driver arrives at customer)
  ↓
delivered (driver completes delivery)
```

**Driver app should:**
- Show "New Business Delivery" notification when status = 'driver_assigned'
- Display business name, pickup address, dropoff address, amount
- Allow driver to accept → transition to 'going_to_pickup'
- Follow standard delivery workflow after acceptance

---

## 🧪 Testing Requirements

### Test Scenario 1: Happy Path
1. Business creates delivery (status = 'pending', driver_id = NULL)
2. Dispatcher goes to /business/matching page
3. Sees pending delivery and online drivers
4. Clicks "Assign Driver" on driver card
5. Edge function validates and assigns
6. **Driver app should:**
   - Detect new assignment within 30 seconds (polling)
   - Show notification: "New Business Delivery Assigned"
   - Display delivery details
   - Allow acceptance

### Test Scenario 2: Driver Offline
1. Dispatcher tries to assign to offline driver
2. Edge function returns error: "Driver is currently offline"
3. Dispatch page shows error toast
4. **Driver app:** No action needed

### Test Scenario 3: Already Assigned
1. Dispatcher tries to assign already-assigned delivery
2. Edge function returns error: "Delivery is already assigned"
3. Dispatch page shows error toast
4. **Driver app:** No duplicate notifications

### Test Scenario 4: Driver Goes Busy
1. Driver accepts delivery
2. `driver_profiles.current_status` = 'busy'
3. `driver_profiles.current_delivery_id` = assigned delivery ID
4. **Driver app should:**
   - Update local state to 'busy'
   - Show active delivery screen
   - Hide driver from new assignments

---

## 📊 Database Fields Driver App Should Track

### In `deliveries` table:
- `driver_id` - Your driver's ID (NULL = unassigned)
- `status` - Current delivery status
- `driver_source` - 'business_dispatch' or 'customer_booking'
- `assignment_type` - 'manual' or 'auto'
- `assigned_at` - When you were assigned
- `assigned_by` - Who assigned you (for support queries)

### In `driver_profiles` table:
- `current_status` - 'online', 'busy', 'offline'
- `current_delivery_id` - Active delivery ID (NULL = available)
- `fcm_token` - Upload on app launch for push notifications

---

## 🚨 Known Issues & Notes

1. **FCM Not Yet Implemented:** Edge function prepares payload but doesn't send. Polling is primary method.
2. **No Auto-Accept:** Driver must manually accept assignment (driver app decides UX).
3. **Rollback Works:** If driver status update fails, delivery assignment is rolled back.
4. **Atomic Transaction:** Either both tables update or neither (data consistency guaranteed).

---

## 📅 Next Steps

### Driver Team Actions:
1. **Verify polling query** - Ensure you're checking `driver_source = 'business_dispatch'`
2. **Test in staging** - We can create test deliveries and assignments
3. **FCM token management** - Upload token on app launch, refresh on expiry
4. **UI/UX design** - Decide how to show "Business Delivery" vs "Customer Booking"
5. **Schedule integration test** - 2-hour session with our team

### Business Team Actions (Us):
1. ✅ Edge function deployed and live
2. ✅ Dispatch page functional
3. 🔄 Building tracking page next (Ably + Mapbox real-time map)
4. 🔄 FCM integration (4-5 hours, optional enhancement)

---

## 📞 Contact & Coordination

**Ready to test?** Let us know when driver app is ready to:
1. Poll for `driver_assigned` deliveries
2. Display business delivery details
3. Handle acceptance flow

**Questions?** Reply to this document or ping us on Slack.

**Test Environment:** We can provide:
- Test business account credentials
- Test driver account credentials  
- Sample deliveries with real addresses
- Staging Supabase project URL

---

## 📄 Related Documents

- `docs/RESPONSE_TO_BUSINESS_ADMIN_TEAM.md` - Your original response
- `docs/CRITICAL_QUESTION_FOR_DRIVER_TEAM.md` - Our schema question
- `docs/FCM_INTEGRATION_PLAN.md` - Future FCM implementation plan
- `supabase/migrations/012_add_assignment_tracking.sql` - Migration file
- `supabase/functions/assign-business-driver/index.ts` - Edge function code

---

**Status:** ✅ READY FOR DRIVER APP INTEGRATION  
**Deployed:** November 9, 2025  
**Blocking Issues:** None  
**Waiting On:** Driver app polling implementation

Let's coordinate a test session once your polling logic is ready! 🚀
