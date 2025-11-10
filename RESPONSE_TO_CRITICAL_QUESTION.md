# Response to Critical Question - Driver Offers Table

## 1. Does driver_offers table exist?
[ ] YES - Exists in production
[X] NO - Doesn't exist yet

## 2. Preferred Approach: Direct Assignment via Deliveries Table

Given current time and resource constraints, and to avoid changes to the customer app, we recommend proceeding **without** a `driver_offers` table. Instead, use direct assignment via the existing `deliveries` table for both B2C and B2B flows.

### How it works:
- When a business assigns a driver, update the `deliveries` table directly:
  - Set `driver_id`, `status` (e.g., 'driver_assigned'), `driver_source`, `assignment_type`, `assigned_at`, and `assigned_by`.
- The driver app will poll the `deliveries` table for records where `driver_id = currentDriverId` and `status` is in an active state (e.g., 'driver_assigned', 'going_to_pickup', etc.).
- Use push notifications to alert the driver of new assignments.

**Advantages:**
- No schema changes needed for the customer app
- Fastest path to unblock business admin integration
- Still allows for business/manual assignment logic

**Trade-offs:**
- No granular offer history or audit trail for assignments/rejections
- Less flexibility for future features like offer expiration or multi-offer logic

## 3. How driver app discovers assignments:
[ ] Polling driver_offers every 30 sec
[X] Polling deliveries table (current and recommended)
[ ] Supabase Realtime subscriptions (future enhancement)
[X] Push notifications (to prompt driver to open app)
[ ] Other: N/A

**Details:**
- The driver app polls the `deliveries` table every 30 seconds for new or updated assignments for the logged-in driver.
- Push notifications are used to prompt the driver to open the app, but polling is the reliable mechanism.
- Supabase Realtime subscriptions may be added in the future for instant updates.

## 4. Minimum required fields for assignment:
- `delivery_id` (UUID)
- `driver_id` (UUID)
- `status` (TEXT) - valid values: 'driver_assigned', 'going_to_pickup', 'pickup_arrived', 'package_collected', 'going_to_destination', 'delivered', 'cancelled', 'failed'
- `driver_source` (TEXT, e.g., 'business_dispatch', 'customer_app')
- `assignment_type` (TEXT, e.g., 'manual', 'auto')
- `assigned_at` (TIMESTAMP)
- `assigned_by` (UUID, optional)

## 5. Testing Coordination
- Staging: As soon as the business admin integration is ready
- Production: After successful staging tests

## 6. Next Steps
- Proceed with direct assignment via the `deliveries` table
- Driver app will continue polling `deliveries` for assignments
- No changes required for the customer app
- If/when more advanced assignment/audit features are needed, we can revisit the `driver_offers` table as a future enhancement

**Availability:** Weekdays 2-6 PM PHT for meetings or screenshare.

---

**Thank you for your partnership and quick coordination!**
