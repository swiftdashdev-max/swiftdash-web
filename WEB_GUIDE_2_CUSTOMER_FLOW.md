# 📘 SWIFTDASH WEB VERSION - PART 2: CUSTOMER FLOW & SCREENS

**Complete User Journey Documentation**  
**Date**: October 26, 2025

---

## 🎯 **COMPLETE CUSTOMER JOURNEY**

```
1. Splash/Landing
   ↓
2. Login/Signup
   ↓
3. Location Selection (Pickup + Delivery)
   ↓
4. Vehicle Selection
   ↓
5. Delivery Contacts & Details
   ↓
6. Order Summary & Pricing
   ↓
7. Payment (Maya)
   ↓
8. Matching Driver
   ↓
9. Live Tracking
   ↓
10. Delivery Completion
   ↓
11. Receipt & Rating
```

---

## 🚀 **SCREEN-BY-SCREEN BREAKDOWN**

### **1. SPLASH SCREEN** (`splash_screen.dart`)

**Purpose**: App initialization, check auth status

**Flow**:
```javascript
1. Show SwiftDash logo
2. Load environment variables
3. Initialize Supabase client
4. Check if user logged in:
   - YES → Go to Location Selection
   - NO → Go to Login
```

**Duration**: 2-3 seconds

---

### **2. LOGIN SCREEN** (`login_screen.dart`)

**Purpose**: User authentication

**Features**:
- Email + Password login
- "Remember Me" checkbox
- "Forgot Password?" link
- Social login buttons (Google, Facebook) - Optional
- "Don't have an account? Sign Up" link

**API Calls**:
```javascript
// Login
const { data, error } = await supabase.auth.signInWithPassword({
  email: email,
  password: password
});

// Save session
if (data.session) {
  localStorage.setItem('supabase.auth.token', data.session.access_token);
  // Redirect to Location Selection
}
```

**Validation**:
- Email format check
- Password minimum 6 characters
- Show error messages for:
  - Invalid credentials
  - Account not found
  - Network errors

---

### **3. SIGNUP SCREEN** (`signup_screen.dart`)

**Purpose**: New user registration

**Form Fields**:
- First Name (required)
- Last Name (required)
- Email (required, validated)
- Phone Number (required, format: 09XX-XXX-XXXX)
- Password (required, min 6 chars)
- Confirm Password (required, must match)
- Terms & Conditions checkbox (required)

**API Calls**:
```javascript
// 1. Create Auth User
const { data: authData, error: authError } = await supabase.auth.signUp({
  email: email,
  password: password,
  options: {
    data: {
      first_name: firstName,
      last_name: lastName,
      phone: phone
    }
  }
});

// 2. Create Customer Profile
const { error: profileError } = await supabase
  .from('customer_profiles')
  .insert({
    id: authData.user.id,
    first_name: firstName,
    last_name: lastName,
    email: email,
    phone: phone,
    created_at: new Date().toISOString()
  });

// 3. Auto-login and redirect
```

**Validation**:
- Check if email already exists
- Phone number format (Philippine format)
- Password strength indicator
- Terms accepted

---

### **4. LOCATION SELECTION** (`location_selection_screen.dart`)

**Purpose**: Set pickup and delivery locations

**THIS IS THE MAIN SCREEN - MOST COMPLEX!**

#### **4A. Single-Stop Mode** (Default)

**UI Components**:
```
┌────────────────────────────────┐
│ [Map - Full Screen]            │
│                                │
│ 📍 Pickup Marker               │
│ 🏁 Delivery Marker             │
│ ── Route Polyline              │
│                                │
└────────────────────────────────┘
┌────────────────────────────────┐
│ 📍 Pickup Location             │
│ [Search Bar with Autocomplete] │
│ ⭐ Saved Addresses Below        │
└────────────────────────────────┘
┌────────────────────────────────┐
│ 🏁 Delivery Location           │
│ [Search Bar with Autocomplete] │
│ ⭐ Saved Addresses Below        │
└────────────────────────────────┘
┌────────────────────────────────┐
│ 🚚 Multi-Stop Toggle (OFF)     │
└────────────────────────────────┘
┌────────────────────────────────┐
│ [Continue Button]              │
│ 12.5 km • ~25 min • ₱150       │
└────────────────────────────────┘
```

**Features**:
- Google Places autocomplete for addresses
- Save frequently used addresses
- Drag map to adjust pin location
- Real-time distance calculation (Mapbox Directions API)
- Traffic-aware route preview (color-coded)
- ETA estimation

**API Calls**:
```javascript
// 1. Address Search (Google Places)
const autocomplete = new google.maps.places.Autocomplete(input, {
  componentRestrictions: { country: 'ph' }
});

// 2. Get Route (Mapbox Directions)
const response = await fetch(
  `https://api.mapbox.com/directions/v5/mapbox/driving/` +
  `${pickupLng},${pickupLat};${deliveryLng},${deliveryLat}?` +
  `geometries=geojson&overview=full&` +
  `access_token=${mapboxSecretToken}`
);

const route = response.routes[0];
const distanceKm = route.distance / 1000;
const durationMin = route.duration / 60;
```

#### **4B. Multi-Stop Mode** (NEW!)

**Enable by toggle switch**

**UI Changes**:
```
┌────────────────────────────────┐
│ [Map - Full Screen]            │
│                                │
│ 📍 Pickup Marker               │
│ ① Dropoff 1 Marker             │
│ ② Dropoff 2 Marker             │
│ ③ Dropoff 3 Marker             │
│ ── Optimized Route Polyline    │
│                                │
└────────────────────────────────┘
┌────────────────────────────────┐
│ 📍 Pickup Location             │
│ [Search Bar]                   │
└────────────────────────────────┘
┌────────────────────────────────┐
│ 🏁 Dropoff Locations           │
│                                │
│ ① [Stop 1 Address]             │
│    [Remove]                    │
│                                │
│ ② [Stop 2 Address]             │
│    [Remove]                    │
│                                │
│ ③ [Stop 3 Address]             │
│    [Remove]                    │
│                                │
│ [+ Add Another Stop]           │
│ (Unlimited stops)              │
└────────────────────────────────┘
┌────────────────────────────────┐
│ [Continue Button]              │
│ 4 stops • 18.5 km • ₱250       │
└────────────────────────────────┘
```

**Features**:
- Add unlimited dropoff stops
- Drag to reorder stops
- Route optimization (Mapbox Optimization API)
- Per-stop pricing (₱25/₱30/₱40/₱50 depending on vehicle)
- Numbered markers on map

**API Calls**:
```javascript
// Multi-Stop Route Optimization
const coordinates = [
  `${pickupLng},${pickupLat}`,
  `${dropoff1Lng},${dropoff1Lat}`,
  `${dropoff2Lng},${dropoff2Lat}`,
  `${dropoff3Lng},${dropoff3Lat}`
].join(';');

const response = await fetch(
  `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coordinates}?` +
  `source=first&destination=any&roundtrip=false&` +
  `access_token=${mapboxSecretToken}`
);

const trip = response.trips[0];
const optimizedOrder = response.waypoints.map(w => w.waypoint_index);
```

---

### **5. VEHICLE SELECTION** (`vehicle_selection_screen.dart`)

**Purpose**: Choose vehicle type based on package size

**Vehicle Types**:
```javascript
[
  {
    id: '1',
    name: 'Motorcycle',
    slug: 'motorcycle',
    description: 'Small packages, documents',
    icon: '🏍️',
    basePrice: 50,
    pricePerKm: 10,
    additionalStopCharge: 25,
    maxWeight: '10 kg',
    capacity: 'Small packages'
  },
  {
    id: '2',
    name: 'Sedan',
    slug: 'sedan',
    description: 'Medium packages, groceries',
    icon: '🚗',
    basePrice: 100,
    pricePerKm: 15,
    additionalStopCharge: 30,
    maxWeight: '30 kg',
    capacity: 'Medium packages'
  },
  {
    id: '3',
    name: 'SUV',
    slug: 'suv',
    description: 'Large packages, furniture',
    icon: '🚙',
    basePrice: 150,
    pricePerKm: 20,
    additionalStopCharge: 40,
    maxWeight: '100 kg',
    capacity: 'Large packages'
  },
  {
    id: '4',
    name: 'Pickup Truck',
    slug: 'pickup',
    description: 'Extra large items, bulk deliveries',
    icon: '🚚',
    basePrice: 200,
    pricePerKm: 25,
    additionalStopCharge: 50,
    maxWeight: '500 kg',
    capacity: 'Extra large'
  }
]
```

**Pricing Formula**:
```javascript
// Single-Stop
totalPrice = basePrice + (distanceKm × pricePerKm)

// Multi-Stop
totalPrice = basePrice + (distanceKm × pricePerKm) + 
             ((numberOfDropoffs - 1) × additionalStopCharge)

// Example: Motorcycle, 12 km, 3 dropoffs
totalPrice = 50 + (12 × 10) + ((3 - 1) × 25)
          = 50 + 120 + 50
          = ₱220
```

**API Call**:
```javascript
// Fetch vehicle types from database
const { data: vehicles } = await supabase
  .from('vehicle_types')
  .select('*')
  .eq('is_active', true)
  .order('base_price');
```

---

### **6. DELIVERY CONTACTS** (`delivery_contacts_screen.dart`)

**Purpose**: Collect sender and recipient details

**For Single-Stop**:
```
┌────────────────────────────────┐
│ 📦 Sender Information          │
│                                │
│ Name: [John Doe]               │
│ Phone: [09171234567]           │
│ Instructions: [Optional]       │
└────────────────────────────────┘
┌────────────────────────────────┐
│ 🏁 Recipient Information       │
│                                │
│ Name: [Jane Smith]             │
│ Phone: [09187654321]           │
│ Instructions: [Call on arrival]│
└────────────────────────────────┘
┌────────────────────────────────┐
│ 📝 Package Details (Optional)  │
│                                │
│ Description: [Documents]       │
│ Weight: [2 kg]                 │
│ Dimensions: [30×20×10 cm]      │
│ Fragile: [✓]                   │
└────────────────────────────────┘
```

**For Multi-Stop**:
```
┌────────────────────────────────┐
│ 📦 Sender Information          │
│ (Same as above)                │
└────────────────────────────────┘
┌────────────────────────────────┐
│ 🏁 Recipients (3 stops)        │
│                                │
│ Stop 1: SM Mall of Asia        │
│ Name: [Jane Smith]             │
│ Phone: [0918-765-4321]         │
│ Notes: [Leave at reception]    │
│ ────────────────────────────   │
│                                │
│ Stop 2: Ayala Avenue           │
│ Name: [Bob Johnson]            │
│ Phone: [0919-123-4567]         │
│ Notes: [Unit 1234]             │
│ ────────────────────────────   │
│                                │
│ Stop 3: BGC, Taguig            │
│ Name: [Mike Williams]          │
│ Phone: [0920-111-2222]         │
│ Notes: [Call before arriving]  │
└────────────────────────────────┘
```

**Validation**:
- Phone number format (09XX-XXX-XXXX)
- Name required
- At least one contact method (phone or instructions)

---

### **7. ORDER SUMMARY** (`order_summary_screen.dart`)

**Purpose**: Review order before payment

**Display**:
```
┌────────────────────────────────┐
│ 📦 Order Summary               │
╞════════════════════════════════╡
│ Vehicle: 🏍️ Motorcycle         │
│ Distance: 12.5 km              │
│ Est. Time: ~25 minutes         │
│                                │
│ 📍 Pickup                      │
│ SM Mall of Asia, Pasay         │
│ John Doe • 0917-123-4567       │
│                                │
│ 🏁 Delivery (3 stops)          │
│ ① Ayala Avenue, Makati         │
│    Jane • 0918-765-4321        │
│ ② BGC, Taguig                  │
│    Bob • 0919-123-4567         │
│ ③ Ortigas, Pasig               │
│    Mike • 0920-111-2222        │
╞════════════════════════════════╡
│ 💰 Pricing Breakdown           │
│                                │
│ Base Price       ₱   50.00     │
│ Distance (12km)  ₱  120.00     │
│ Add'l Stops (2)  ₱   50.00     │
│ ────────────────────────────   │
│ Subtotal         ₱  220.00     │
│ Service Fee      ₱    0.00     │
│ ────────────────────────────   │
│ TOTAL            ₱  220.00     │
╞════════════════════════════════╡
│ 🎁 Promo Code: [_______] Apply │
│                                │
│ ☐ Save as Template             │
│ ☐ Schedule for Later           │
╞════════════════════════════════╡
│ [Cancel] [Proceed to Payment]  │
└────────────────────────────────┘
```

**Features**:
- Edit any detail (goes back to respective screen)
- Apply promo code
- Schedule delivery for later
- Save as delivery template

---

### **8. PAYMENT** (Integrated in Order Summary)

**Purpose**: Process payment via Maya

**Payment Flow**:

#### **Step 1: Create Checkout**
```javascript
// Call Edge Function
const { data, error } = await supabase.functions.invoke('create-maya-checkout', {
  body: {
    amount: 220.00,
    deliveryId: 'delivery_123',
    customerEmail: user.email,
    customerPhone: user.phone,
    customerName: `${user.firstName} ${user.lastName}`
  }
});

// Response
{
  checkoutId: 'abc123...',
  redirectUrl: 'https://payments.maya.ph/checkout/abc123'
}
```

#### **Step 2: Redirect to Maya**
```javascript
// Open Maya payment page
window.location.href = data.redirectUrl;
```

#### **Step 3: Maya Payment Page**
User sees:
- Order details
- Payment options:
  - Credit/Debit Card
  - PayMaya Wallet
  - GCash
  - BDO Online
  - UnionBank Online
- Card input form
- "Pay ₱220.00" button

#### **Step 4: Handle Callback**
```javascript
// User redirected back to your app
// URLs:
// Success: https://yourapp.com/payment/success?id=abc123
// Failure: https://yourapp.com/payment/failed?id=abc123
// Cancel: https://yourapp.com/payment/cancelled?id=abc123

// Verify payment status
const { data: payment } = await supabase
  .from('maya_payments')
  .select('*')
  .eq('checkout_id', checkoutId)
  .single();

if (payment.status === 'PAYMENT_SUCCESS') {
  // Create delivery
  createDelivery();
} else {
  // Show error dialog with options:
  // - Try Again (retry payment)
  // - Change Payment Method
  // - Cancel Order
}
```

**Payment Status Handling**:
```javascript
switch (paymentStatus) {
  case 'PAYMENT_SUCCESS':
    // ✅ Create delivery, go to Matching screen
    break;
    
  case 'PAYMENT_FAILED':
  case 'PAYMENT_EXPIRED':
    // ❌ Show error dialog
    // Options: Retry, Change Method, Cancel
    break;
    
  case 'FOR_AUTHENTICATION':
  case 'AUTHENTICATING':
    // ⏳ Show loading, wait for webhook
    break;
    
  case 'AUTH_SUCCESS':
    // ✅ Capture payment, create delivery
    break;
    
  case 'AUTH_FAILED':
    // ❌ Void payment, show error
    break;
}
```

---

### **9. MATCHING DRIVER** (`matching_screen.dart`)

**Purpose**: Find and assign driver

**UI**:
```
┌────────────────────────────────┐
│                                │
│     [Animated Loading Icon]    │
│                                │
│   🔍 Finding nearby drivers... │
│                                │
│   Searching in your area       │
│                                │
│   ⏳ Estimated wait: 1-2 min   │
│                                │
└────────────────────────────────┘
```

**Backend Process** (Supabase Edge Function):
```javascript
// 1. Book delivery (creates delivery record)
const { data: delivery } = await supabase.functions.invoke(
  'book_multi_stop_delivery', {
    body: { ...deliveryData }
  }
);

// 2. Pair driver (runs automatically in background)
// Edge Function: pair_driver
// - Finds nearest available drivers (H3 geospatial indexing)
// - Sorts by distance and rating
// - Offers delivery to first driver
// - If declined, offers to next driver
// - Timeout: 30 seconds per driver

// 3. Driver accepts
// - Updates delivery.driver_id
// - Changes status to 'driver_assigned'
// - Sends push notification to customer
```

**Customer App Logic**:
```javascript
// Listen for delivery status changes
const subscription = supabase
  .channel(`delivery:${deliveryId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'deliveries',
    filter: `id=eq.${deliveryId}`
  }, (payload) => {
    const newStatus = payload.new.status;
    
    if (newStatus === 'driver_assigned') {
      // Driver found! Go to Tracking screen
      router.push(`/tracking/${deliveryId}`);
    } else if (newStatus === 'failed') {
      // No driver found
      showNoDriverDialog();
    }
  })
  .subscribe();

// Timeout after 5 minutes
setTimeout(() => {
  if (currentStatus !== 'driver_assigned') {
    showTimeoutDialog();
  }
}, 300000);
```

---

### **10. LIVE TRACKING** (`tracking_screen.dart`)

**Purpose**: Real-time delivery tracking

**THIS IS THE MOST IMPORTANT SCREEN!**

**UI Layout**:
```
┌────────────────────────────────┐
│ [Map - Full Screen]            │
│                                │
│ 🚗 Driver (animated)           │
│ 📍 Pickup Marker               │
│ ① ② ③ Dropoff Markers          │
│ ── Route Polyline (traffic)    │
│                                │
│ Driver heading to pickup       │
│ 🚗 ————————→ 📍                │
│                                │
└────────────────────────────────┘
```

**Bottom Sheet** (Swipe up/down):
```
┌────────────────────────────────┐
│ 👤 Driver: Juan Dela Cruz      │
│ ⭐ 4.8 (250 trips)             │
│ 🏍️ Black Honda TMX 155        │
│ 🪪 ABC-1234                    │
│                                │
│ 📞 [Call]  💬 [Chat]           │
╞════════════════════════════════╡
│ 📍 Status: Heading to Pickup   │
│ ⏱️ ETA: 5 minutes              │
│ 🚗 1.2 km away                 │
╞════════════════════════════════╡
│ 🗺️ Progress (Multi-Stop)       │
│                                │
│ ✓ Driver Accepted              │
│ → Heading to Pickup (5 min)    │
│   Pick up package              │
│ ① Stop 1: SM MOA               │
│ ② Stop 2: Ayala                │
│ ③ Stop 3: BGC                  │
│                                │
│ [Cancel Delivery]              │
└────────────────────────────────┘
```

**Status Transitions**:

1. **driver_assigned** → "Driver Accepted"
   - Driver info appears
   - Driver location starts updating every 3 seconds
   - Show "Heading to Pickup" + ETA

2. **heading_to_pickup** → "On the way to you"
   - Map centers on driver
   - Draw route from driver to pickup
   - Live distance countdown
   - ETA updates dynamically

3. **arrived_at_pickup** → "Driver has arrived"
   - Show "Driver is here!" message
   - Button: "I've handed over the package"
   - Driver takes photo proof

4. **picked_up** → "Package picked up"
   - Status: "Heading to Stop 1"
   - Map shows route to first dropoff
   - ETA to first stop

5. **heading_to_dropoff** → "On the way to Stop 1"
   - Progress bar: 🟢▬▬▬▬ (0/3 delivered)
   - Map centers on driver
   - ETA to next stop

6. **arrived_at_dropoff** → "Driver at Stop 1"
   - Notification: "Driver at SM MOA"
   - Waiting for recipient confirmation
   - Driver takes photo + signature

7. **stop_completed** → "Stop 1 ✓ Delivered"
   - Progress bar: 🟢🟢▬▬▬ (1/3 delivered)
   - Status: "Heading to Stop 2"
   - Map updates route to next stop

8. **all_stops_completed** → "All deliveries complete!"
   - Progress bar: 🟢🟢🟢🟢 (3/3 delivered)
   - Show "Rate your driver" prompt
   - Redirect to Receipt screen

**Real-Time GPS Tracking**:
```javascript
// Ably Realtime - Driver GPS Updates
const ably = new Ably.Realtime(ablyClientKey);
const channel = ably.channels.get(`driver-location:${driverId}`);

channel.subscribe('location-update', (message) => {
  const { latitude, longitude, heading, speed } = message.data;
  
  // Update driver marker on map
  updateDriverMarker({
    lat: latitude,
    lng: longitude,
    rotation: heading, // For icon rotation
    speed: speed // km/h
  });
  
  // Recalculate ETA
  calculateETA(latitude, longitude);
});

// Updates every 3 seconds while delivery is active
```

**Traffic-Aware Routing**:
```javascript
// Mapbox Directions API with traffic
const getRoute = async (driverLoc, destinationLoc) => {
  const response = await fetch(
    `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/` +
    `${driverLoc.lng},${driverLoc.lat};` +
    `${destinationLoc.lng},${destinationLoc.lat}?` +
    `geometries=geojson&overview=full&steps=true&` +
    `annotations=duration,distance,speed,congestion&` +
    `access_token=${mapboxSecretToken}`
  );
  
  const route = response.routes[0];
  const polyline = route.geometry.coordinates;
  const duration = route.duration / 60; // minutes
  
  // Color code by traffic
  const congestionColors = {
    'low': '#00FF00',      // Green
    'moderate': '#FFFF00', // Yellow
    'heavy': '#FFA500',    // Orange
    'severe': '#FF0000'    // Red
  };
  
  return {
    polyline,
    duration,
    congestion: route.legs[0].annotation.congestion
  };
};
```

**Call/Chat Driver**:
```javascript
// Call - Opens phone dialer
const callDriver = () => {
  window.location.href = `tel:${driver.phone}`;
};

// Chat - Opens in-app messaging (optional feature)
const openChat = () => {
  router.push(`/chat/${deliveryId}`);
};
```

---

### **11. DELIVERY COMPLETION** (Auto-triggered)

**Purpose**: Confirm all stops delivered

**When Last Stop Completed**:
```
┌────────────────────────────────┐
│         ✅ Success!             │
│                                │
│   All packages delivered!      │
│                                │
│   3/3 stops completed          │
│                                │
│   [View Receipt]               │
│   [Rate Driver]                │
│                                │
└────────────────────────────────┘
```

**Backend Update**:
```javascript
// Edge Function automatically sets
delivery.status = 'delivered';
delivery.completed_at = new Date().toISOString();

// Customer gets push notification
sendNotification({
  title: "Delivery Complete!",
  body: "All 3 packages delivered successfully",
  action: "VIEW_RECEIPT"
});
```

---

### **12. RECEIPT & RATING** (`delivery_receipt_screen.dart`)

**Purpose**: Show proof of delivery and collect feedback

**Receipt Display**:
```
┌────────────────────────────────┐
│ 📄 Delivery Receipt            │
│                                │
│ Receipt #DEL-20251026-001      │
│ Date: Oct 26, 2025 2:30 PM    │
╞════════════════════════════════╡
│ 👤 Driver: Juan Dela Cruz      │
│ ⭐ 4.8 • 🏍️ ABC-1234           │
╞════════════════════════════════╡
│ 📍 Route Summary               │
│                                │
│ Pickup: SM Mall of Asia        │
│ ✓ Picked up at 2:15 PM         │
│                                │
│ ① Ayala Avenue                 │
│ ✓ Delivered at 2:25 PM         │
│ 📸 [Photo] ✍️ [Signature]      │
│                                │
│ ② BGC, Taguig                  │
│ ✓ Delivered at 2:35 PM         │
│ 📸 [Photo] ✍️ [Signature]      │
│                                │
│ ③ Ortigas, Pasig               │
│ ✓ Delivered at 2:45 PM         │
│ 📸 [Photo] ✍️ [Signature]      │
╞════════════════════════════════╡
│ 💰 Payment Summary             │
│                                │
│ Subtotal         ₱  220.00     │
│ Tip (Optional)   ₱    0.00     │
│ ────────────────────────────   │
│ Total Paid       ₱  220.00     │
│ Paid via: Maya - Mastercard    │
╞════════════════════════════════╡
│ ⭐ Rate Your Driver             │
│                                │
│ ☆ ☆ ☆ ☆ ☆ (Tap to rate)       │
│                                │
│ 💬 Leave a comment (optional)  │
│ [____________________________] │
│                                │
│ 💵 Add Tip? (Optional)         │
│ [₱20] [₱50] [₱100] [Custom]    │
╞════════════════════════════════╡
│ [Download PDF] [Share Receipt] │
│                                │
│ [Done]                         │
└────────────────────────────────┘
```

**Photo/Signature Viewer**:
```javascript
// View proof of delivery
const viewProof = (stopIndex) => {
  // Fetch from Supabase Storage
  const { data } = await supabase.storage
    .from('delivery-proofs')
    .getPublicUrl(`${deliveryId}/stop_${stopIndex}_photo.jpg`);
  
  // Show in lightbox
  showImageViewer(data.publicUrl);
};
```

**Rating Submission**:
```javascript
// Submit driver rating
const submitRating = async (stars, comment, tip) => {
  // 1. Save rating
  await supabase.from('driver_ratings').insert({
    delivery_id: deliveryId,
    driver_id: driverId,
    customer_id: userId,
    stars: stars,
    comment: comment,
    created_at: new Date().toISOString()
  });
  
  // 2. Update driver average rating
  await supabase.rpc('update_driver_rating', {
    driver_id: driverId
  });
  
  // 3. Add tip if provided
  if (tip > 0) {
    await supabase.functions.invoke('add_tip', {
      body: {
        deliveryId,
        driverId,
        amount: tip
      }
    });
  }
  
  // Redirect to Home or Order History
  router.push('/');
};
```

---

## 📱 **ADDITIONAL SCREENS**

### **13. ORDER HISTORY** (`order_history_screen.dart`)

**Purpose**: View past deliveries

**UI**:
```
┌────────────────────────────────┐
│ 📦 My Deliveries               │
│                                │
│ [Active] [Scheduled] [Past]    │
╞════════════════════════════════╡
│ Oct 26, 2025                   │
│                                │
│ ┌────────────────────────────┐ │
│ │ 🏍️ Motorcycle • ₱220       │ │
│ │ SM MOA → 3 stops           │ │
│ │ ✓ Delivered 2:45 PM        │ │
│ │ ⭐ Rated 5 stars           │ │
│ │ [View Receipt]             │ │
│ └────────────────────────────┘ │
│                                │
│ Oct 25, 2025                   │
│                                │
│ ┌────────────────────────────┐ │
│ │ 🚗 Sedan • ₱180            │ │
│ │ Makati → BGC               │ │
│ │ ✓ Delivered 4:30 PM        │ │
│ │ [View Receipt]             │ │
│ └────────────────────────────┘ │
│                                │
│ [Load More]                    │
└────────────────────────────────┘
```

**API Call**:
```javascript
// Fetch deliveries
const { data: deliveries } = await supabase
  .from('deliveries')
  .select(`
    *,
    delivery_stops(*),
    vehicle_types(name, slug),
    driver_profiles(first_name, last_name, rating)
  `)
  .eq('customer_id', userId)
  .order('created_at', { ascending: false })
  .limit(20);
```

**Filters**:
- **Active**: `status IN ('pending', 'driver_assigned', 'picked_up', 'heading_to_dropoff')`
- **Scheduled**: `is_scheduled = true AND scheduled_for > NOW()`
- **Past**: `status = 'delivered'`

---

### **14. SAVED ADDRESSES** (`saved_addresses_screen.dart`)

**Purpose**: Manage frequently used addresses

**UI**:
```
┌────────────────────────────────┐
│ ⭐ Saved Addresses              │
│                                │
│ [+ Add New Address]            │
╞════════════════════════════════╡
│ 🏠 Home                        │
│ 123 Main St, Makati            │
│ Default • [Edit] [Delete]      │
╞════════════════════════════════╡
│ 🏢 Office                      │
│ BGC Corporate Center           │
│ [Edit] [Delete]                │
╞════════════════════════════════╡
│ 📍 Mom's House                 │
│ 456 Oak Ave, Quezon City       │
│ [Edit] [Delete]                │
└────────────────────────────────┘
```

**Database Schema**:
```javascript
// Table: saved_addresses
{
  id: 'uuid',
  customer_id: 'uuid',
  label: 'Home',
  address: '123 Main St, Makati',
  latitude: 14.5547,
  longitude: 121.0244,
  is_default: true,
  created_at: 'timestamp'
}
```

---

### **15. SCHEDULED DELIVERIES** (`scheduled_deliveries_screen.dart`)

**Purpose**: Book deliveries for future dates

**Scheduling UI** (Added to Order Summary):
```
┌────────────────────────────────┐
│ 📅 Schedule for Later?         │
│                                │
│ ○ Book Now (Default)           │
│ ● Schedule for Later           │
│                                │
│ Date: [Oct 27, 2025] 📅        │
│ Time: [10:00 AM] ⏰            │
│                                │
│ ⚠️ Driver will be assigned     │
│    30 minutes before pickup    │
└────────────────────────────────┘
```

**Backend**:
```javascript
// Create scheduled delivery
const { data } = await supabase.from('deliveries').insert({
  ...deliveryData,
  is_scheduled: true,
  scheduled_for: '2025-10-27T10:00:00+08:00',
  status: 'scheduled'
});

// Cron job runs every minute:
// - Finds deliveries where scheduled_for <= NOW() + 30 minutes
// - Changes status to 'pending'
// - Triggers pair_driver Edge Function
```

---

### **16. PROFILE & SETTINGS** (`profile_screen.dart`)

**Purpose**: Manage account

**UI**:
```
┌────────────────────────────────┐
│ 👤 My Profile                  │
│                                │
│ Juan Dela Cruz                 │
│ juan@email.com                 │
│ 0917-123-4567                  │
│                                │
│ [Edit Profile]                 │
╞════════════════════════════════╡
│ ⭐ Saved Addresses              │
│ 📦 Order History               │
│ 📅 Scheduled Deliveries        │
│ 💳 Payment Methods             │
│ 🎫 Promo Codes                 │
│ 🔔 Notifications               │
│ ⚙️ Settings                    │
│ ❓ Help & Support              │
│ 📄 Terms & Privacy             │
│ 🚪 Logout                      │
└────────────────────────────────┘
```

---

## 🔄 **STATE MANAGEMENT RECOMMENDATIONS**

### **Global State** (Redux/Context/Vuex):
```javascript
{
  // User
  user: {
    id: 'uuid',
    email: 'user@email.com',
    firstName: 'John',
    lastName: 'Doe',
    phone: '0917-123-4567',
    isAuthenticated: true
  },
  
  // Current Booking
  booking: {
    pickupLocation: { address, lat, lng },
    deliveryStops: [
      { address, lat, lng, recipientName, recipientPhone },
      { address, lat, lng, recipientName, recipientPhone }
    ],
    vehicleType: { id, name, slug },
    senderInfo: { name, phone, instructions },
    packageDetails: { description, weight },
    pricing: {
      basePrice: 50,
      distancePrice: 120,
      additionalStopsPrice: 25,
      total: 195
    },
    isScheduled: false,
    scheduledFor: null
  },
  
  // Active Delivery
  activeDelivery: {
    id: 'uuid',
    status: 'picked_up',
    driver: {
      id: 'uuid',
      name: 'Juan Dela Cruz',
      phone: '0918-765-4321',
      rating: 4.8,
      vehicle: 'ABC-1234',
      location: { lat: 14.5547, lng: 121.0244 }
    },
    route: {
      polyline: [...],
      distance: 12.5,
      duration: 25,
      eta: '2025-10-26T15:30:00'
    }
  },
  
  // UI
  ui: {
    isLoading: false,
    errorMessage: null,
    activeModal: null
  }
}
```

---

## 📊 **DATA MODELS**

### **Delivery Object**:
```javascript
{
  id: 'uuid',
  customer_id: 'uuid',
  driver_id: 'uuid',
  vehicle_type_id: 'uuid',
  
  // Locations
  pickup_address: 'SM Mall of Asia, Pasay',
  pickup_latitude: 14.5352,
  pickup_longitude: 120.9827,
  
  // For multi-stop, dropoffs stored in delivery_stops table
  delivery_address: 'BGC, Taguig', // Last stop
  delivery_latitude: 14.5511,
  delivery_longitude: 121.0485,
  
  // Contact Info
  sender_name: 'John Doe',
  sender_phone: '0917-123-4567',
  recipient_name: 'Jane Smith',
  recipient_phone: '0918-765-4321',
  
  // Details
  package_description: 'Documents',
  special_instructions: 'Call on arrival',
  
  // Pricing
  distance_km: 12.5,
  price: 220.00,
  tip_amount: 0.00,
  
  // Status
  status: 'delivered',
  is_scheduled: false,
  scheduled_for: null,
  
  // Timestamps
  created_at: '2025-10-26T14:00:00',
  accepted_at: '2025-10-26T14:02:00',
  picked_up_at: '2025-10-26T14:15:00',
  completed_at: '2025-10-26T14:45:00'
}
```

### **Delivery Stop Object** (Multi-Stop):
```javascript
{
  id: 'uuid',
  delivery_id: 'uuid',
  stop_number: 1, // 1, 2, 3...
  
  address: 'Ayala Avenue, Makati',
  latitude: 14.5547,
  longitude: 121.0244,
  
  recipient_name: 'Bob Johnson',
  recipient_phone: '0919-123-4567',
  special_instructions: 'Unit 1234',
  
  status: 'delivered', // pending, delivered, failed
  
  proof_photo_url: 'https://...',
  signature_url: 'https://...',
  
  arrived_at: '2025-10-26T14:25:00',
  completed_at: '2025-10-26T14:30:00',
  failed_reason: null
}
```

---

## 🎨 **UI/UX BEST PRACTICES**

### **Loading States**:
- Show skeleton screens while fetching data
- Disable buttons during API calls
- Show progress indicators for long operations

### **Error Handling**:
- Clear error messages ("No internet connection" not "Network error")
- Retry buttons for failed API calls
- Fallback UI for missing data

### **Responsive Design**:
- Mobile-first approach (most customers on mobile)
- Desktop: Multi-column layout
- Tablet: Optimize spacing
- Mobile: Single column, larger touch targets

### **Accessibility**:
- Semantic HTML (headings, labels, ARIA)
- Keyboard navigation support
- Screen reader friendly
- High contrast colors
- Min font size 14px

---

## 🔔 **PUSH NOTIFICATIONS**

**Web Push API** (for browser notifications):

```javascript
// Request permission
const permission = await Notification.requestPermission();

if (permission === 'granted') {
  // Subscribe to notifications
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: 'your-vapid-public-key'
  });
  
  // Save subscription to Supabase
  await supabase.from('push_subscriptions').insert({
    customer_id: userId,
    subscription: subscription,
    device: 'web'
  });
}
```

**Notification Events**:
- Driver assigned: "Juan accepted your delivery"
- Driver arriving: "Driver is 2 minutes away"
- Pickup completed: "Package picked up"
- Stop delivered: "Delivered to Stop 1 of 3"
- All delivered: "All deliveries complete!"

---

## 📱 **RESPONSIVE BREAKPOINTS**

```css
/* Mobile */
@media (max-width: 767px) {
  /* Full screen map */
  /* Bottom sheets for info */
  /* Hamburger menu */
}

/* Tablet */
@media (min-width: 768px) and (max-width: 1023px) {
  /* 70% map, 30% sidebar */
  /* Larger buttons */
}

/* Desktop */
@media (min-width: 1024px) {
  /* 60% map, 40% sidebar */
  /* Multi-column forms */
  /* Floating action buttons */
}
```

---

## 🎯 **KEY TAKEAWAYS FOR WEB TEAM**

✅ **15 Main Screens** documented with UI mockups  
✅ **Multi-Stop Support** fully explained (unlimited stops)  
✅ **Real-Time Tracking** via Ably (3-second GPS updates)  
✅ **Payment Flow** via Maya (checkout → verify → create delivery)  
✅ **State Management** recommendations (Redux/Context/Vuex)  
✅ **Data Models** for Delivery and DeliveryStop objects  
✅ **API Integrations** for each screen (Supabase, Mapbox, Google, Maya, Ably)  
✅ **Status Handling** for 10+ delivery statuses  
✅ **Responsive Design** considerations  

**Next**: Part 3 will cover implementation details (code examples, SDK setup, best practices)

---

📄 **Document**: WEB_GUIDE_2_CUSTOMER_FLOW.md  
🗓️ **Version**: 1.0  
👤 **Author**: SwiftDash Development Team
