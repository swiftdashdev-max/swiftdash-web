# 📘 SWIFTDASH WEB VERSION - PART 1: BACKEND SERVICES & API KEYS

**Complete Technical Documentation for Web Development Team**  
**App**: SwiftDash - On-Demand Delivery Platform  
**Date**: October 26, 2025

---

## 🎯 **SYSTEM OVERVIEW**

SwiftDash is a **3-sided marketplace** for on-demand deliveries:
1. **Customer App** (Mobile + Web) - Book deliveries
2. **Driver App** (Mobile) - Accept & complete deliveries  
3. **Admin Dashboard** (Web) - Manage operations

This guide covers all backend services needed for the **Web Customer App**.

---

## 🗄️ **1. SUPABASE (Backend-as-a-Service)**

**Purpose**: Database, Authentication, Real-time, Storage, Edge Functions

### **Connection Details**:
```
URL: https://lygzxmhskkqrntnmxtbb.supabase.co
Anon Key: sb_publishable_AXpznyj7ra4eUoDiYQmqEQ_enUzT-Mc
```

### **What We Use**:
- ✅ **PostgreSQL Database** - All data storage
- ✅ **Auth** - User authentication (email/password, social login)
- ✅ **Realtime** - Live updates (driver location, delivery status)
- ✅ **Storage** - File uploads (profile pictures, delivery photos)
- ✅ **Edge Functions** - Server-side business logic (12 functions)

### **Key Database Tables**:

```sql
-- Users & Profiles
users (Supabase Auth)
customer_profiles (customer details)
driver_profiles (driver details)
admin_profiles (admin users)

-- Deliveries
deliveries (main delivery records)
delivery_stops (multi-stop delivery support - NEW!)
delivery_history (status change log)

-- Addresses
saved_addresses (customer saved locations)
delivery_addresses (unified address system)

-- Payments
maya_payments (payment records)
maya_webhooks (webhook logs)

-- Vehicles
vehicle_types (pricing & vehicle info)

-- Support
contacts (emergency contacts)
scheduled_deliveries (future bookings)
```

### **Row Level Security (RLS)**:
- ✅ Enabled on all tables
- ✅ Customers can only see their own data
- ✅ Drivers can only see assigned deliveries
- ✅ Admins have full access

### **Realtime Subscriptions**:
```javascript
// Example: Listen to delivery updates
const subscription = supabase
  .channel('delivery:123')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'deliveries',
    filter: 'id=eq.123'
  }, (payload) => {
    console.log('Delivery updated:', payload.new);
  })
  .subscribe();
```

---

## 📍 **2. MAPBOX (Maps & Routing)**

**Purpose**: Interactive maps, route calculation, geocoding, traffic-aware routing

### **API Keys**:
```
Access Token (Public): pk.eyJ1Ijoic3dpZnRkYXNoIiwiYSI6ImNsd...
Secret Token (Server): sk.eyJ1Ijoic3dpZnRkYXNoIiwiYSI6ImNsd...
```

### **What We Use**:

#### **A. Map Display** (Access Token)
```javascript
// Mapbox GL JS
mapboxgl.accessToken = 'pk.eyJ1...';
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [120.9842, 14.5995], // Manila
  zoom: 12
});
```

**Style URL**: `mapbox://styles/mapbox/streets-v12`

#### **B. Geocoding API** (Access Token)
```javascript
// Address → Coordinates
const response = await fetch(
  `https://api.mapbox.com/geocoding/v5/mapbox.places/${address}.json?` +
  `access_token=${accessToken}&country=PH&limit=5`
);
```

#### **C. Directions API** (Secret Token - Server-side)
```javascript
// Get route between points
const response = await fetch(
  `https://api.mapbox.com/directions/v5/mapbox/driving/` +
  `${lng1},${lat1};${lng2},${lat2}?` +
  `geometries=geojson&overview=full&` +
  `access_token=${secretToken}`
);
```

#### **D. Matrix API** (Secret Token - Server-side)
```javascript
// Traffic-aware routing with ETA
const response = await fetch(
  `https://api.mapbox.com/directions-matrix/v1/mapbox/driving/` +
  `${coordinates}?annotations=duration,distance&` +
  `access_token=${secretToken}`
);
```

**Returns**: Real-time traffic, color-coded routes (green/yellow/red), accurate ETAs

#### **E. Optimization API** (Secret Token - Server-side)
```javascript
// Multi-stop route optimization
const response = await fetch(
  `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/` +
  `${coordinates}?source=first&destination=any&` +
  `access_token=${secretToken}`
);
```

**Use Case**: Optimizes order of dropoff stops for efficiency

### **Pricing** (Important for Business Version):
- **Geocoding**: 100,000 free/month, then $0.50 per 1,000
- **Directions**: 100,000 free/month, then $0.50 per 1,000
- **Matrix**: 100,000 free/month, then $0.005 per request
- **Optimization**: 100,000 free/month, then $0.50 per 1,000

**Current Usage**: ~3-5 API calls per delivery → ~$1.50 per 1,000 deliveries

---

## 🔍 **3. GOOGLE PLACES (Address Search)**

**Purpose**: Address autocomplete, place details, geocoding

### **API Keys**:
```
Places API Key: AIzaSyB...
Maps JavaScript API Key: AIzaSyB... (same or different)
```

### **What We Use**:

#### **A. Places Autocomplete**
```javascript
const autocomplete = new google.maps.places.Autocomplete(inputElement, {
  types: ['establishment', 'geocode'],
  componentRestrictions: { country: 'ph' }, // Philippines only
  fields: ['formatted_address', 'geometry', 'name', 'place_id']
});
```

#### **B. Place Details**
```javascript
const service = new google.maps.places.PlacesService(map);
service.getDetails({
  placeId: placeId,
  fields: ['formatted_address', 'geometry', 'name', 'address_components']
}, (result, status) => {
  // Extract detailed address
});
```

### **Pricing**:
- **Autocomplete**: $2.83 per 1,000 requests
- **Place Details**: $17 per 1,000 requests
- **Geocoding**: $5 per 1,000 requests

**Optimization**: We cache results and use Mapbox geocoding when possible (cheaper)

---

## 💳 **4. MAYA (Payment Gateway)**

**Purpose**: Credit/debit card payments, digital wallets (PayMaya, GCash)

### **API Credentials**:
```
Environment: Production (set to Sandbox for testing)
Public Key: pk-...
Secret Key: sk-...
Webhook Signing Secret: wh_...
```

### **What We Use**:

#### **A. Payment Types**:
1. **Direct Checkout** - Redirect to Maya payment page
2. **Card Payment** - Tokenized card payments
3. **PayWithMaya** - Maya app integration
4. **Payment Vault** - Save cards for future use

#### **B. Payment Flow**:
```javascript
// 1. Create Checkout Session (Server-side)
POST https://pg.paymaya.com/checkout/v1/checkouts
Headers:
  Authorization: Basic base64(publicKey:)
  Content-Type: application/json

Body: {
  totalAmount: { value: 250.00, currency: "PHP" },
  buyer: { firstName, lastName, contact: { phone, email } },
  items: [{ name: "Delivery Service", quantity: 1, amount: { value: 250 } }],
  redirectUrl: {
    success: "https://yourapp.com/payment/success",
    failure: "https://yourapp.com/payment/failed",
    cancel: "https://yourapp.com/payment/cancelled"
  },
  requestReferenceNumber: "DELIVERY_123"
}

Response: {
  checkoutId: "abc123...",
  redirectUrl: "https://payments.maya.ph/checkout/abc123"
}

// 2. Redirect User
window.location.href = redirectUrl;

// 3. Handle Callback
// User redirected to success/failure URL with ?id=checkoutId

// 4. Verify Payment (Server-side)
GET https://pg.paymaya.com/checkout/v1/checkouts/{checkoutId}
Headers:
  Authorization: Basic base64(secretKey:)

Response: {
  status: "PAYMENT_SUCCESS",
  receiptNumber: "123456",
  transactionReferenceNumber: "TRX789"
}
```

#### **C. Webhooks**:
```
Webhook URL: https://lygzxmhskkqrntnmxtbb.supabase.co/functions/v1/maya-webhook

Events:
- PAYMENT_SUCCESS
- PAYMENT_FAILED
- PAYMENT_EXPIRED
- AUTHORIZED
- CANCELLED
- 3DS_PAYMENT_SUCCESS
- 3DS_PAYMENT_FAILURE

Verification:
X-MayaSignature header = HMAC-SHA256(webhookSecret, payload)
```

### **Edge Functions for Maya**:
```
supabase/functions/create-maya-checkout/   - Create payment session
supabase/functions/capture-maya-payment/   - Capture authorized payment
supabase/functions/void-maya-payment/      - Cancel payment
supabase/functions/maya-webhook/           - Handle payment webhooks
```

### **Pricing**:
- **Credit/Debit Card**: 3.5% + ₱15 per transaction
- **PayMaya Wallet**: 2.5% per transaction
- **GCash**: 2.5% per transaction

---

## 🔴 **5. ABLY (Real-time Location Tracking)**

**Purpose**: Live driver location updates (faster than Supabase Realtime)

### **API Keys**:
```
Client Key (Public): client_key_...
Root Key (Server): root_key_...
```

### **What We Use**:

#### **A. Driver Location Broadcasting**
```javascript
// Driver App (sends location every 3 seconds)
const ably = new Ably.Realtime(clientKey);
const channel = ably.channels.get(`tracking:${deliveryId}`);

setInterval(() => {
  channel.publish('location_update', {
    latitude: currentLat,
    longitude: currentLng,
    heading: heading,
    speed: speed,
    timestamp: Date.now()
  });
}, 3000);
```

#### **B. Customer Tracking (receives updates)**
```javascript
// Customer App/Web
const ably = new Ably.Realtime(clientKey);
const channel = ably.channels.get(`tracking:${deliveryId}`);

channel.subscribe('location_update', (message) => {
  const { latitude, longitude } = message.data;
  updateDriverMarker(latitude, longitude);
});
```

#### **C. Presence API (driver online/offline)**
```javascript
channel.presence.subscribe('enter', (member) => {
  console.log('Driver is online');
});

channel.presence.subscribe('leave', (member) => {
  console.log('Driver went offline');
});
```

### **Why Ably + Supabase**:
- **Ably**: GPS updates (3-second interval, needs speed)
- **Supabase Realtime**: Delivery status updates (slower, but persistent)

### **Pricing**:
- **Free Tier**: 3M messages/month
- **Paid**: $29/month for 20M messages
- **Current Usage**: ~600 messages per delivery → ~$0.001 per delivery

---

## 🔧 **6. SUPABASE EDGE FUNCTIONS**

**Purpose**: Server-side business logic (TypeScript/Deno)

### **Deployed Functions**:

| Function | Purpose | URL |
|----------|---------|-----|
| `book_delivery` | Create single-stop delivery | `/functions/v1/book_delivery` |
| `book_multi_stop_delivery` | Create multi-stop delivery (NEW!) | `/functions/v1/book_multi_stop_delivery` |
| `pair_driver` | Match driver to delivery | `/functions/v1/pair_driver` |
| `accept_delivery` | Driver accepts delivery | `/functions/v1/accept_delivery` |
| `quote` | Calculate delivery price | `/functions/v1/quote` |
| `add_tip` | Add tip after delivery | `/functions/v1/add_tip` |
| `create-maya-checkout` | Create Maya payment | `/functions/v1/create-maya-checkout` |
| `capture-maya-payment` | Capture Maya payment | `/functions/v1/capture-maya-payment` |
| `void-maya-payment` | Cancel Maya payment | `/functions/v1/void-maya-payment` |
| `maya-webhook` | Maya webhook handler | `/functions/v1/maya-webhook` |
| `assign_scheduled_drivers` | Assign drivers to scheduled deliveries | `/functions/v1/assign_scheduled_drivers` |

### **How to Call**:
```javascript
const { data, error } = await supabase.functions.invoke('book_delivery', {
  body: {
    vehicleTypeId: '123',
    pickupAddress: 'SM Mall of Asia',
    pickupLatitude: 14.5352,
    pickupLongitude: 120.9822,
    deliveryAddress: 'Ayala Avenue, Makati',
    deliveryLatitude: 14.5547,
    deliveryLongitude: 121.0244,
    // ... more fields
  }
});
```

### **Authentication**:
- Uses Supabase Auth JWT token
- Automatically includes user ID
- RLS policies enforced

---

## 🔐 **7. ENVIRONMENT VARIABLES (.env)**

**For Web Development, create `.env` file**:

```env
# Supabase
SUPABASE_URL=https://lygzxmhskkqrntnmxtbb.supabase.co
SUPABASE_ANON_KEY=sb_publishable_AXpznyj7ra4eUoDiYQmqEQ_enUzT-Mc

# Mapbox
MAPBOX_ACCESS_TOKEN=pk.eyJ1Ijoic3dpZnRkYXNoIiwiYSI6ImNsd...
MAPBOX_SECRET_TOKEN=sk.eyJ1Ijoic3dpZnRkYXNoIiwiYSI6ImNsd...
MAPBOX_STYLE_URL=mapbox://styles/mapbox/streets-v12
MAP_PROVIDER=mapbox

# Google
GOOGLE_PLACES_API_KEY=AIzaSyB...
GOOGLE_MAPS_API_KEY=AIzaSyB...

# Maya Payment
MAYA_PUBLIC_KEY=pk-...
MAYA_SECRET_KEY=sk-...
MAYA_ENVIRONMENT=production
# Or use: MAYA_ENVIRONMENT=sandbox for testing

# Ably
ABLY_CLIENT_KEY=client_key_...
ABLY_ROOT_KEY=root_key_...

# App Config
ENVIRONMENT=production
```

---

## 🌐 **8. CORS & SECURITY**

### **Supabase CORS**:
- Already configured for web access
- Allows requests from any origin (anon key is rate-limited)

### **API Key Security**:
- ✅ **Public keys** (client-side): Access Token, Anon Key, Client Key
- ❌ **Secret keys** (server-side only): Secret Token, Secret Key, Root Key

**For Web**:
- Use public keys in frontend JavaScript
- Call Edge Functions for operations needing secret keys
- Never expose secret keys in client code

---

## 📊 **9. COST BREAKDOWN (Monthly)**

**Based on 1,000 deliveries/month**:

| Service | Usage | Cost |
|---------|-------|------|
| Supabase | Free tier (2 projects) | $0 |
| Mapbox | ~5,000 API calls | ~$7.50 |
| Google Places | ~3,000 searches | ~$8.50 |
| Maya | ~₱250 avg × 3.5% | ~₱8,750 |
| Ably | ~600k messages | ~$29 |
| **Total** | | **~$45 + ₱8,750** |

**At Scale (10,000 deliveries/month)**:
- Supabase: $25/month (Pro plan)
- Mapbox: ~$75
- Google: ~$85
- Maya: ~₱87,500
- Ably: ~$49
- **Total**: **~$234 + ₱87,500**

---

## 🔗 **10. USEFUL LINKS**

### **Documentation**:
- Supabase: https://supabase.com/docs
- Mapbox GL JS: https://docs.mapbox.com/mapbox-gl-js/
- Google Places: https://developers.google.com/maps/documentation/places/web-service
- Maya: https://developers.maya.ph/docs
- Ably: https://ably.com/docs

### **Dashboards**:
- Supabase: https://supabase.com/dashboard/project/lygzxmhskkqrntnmxtbb
- Mapbox: https://account.mapbox.com
- Google Cloud: https://console.cloud.google.com
- Maya: https://dashboard.paymaya.com
- Ably: https://ably.com/accounts

---

## ✅ **QUICK START CHECKLIST**

For Web Development Team:

- [ ] Get all API keys from this document
- [ ] Create `.env` file with all credentials
- [ ] Test Supabase connection
- [ ] Test Mapbox map display
- [ ] Test Google Places autocomplete
- [ ] Test Maya payment flow (sandbox)
- [ ] Test Ably real-time updates
- [ ] Review Part 2 (Customer Flow)
- [ ] Review Part 3 (Implementation Guide)

---

**Next**: See `WEB_GUIDE_2_CUSTOMER_FLOW.md` for complete user journey and screens
