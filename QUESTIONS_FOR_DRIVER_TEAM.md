# 🚗 Questions for Driver Team - Business Delivery Integration

**Date**: November 7, 2025  
**From**: SwiftDash Business Admin Development Team  
**To**: SwiftDash Driver App Team  
**Purpose**: Clarify integration points for business-to-business (B2B) delivery flow

---

## 📋 **Context**

We're building the **Business Admin web application** that allows businesses to:
1. Create deliveries for their clients
2. Manually assign drivers (or auto-assign using 3-tier priority)
3. Track deliveries in real-time on a map
4. Monitor driver status and location

We've analyzed the **Customer App (B2C) flow** from the DELIVERY_FLOW_GUIDE.md and understand how it works:
- Customer creates delivery → status = `pending`
- Edge function broadcasts to nearby drivers → creates `driver_offers` records
- Sends push notifications
- First driver to accept wins
- Real-time tracking via Ably

**However, for B2B deliveries**, we have a **different flow**:
- Business creates delivery → status = `pending_dispatch`
- **Dispatcher manually assigns** a specific driver (or uses auto-matching)
- No broadcast, no offers, direct assignment
- **We need to understand how the driver app should receive and handle these assignments**

---

## 🔴 **CRITICAL QUESTIONS**

### **1. Driver Assignment & Notification**

#### **Question 1.1: How should we notify drivers about business delivery assignments?**

**Current B2C Flow:**
```javascript
// Create driver_offers record
await supabase.from('driver_offers').insert({
  delivery_id: deliveryId,
  driver_id: driver.id,
  status: 'pending',
  expires_at: new Date(Date.now() + 2 * 60 * 1000)
});

// Send push notification
await sendDriverNotification(driver.id, {
  title: 'New Delivery Offer',
  body: '5.2km - ₱150',
  data: { delivery_id: deliveryId }
});
```

**For B2B, should we:**

**Option A**: Create `driver_offers` record even for manual assignment?
```javascript
// Business dispatcher assigns driver
await supabase.from('driver_offers').insert({
  delivery_id: deliveryId,
  driver_id: selectedDriverId,
  status: 'accepted', // Pre-accepted since it's manually assigned
  accepted_at: new Date()
});

// Send push notification
await sendDriverNotification(selectedDriverId, {
  title: 'New Business Delivery Assigned',
  body: 'Pickup: ABC Corporation - 5.2km',
  data: { delivery_id: deliveryId, source: 'business' }
});
```

**Option B**: Update delivery directly, NO driver_offers?
```javascript
// Just update deliveries table
await supabase.from('deliveries').update({
  driver_id: selectedDriverId,
  status: 'assigned',
  driver_source: 'business_dispatch'
}).eq('id', deliveryId);

// Send different type of notification
await sendBusinessDeliveryNotification(selectedDriverId, deliveryId);
```

**Option C**: Different mechanism entirely?

**❓ Which approach does your driver app expect?**

---

#### **Question 1.2: Does the driver need to "accept" business deliveries?**

**B2C Flow**: Driver sees offer → Taps "Accept" → Gets assigned

**B2B Flow Options**:
- **Option A**: Auto-accepted (no accept button needed)
- **Option B**: Driver still needs to accept (can reject if busy)
- **Option C**: Different acceptance flow for business vs customer deliveries

**❓ What's your preference and how is it currently implemented?**

---

#### **Question 1.3: How does your driver app discover new business assignments?**

**Possible mechanisms:**
1. **Push Notification** → Driver opens app → Queries database
2. **Supabase Realtime Subscription** → Listens for `deliveries` table changes
3. **Polling** → Checks database every X seconds
4. **Ably Realtime** → Subscribes to driver-specific channel
5. **driver_offers table** → Queries for pending offers

**❓ Which mechanism(s) does your driver app currently use?**

**❓ Do we need to trigger anything specific on our end?**

---

### **2. Driver App UI & UX**

#### **Question 2.1: Where do business deliveries appear in the driver app?**

**Options:**
- Same "Delivery Offers" screen (mixed with B2C)
- Separate "Business Deliveries" tab
- "My Fleet" section (if driver is fleet employee)
- "Assigned Deliveries" screen

**❓ What's the current UI structure?**

---

#### **Question 2.2: How are business deliveries visually distinguished?**

**Are they marked differently?**
- Badge/label (e.g., "Business", "Fleet", "Priority")
- Different color scheme
- Different icon
- No visual difference

**❓ Do you have design preferences?**

---

#### **Question 2.3: Can drivers reject manually assigned deliveries?**

**B2C**: Driver can ignore offers (they expire in 2 min)

**B2B**: 
- Can driver reject a business delivery after assignment?
- What happens if they do? (Reassignment? Penalty?)
- Do fleet drivers have different rules than independent drivers?

**❓ What's your policy and implementation?**

---

### **3. Real-Time Tracking**

#### **Question 3.1: Does driver app publish to Ably for business deliveries?**

**B2C Flow (from DELIVERY_FLOW_GUIDE.md):**
```javascript
// Driver app publishes every 3-5 seconds
const channel = ably.channels.get(`delivery:${deliveryId}`);

await channel.publish('driver_location', {
  latitude: currentPosition.latitude,
  longitude: currentPosition.longitude,
  speed: currentPosition.speed,
  bearing: currentPosition.bearing,
  accuracy: currentPosition.accuracy,
  timestamp: new Date().toISOString()
});

await channel.publish('status_update', {
  status: 'driver_en_route',
  timestamp: new Date().toISOString()
});
```

**❓ For business deliveries:**
- Same Ably channel format: `delivery:{deliveryId}`?
- Same event names: `driver_location`, `status_update`, `stop_update`?
- Same publishing frequency: 3-5 seconds?
- Any differences we should know about?

---

#### **Question 3.2: Do we need different Ably API keys for business tracking?**

**Customer App**: Uses public Ably client key

**Business Admin**: Should we:
- Use the same Ably API key?
- Use a different business-specific key?
- Use different channel namespaces? (e.g., `business:delivery:{id}`)

**❓ What's your recommendation?**

---

#### **Question 3.3: When does location tracking start?**

**Possible triggers:**
- Immediately when driver is assigned
- When driver taps "Start" or "En Route"
- When driver accepts the delivery
- When driver arrives at pickup

**❓ What's the actual behavior in your app?**

---

### **4. Status Updates**

#### **Question 4.1: Are the status names identical for B2C and B2B?**

**B2C Status Flow (from guide):**
```
pending → finding_driver → driver_assigned → driver_en_route → 
arrived_at_pickup → picked_up → in_transit → at_destination → delivered
```

**B2B Status Flow (our assumption):**
```
pending_dispatch → assigned → driver_en_route → arrived_at_pickup → 
picked_up → in_transit → at_destination → delivered
```

**❓ Questions:**
- Are status names exactly the same after assignment?
- Do we skip `finding_driver` and go straight to `assigned`?
- Any business-specific statuses?

---

#### **Question 4.2: Who updates the status in the database?**

**Options:**
- Driver app writes directly to `deliveries.status`
- Driver app publishes to Ably, backend edge function updates database
- Driver app calls an API endpoint, backend updates database
- Combination of the above

**❓ What's your current implementation?**

---

#### **Question 4.3: Multi-stop status flow**

**From guide, multi-stop uses:**
```
stop_1_in_transit → stop_1_delivered → 
stop_2_in_transit → stop_2_delivered → 
stop_3_in_transit → stop_3_delivered → delivered
```

**❓ Questions:**
- Is this implemented in driver app?
- Does it work the same for business deliveries?
- Do you update `delivery_stops.status` table?

---

### **5. Database Schema & Queries**

#### **Question 5.1: What tables does your driver app read from?**

**Please list all tables and what you query:**
- `deliveries` - SELECT WHERE driver_id = ?
- `driver_offers` - SELECT WHERE driver_id = ? AND status = 'pending'
- `delivery_stops` - SELECT WHERE delivery_id = ?
- `vehicle_types` - SELECT WHERE id = ?
- `driver_profiles` - SELECT/UPDATE for driver's own profile
- Others?

**❓ Share your typical query patterns?**

---

#### **Question 5.2: What distinguishes a business delivery from a customer delivery?**

**In the database:**
- `deliveries.business_id IS NOT NULL`?
- `deliveries.customer_id IS NULL`?
- Different initial status?
- Presence of `driver_offers` record?

**❓ How do you currently identify delivery type?**

---

#### **Question 5.3: Do you use these business-related columns?**

We've added these to the schema:
- `deliveries.business_id` - References business_accounts
- `deliveries.fleet_vehicle_id` - References business_fleet
- `deliveries.assignment_type` - 'auto' or 'manual'
- `deliveries.driver_source` - 'private_fleet', 'public_fleet', 'independent_driver'
- `driver_profiles.employment_type` - 'independent' or 'fleet_driver'
- `driver_profiles.managed_by_business_id` - References business_accounts

**❓ Are you aware of these fields?**
**❓ Do you use them in your queries?**
**❓ Should we populate them when assigning drivers?**

---

### **6. Fleet Driver Management**

#### **Question 6.1: Fleet driver vs independent driver differences**

**In the system:**
- `driver_profiles.employment_type = 'fleet_driver'`
- `driver_profiles.managed_by_business_id = business_uuid`

**❓ Questions:**
- Does your driver app show different UI for fleet drivers?
- Do fleet drivers get priority for their business's deliveries?
- Can fleet drivers still accept public B2C deliveries?
- Any restrictions or special rules?

---

#### **Question 6.2: Driver availability status**

**We see these status options:**
- `driver_profiles.current_status` - 'online', 'offline', 'busy'
- `driver_profiles.is_online` - boolean (deprecated?)
- `driver_profiles.is_available` - boolean (deprecated?)

**❓ Which fields should we check?**
**❓ How do you update driver status?**

---

### **7. Push Notifications**

#### **Question 7.1: Push notification service**

**❓ What service do you use?**
- Firebase Cloud Messaging (FCM)
- OneSignal
- Expo Push
- Other?

**❓ What's the notification payload structure?**

---

#### **Question 7.2: Notification types**

**For business deliveries, what notification should we send?**

**Suggested payload:**
```json
{
  "title": "New Business Delivery Assigned",
  "body": "Pickup: ABC Corporation, Makati - 5.2km",
  "data": {
    "type": "business_delivery_assigned",
    "delivery_id": "uuid",
    "business_name": "ABC Corporation",
    "pickup_address": "...",
    "dropoff_address": "...",
    "estimated_price": "150.00",
    "priority": "high"
  }
}
```

**❓ Does this work for you?**
**❓ What fields do you need?**

---

### **8. Edge Functions & APIs**

#### **Question 8.1: What edge functions does your driver app call?**

**Please list:**
- Accept delivery offer: `functions/accept-offer`?
- Update location: Direct Ably? Or database?
- Update status: `functions/update-delivery-status`?
- Complete delivery: `functions/complete-delivery`?
- Upload proof of delivery: `functions/upload-pod`?

**❓ Share your edge function list and signatures?**

---

#### **Question 8.2: Should we create a business-specific edge function?**

**For manual driver assignment:**
```
functions/assign-business-driver
POST /assign-business-driver
Body: {
  delivery_id: uuid,
  driver_id: uuid,
  assigned_by: uuid (business user),
  assignment_type: 'manual' | 'auto'
}
```

**❓ Would this help standardize the flow?**
**❓ Or should we use existing functions?**

---

### **9. Testing & Integration**

#### **Question 9.1: Can we get test access to driver app?**

**We need:**
- APK/iOS build (TestFlight/Firebase App Distribution)
- Test driver account credentials
- Ability to simulate deliveries end-to-end

**❓ Can you provide test environment access?**

---

#### **Question 9.2: Is there a staging/development environment?**

**❓ Questions:**
- Separate Supabase project for testing?
- Separate Ably account/keys?
- Test push notification setup?
- How do we avoid affecting production?

---

#### **Question 9.3: Integration testing plan**

**We propose:**
1. Business admin creates test delivery
2. Manually assigns test driver
3. Driver app receives notification
4. Driver opens app and sees delivery
5. Driver starts delivery (status updates)
6. Driver location publishes to Ably
7. Business admin sees real-time tracking on map
8. Driver completes delivery
9. Verify all status updates and data integrity

**❓ Can we schedule a joint testing session?**

---

### **10. Documentation & Code Sharing**

#### **Question 10.1: Can you share relevant driver app code?**

**Would be helpful to see:**
- How you subscribe to Ably channels
- How you handle push notifications
- How you query deliveries from database
- How you update delivery status
- Service layer for delivery operations

**❓ Can you share code snippets or documentation?**

---

#### **Question 10.2: API documentation**

**❓ Do you have API documentation for:**
- Edge functions you've built
- Database schema you expect
- Ably event formats
- Push notification payloads

**❓ Can you share or create documentation?**

---

## 🎯 **PROPOSED SOLUTION (For Discussion)**

Based on our analysis, we propose the following approach:

### **Manual Assignment Flow:**

```
1. Business dispatcher selects pending delivery
2. Business dispatcher selects driver from list
3. Dispatcher clicks "Assign Driver"
4. Backend (our edge function):
   a. Create driver_offers record (status = 'accepted', pre-accepted)
   b. Update deliveries table (driver_id, status = 'assigned')
   c. Update driver_profiles (current_status = 'busy')
   d. Update business_fleet (if fleet driver, set vehicle status = 'busy')
   e. Send push notification to driver
5. Driver app receives notification
6. Driver opens app → Sees new delivery in "Assigned Deliveries"
7. Driver taps "Start Delivery"
8. Driver app starts publishing location to Ably
9. Business admin tracking page subscribes to Ably
10. Real-time tracking begins
```

**❓ Does this flow work with your driver app architecture?**
**❓ What changes/adjustments do you recommend?**

---

## 📅 **Next Steps**

1. **Review this document** and provide answers/feedback
2. **Schedule a technical meeting** to discuss integration
3. **Share code samples** and documentation
4. **Provide test environment access**
5. **Plan joint integration testing session**
6. **Establish communication channel** (Slack, Discord, etc.)

---

## 👥 **Contact Information**

**Business Admin Team:**
- Project: SwiftDash Business Admin Web App
- Tech Stack: Next.js 15, Supabase, Ably, Mapbox
- Repository: swiftdash-web (admin branch)

**Please respond with:**
- Answers to questions above
- Your architecture diagrams (if available)
- Code samples for key integration points
- Availability for technical meeting
- Any concerns or suggestions

---

## ⏰ **Urgency**

We're currently **blocked** on implementing the real-time tracking page until we understand:
1. How to properly assign business deliveries to drivers
2. How driver app receives and displays business assignments
3. How to subscribe to driver location updates for business deliveries

**We'd appreciate a response within 3-5 business days** so we can continue development.

---

**Thank you for your collaboration!** 🚀
