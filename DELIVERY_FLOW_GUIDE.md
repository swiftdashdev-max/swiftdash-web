# 📦 SwiftDash Delivery Flow Guide

**Complete guide on how deliveries work from creation to completion**

---

## 🎯 **Overview**

SwiftDash uses a sophisticated real-time delivery system with the following components:
- **Customer App**: Creates deliveries and tracks in real-time
- **Driver App** (External): Receives offers, accepts jobs, updates status
- **Supabase Backend**: Manages delivery data and status
- **Ably Realtime**: Provides live updates to customer
- **Maya Payment**: Handles authorization holds and captures

---

## 📋 **Table of Contents**

1. [Creating a Delivery](#1-creating-a-delivery)
2. [Driver Pairing Process](#2-driver-pairing-process)
3. [Real-Time Tracking](#3-real-time-tracking)
4. [Status Updates Flow](#4-status-updates-flow)
5. [Payment Flow](#5-payment-flow)
6. [Multi-Stop Deliveries](#6-multi-stop-deliveries)
7. [Technical Architecture](#7-technical-architecture)

---

## 1. Creating a Delivery

### **User Journey:**

#### **Step 1: Location Selection Screen**
```
User Flow:
1. User opens app → Lands on Location Selection Screen
2. Map loads with user's current location (GPS)
3. User enters pickup address (inline search results within modal)
4. User enters delivery address (inline search results within modal)
5. User selects vehicle type (Motorcycle, Sedan, SUV, Van, Truck)
6. (Optional) Add multiple stops for multi-stop delivery
7. System shows estimated price immediately (Haversine calculation)
8. System fetches accurate server quote (Mapbox Directions API)
9. User enters contact details for sender/receiver
10. User reviews final pricing (includes additional stop charges)
11. User selects payment method (Maya Wallet)
12. User taps "Book Delivery"
```

**Pricing Display:**
- **Single Delivery**: Shows server quote from `quote` edge function
- **Multi-Stop**: Shows estimated price first (with "Est." badge), then accurate quote
- **Quote Components**: Base fare + Distance charge + Additional stop charges + 12% VAT

#### **Step 2: Backend Delivery Creation**

**File:** `lib/services/delivery_service.dart`

```dart
static Future<String> createDelivery({
  required String pickupAddress,
  required double pickupLatitude,
  required double pickupLongitude,
  required String deliveryAddress,
  required double deliveryLatitude,
  required double deliveryLongitude,
  required String vehicleTypeId,
  required double estimatedPrice,
  // ... other params
}) async {
  // 1. Create delivery record in Supabase
  final response = await Supabase.instance.client
    .from('deliveries')
    .insert({
      'customer_id': currentUser.id,
      'pickup_address': pickupAddress,
      'delivery_address': deliveryAddress,
      'vehicle_type_id': vehicleTypeId,
      'estimated_price': estimatedPrice,
      'status': 'pending', // Initial status
      'pickup_latitude': pickupLatitude,
      'pickup_longitude': pickupLongitude,
      'delivery_latitude': deliveryLatitude,
      'delivery_longitude': deliveryLongitude,
      // ... sender/receiver details
    })
    .select('id')
    .single();

  final deliveryId = response['id'];

  // 2. Create payment authorization hold (Maya)
  await PaymentService.createAuthorizationHold(
    deliveryId: deliveryId,
    amount: estimatedPrice,
  );

  // 3. Trigger driver matching
  await _triggerDriverMatching(deliveryId);

  return deliveryId;
}
```

#### **Database State After Creation:**

**Table: `deliveries`**
```sql
id: uuid (auto-generated)
customer_id: uuid (from auth.users)
status: 'pending'
pickup_address: "123 Main St, Quezon City"
pickup_latitude: 14.6091
pickup_longitude: 121.0223
delivery_address: "456 Oak Ave, Makati"
delivery_latitude: 14.5547
delivery_longitude: 121.0244
vehicle_type_id: uuid (from vehicle_types)
estimated_price: 150.00
estimated_distance_km: 5.2
estimated_duration_minutes: 15
sender_name: "Juan Dela Cruz"
sender_phone: "09171234567"
receiver_name: "Maria Santos"
receiver_phone: "09189876543"
payment_method: "maya_wallet"
maya_payment_id: "pay_abc123..."
maya_authorization_id: "auth_xyz789..."
created_at: 2025-11-05T10:30:00Z
```

---

## 2. Driver Pairing Process

### **How Driver Matching Works:**

SwiftDash uses a **proximity-based matching system** that finds available drivers near the pickup location.

#### **Step 1: Finding Available Drivers**

**File:** `supabase/functions/find-drivers/index.ts` (Edge Function)

```typescript
// Triggered after delivery creation
export async function findAvailableDrivers(deliveryId: string) {
  // 1. Get delivery details
  const delivery = await supabase
    .from('deliveries')
    .select('*, vehicle_types(*)')
    .eq('id', deliveryId)
    .single();

  // 2. Find drivers within 5km radius
  const availableDrivers = await supabase.rpc('find_nearby_drivers', {
    p_latitude: delivery.pickup_latitude,
    p_longitude: delivery.pickup_longitude,
    p_radius_km: 5.0,
    p_vehicle_type_id: delivery.vehicle_type_id,
  });

  // 3. Create driver offers
  for (const driver of availableDrivers) {
    await supabase.from('driver_offers').insert({
      delivery_id: deliveryId,
      driver_id: driver.id,
      status: 'pending',
      expires_at: new Date(Date.now() + 2 * 60 * 1000), // 2 min expiry
    });

    // 4. Send push notification to driver app
    await sendDriverNotification(driver.id, {
      title: 'New Delivery Offer',
      body: `${delivery.estimated_distance_km}km - ₱${delivery.estimated_price}`,
      data: { delivery_id: deliveryId },
    });
  }

  // 5. Update delivery status
  await supabase
    .from('deliveries')
    .update({ status: 'finding_driver' })
    .eq('id', deliveryId);
}
```

#### **Step 2: Driver Accepts Offer**

**Driver App Actions:**
1. Driver receives push notification
2. Driver views delivery details (pickup, dropoff, price, distance)
3. Driver taps "Accept Delivery"
4. Driver app sends acceptance to backend

**Backend Processing:**
```typescript
// When driver accepts
export async function acceptDeliveryOffer(offerId: string, driverId: string) {
  // 1. Update offer status
  await supabase
    .from('driver_offers')
    .update({ 
      status: 'accepted',
      accepted_at: new Date(),
    })
    .eq('id', offerId);

  // 2. Get delivery ID from offer
  const offer = await supabase
    .from('driver_offers')
    .select('delivery_id')
    .eq('id', offerId)
    .single();

  // 3. Assign driver to delivery
  await supabase
    .from('deliveries')
    .update({ 
      driver_id: driverId,
      status: 'driver_assigned',
      driver_assigned_at: new Date(),
    })
    .eq('id', offer.delivery_id);

  // 4. Reject all other pending offers for this delivery
  await supabase
    .from('driver_offers')
    .update({ status: 'rejected' })
    .eq('delivery_id', offer.delivery_id)
    .neq('id', offerId);

  // 5. Notify customer via Ably
  await ablyClient.channels.get(`delivery:${offer.delivery_id}`).publish('driver_assigned', {
    driver_id: driverId,
    status: 'driver_assigned',
  });
}
```

#### **Database State After Driver Assignment:**

**Table: `deliveries`**
```sql
status: 'driver_assigned' (updated from 'pending')
driver_id: uuid (assigned)
driver_assigned_at: 2025-11-05T10:31:30Z
```

**Table: `driver_offers`**
```sql
-- Accepted offer
id: uuid
delivery_id: uuid
driver_id: uuid (the one who accepted)
status: 'accepted'
accepted_at: 2025-11-05T10:31:30Z

-- Rejected offers (other drivers)
status: 'rejected'
```

---

## 3. Real-Time Tracking

### **How Tracking Works:**

Once a driver is assigned, the customer app subscribes to real-time updates via **Ably Realtime**.

#### **Customer App Subscription**

**File:** `lib/services/customer_ably_realtime_service.dart`

```dart
class CustomerAblyRealtimeService {
  late ably.Realtime realtimeClient;

  Future<void> subscribeToDelivery(String deliveryId) async {
    final channel = realtimeClient.channels.get('delivery:$deliveryId');

    // 1. Subscribe to driver location updates
    channel.subscribe(name: 'driver_location').listen((message) {
      final location = message.data as Map<String, dynamic>;
      _updateDriverLocation(
        latitude: location['latitude'],
        longitude: location['longitude'],
        speed: location['speed'],
        bearing: location['bearing'],
      );
    });

    // 2. Subscribe to status updates
    channel.subscribe(name: 'status_update').listen((message) {
      final newStatus = message.data['status'] as String;
      _updateDeliveryStatus(newStatus);
    });

    // 3. Subscribe to multi-stop updates
    channel.subscribe(name: 'stop_update').listen((message) {
      final stopData = message.data as Map<String, dynamic>;
      _updateStopStatus(stopData);
    });
  }
}
```

#### **Driver App Publishing**

**Driver App (External) sends updates:**

```javascript
// Driver app publishes location every 3-5 seconds
const channel = ably.channels.get(`delivery:${deliveryId}`);

// Send location update
await channel.publish('driver_location', {
  latitude: currentPosition.latitude,
  longitude: currentPosition.longitude,
  speed: currentPosition.speed,
  bearing: currentPosition.bearing,
  accuracy: currentPosition.accuracy,
  timestamp: new Date().toISOString(),
});

// Send status update
await channel.publish('status_update', {
  status: 'driver_en_route',
  timestamp: new Date().toISOString(),
});
```

#### **Tracking Screen Updates**

**File:** `lib/screens/tracking_screen.dart`

The tracking screen receives real-time updates and displays:

1. **Driver Location on Map**
   - Blue marker shows driver's current position
   - Updates every 3-5 seconds
   - Animates marker movement smoothly

2. **ETA Calculation**
   - Uses Mapbox Matrix API for traffic-aware routing
   - Calculates distance from driver → pickup → dropoff
   - Updates client-side ETA based on driver speed

3. **Status Updates**
   - Shows current delivery status in real-time
   - Updates progress indicators
   - Triggers navigation to completion screen when delivered

```dart
void _handleStatusUpdate(String newStatus) {
  setState(() {
    _delivery = _delivery?.copyWith(status: newStatus);
  });

  // Navigate to completion screen on delivery
  if (newStatus == 'delivered' && !_isNavigatingToCompletion) {
    _isNavigatingToCompletion = true;
    context.go('/completion', extra: _delivery);
  }
}

void _handleDriverLocationUpdate(Map<String, dynamic> location) {
  setState(() {
    _driverLocation = location;
    _lastLocationUpdate = DateTime.now();
  });

  // Update ETA based on new location
  _updateClientSideETA(
    location['latitude'],
    location['longitude'],
  );

  // Update map camera to show driver
  _updateMapCamera();
}
```

---

## 4. Status Updates Flow

### **Delivery Status Lifecycle:**

```
pending
   ↓
finding_driver
   ↓
driver_offered (driver sees offer in their app)
   ↓
driver_assigned (driver accepts)
   ↓
driver_en_route (driver heading to pickup)
   ↓
arrived_at_pickup (driver arrives at pickup location)
   ↓
picked_up (driver picks up package)
   ↓
in_transit (driver heading to dropoff/first stop)
   ↓
at_destination (driver arrives at dropoff/stop location)
   ↓
delivered (package delivered successfully)

Multi-Stop Flow:
in_transit → at_destination (stop 1) → in_transit (to stop 2) → 
at_destination (stop 2) → ... → delivered (final stop)
```

**Note:** The `at_destination` status was recently fixed to properly trigger when driver arrives at delivery/stop locations. Previously had issues with status flow timing.

### **Status Update Mechanism:**

#### **1. Driver App Updates Status**
```javascript
// Driver taps "I've Arrived" at pickup
async function updateDeliveryStatus(deliveryId, newStatus) {
  // Update database
  await supabase
    .from('deliveries')
    .update({ 
      status: newStatus,
      [`${newStatus}_at`]: new Date(),
    })
    .eq('id', deliveryId);

  // Publish to Ably for real-time updates
  const channel = ably.channels.get(`delivery:${deliveryId}`);
  await channel.publish('status_update', {
    status: newStatus,
    timestamp: new Date().toISOString(),
  });
}
```

#### **2. Customer App Receives Update**
```dart
// Ably subscription receives status update
_statusUpdateSubscription = _realtimeService.channel
  .subscribe(name: 'status_update')
  .listen((message) {
    final newStatus = message.data['status'] as String;
    
    if (mounted) {
      setState(() {
        _delivery = _delivery?.copyWith(status: newStatus);
      });
      
      // Show notification to user
      _showStatusNotification(newStatus);
    }
  });
```

#### **3. Database Triggers**

**File:** `supabase/migrations/xxx_delivery_status_triggers.sql`

```sql
-- Auto-update timestamps when status changes
CREATE OR REPLACE FUNCTION update_delivery_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  -- Update appropriate timestamp column based on new status
  CASE NEW.status
    WHEN 'driver_assigned' THEN
      NEW.driver_assigned_at = NOW();
    WHEN 'driver_en_route' THEN
      NEW.driver_en_route_at = NOW();
    WHEN 'arrived_at_pickup' THEN
      NEW.arrived_at_pickup_at = NOW();
    WHEN 'picked_up' THEN
      NEW.picked_up_at = NOW();
    WHEN 'in_transit' THEN
      NEW.in_transit_at = NOW();
    WHEN 'arrived_at_dropoff' THEN
      NEW.arrived_at_dropoff_at = NOW();
    WHEN 'delivered' THEN
      NEW.delivered_at = NOW();
  END CASE;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER delivery_status_timestamp_trigger
  BEFORE UPDATE ON deliveries
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION update_delivery_status_timestamp();
```

---

## 5. Payment Flow

### **Maya Authorization Hold → Capture Flow:**

#### **Step 1: Authorization Hold (During Delivery Creation)**

```dart
// When delivery is created
await PaymentService.createAuthorizationHold(
  deliveryId: deliveryId,
  amount: estimatedPrice,
);
```

**What happens:**
1. Customer's Maya wallet is authorized for the estimated amount
2. Funds are **held** but not yet captured
3. Customer can still use their wallet, but the held amount is reserved
4. Authorization expires after 7 days if not captured

**Database State:**
```sql
-- deliveries table
maya_payment_id: "pay_abc123..."
maya_authorization_id: "auth_xyz789..."
estimated_price: 150.00
final_price: NULL (not yet calculated)
```

#### **Step 2: Payment Capture (After Delivery Completion)**

```dart
// When driver marks delivery as delivered
await PaymentService.capturePayment(
  deliveryId: deliveryId,
  finalAmount: calculatedFinalPrice,
);
```

**What happens:**
1. Final price is calculated based on actual distance/time
2. If final price ≤ estimated price: Capture exact amount
3. If final price > estimated price: Capture estimated amount (driver loses extra)
4. Authorization hold is converted to actual charge
5. Funds are transferred from customer to platform

**Database State:**
```sql
-- deliveries table
final_price: 145.00 (actual calculated price)
maya_capture_id: "cap_def456..."
payment_status: 'captured'
delivered_at: 2025-11-05T11:00:00Z
```

---

## 6. Multi-Stop Deliveries

### **Multi-Stop Pricing:**

SwiftDash uses a **two-phase pricing system** for multi-stop deliveries to provide instant feedback while fetching accurate quotes.

#### **Phase 1: Client-Side Estimation (Haversine)**

**File:** `lib/screens/location_selection_screen.dart`

```dart
double _calculateMultiStopPrice() {
  if (!_isMultiStopMode || _dropoffStops.isEmpty) return 0;

  double totalDistance = 0;
  
  // Calculate pickup to first stop
  totalDistance += _haversineDistanceKm(
    _pickupLatLng!.latitude,
    _pickupLatLng!.longitude,
    _dropoffStops[0].latitude!,
    _dropoffStops[0].longitude!,
  );
  
  // Calculate between each stop
  for (int i = 0; i < _dropoffStops.length - 1; i++) {
    totalDistance += _haversineDistanceKm(
      _dropoffStops[i].latitude!,
      _dropoffStops[i].longitude!,
      _dropoffStops[i + 1].latitude!,
      _dropoffStops[i + 1].longitude!,
    );
  }
  
  // Calculate pricing
  final basePrice = _selectedVehicleType!.basePrice;
  final pricePerKm = _selectedVehicleType!.pricePerKm;
  final additionalStopCharge = _selectedVehicleType!.additionalStopCharge;
  
  final distanceCharge = totalDistance * pricePerKm;
  final stopCharges = _dropoffStops.length * additionalStopCharge;
  final subtotal = basePrice + distanceCharge + stopCharges;
  final vat = subtotal * 0.12; // 12% VAT
  
  return subtotal + vat;
}

double _haversineDistanceKm(double lat1, double lon1, double lat2, double lon2) {
  const double earthRadius = 6371; // Earth's radius in kilometers
  
  final dLat = _degreesToRadians(lat2 - lat1);
  final dLon = _degreesToRadians(lon2 - lon1);
  
  final a = math.sin(dLat / 2) * math.sin(dLat / 2) +
      math.cos(_degreesToRadians(lat1)) *
          math.cos(_degreesToRadians(lat2)) *
          math.sin(dLon / 2) *
          math.sin(dLon / 2);
  
  final c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
  return earthRadius * c;
}
```

**When Used:**
- Shows immediately when user adds stops
- Displays with "Est." badge to indicate estimation
- Provides instant feedback without waiting for server

#### **Phase 2: Server-Side Accurate Quote (Mapbox Directions API)**

**File:** `supabase/functions/quote_multi_stop/index.ts`

```typescript
async function getMapboxMultiStopDistance(
  pickup: Location,
  dropoffs: Location[]
): Promise<number> {
  // Build coordinates string: pickup;stop1;stop2;...;stopN
  const coordinates = [
    `${pickup.longitude},${pickup.latitude}`,
    ...dropoffs.map(d => `${d.longitude},${d.latitude}`)
  ].join(';');

  const mapboxToken = Deno.env.get('MAPBOX_ACCESS_TOKEN');
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}`;
  
  const response = await fetch(`${url}?access_token=${mapboxToken}&geometries=geojson`);
  const data = await response.json();
  
  if (data.routes && data.routes.length > 0) {
    const distanceMeters = data.routes[0].distance;
    return distanceMeters / 1000; // Convert to kilometers
  }
  
  // Fallback to Haversine if Mapbox fails
  return calculateHaversineTotal(pickup, dropoffs);
}

// Calculate accurate pricing
const distanceKm = await getMapboxMultiStopDistance(pickup, dropoffs);
const totalStops = dropoffs.length;

const basePrice = vehicleType.base_price;
const pricePerKm = vehicleType.price_per_km;
const additionalStopCharge = vehicleType.additional_stop_charge;

const distanceCharge = distanceKm * pricePerKm;
const stopCharges = totalStops * additionalStopCharge;
const subtotal = basePrice + distanceCharge + stopCharges;
const vat = subtotal * 0.12; // 12% VAT
const total = subtotal + vat;

return {
  distanceKm,
  totalStops,
  pricing: {
    base: basePrice,
    perKm: pricePerKm,
    distanceCharge,
    additionalStopCharge,
    stopCharges,
    subtotal,
    vat,
    total,
  },
};
```

**When Used:**
- Automatically fetches when stops are added/removed/reordered
- Uses Mapbox Directions API for traffic-aware routing
- Handles up to 24 waypoints (25 coordinates total including pickup)
- Falls back to Haversine if Mapbox API fails
- Replaces estimated price with accurate quote

**Pricing Components:**
```
Base Price:           ₱50.00
Distance Charge:      15.5 km × ₱10/km = ₱155.00
Additional Stops:     3 stops × ₱20/stop = ₱60.00
Subtotal:             ₱265.00
VAT (12%):            ₱31.80
──────────────────────────────
TOTAL:                ₱296.80
```

#### **Quote Fetching Service**

**File:** `lib/services/delivery_service.dart`

```dart
// Single delivery quote
static Future<Map<String, dynamic>> getQuote({
  required double pickupLatitude,
  required double pickupLongitude,
  required double deliveryLatitude,
  required double deliveryLongitude,
  required String vehicleTypeId,
}) async {
  final response = await Supabase.instance.client.functions.invoke(
    'quote',
    body: {
      'pickupLatitude': pickupLatitude,
      'pickupLongitude': pickupLongitude,
      'deliveryLatitude': deliveryLatitude,
      'deliveryLongitude': deliveryLongitude,
      'vehicleTypeId': vehicleTypeId,
    },
  );
  
  return response.data;
}

// Multi-stop delivery quote
static Future<Map<String, dynamic>> getMultiStopQuote({
  required double pickupLatitude,
  required double pickupLongitude,
  required List<Map<String, double>> dropoffLocations,
  required String vehicleTypeId,
}) async {
  final response = await Supabase.instance.client.functions.invoke(
    'quote_multi_stop',
    body: {
      'pickup': {
        'latitude': pickupLatitude,
        'longitude': pickupLongitude,
      },
      'dropoffs': dropoffLocations,
      'vehicleTypeId': vehicleTypeId,
    },
  );
  
  return response.data;
}
```

**Quote Triggers:**
- User adds a stop → Fetch new quote
- User removes a stop → Fetch new quote
- User reorders stops → Fetch new quote
- User changes vehicle type → Fetch new quote

### **How Multi-Stop Works:**

#### **Step 1: Creating Multi-Stop Delivery**

```dart
// User adds multiple stops
List<Map<String, dynamic>> additionalStops = [
  {
    'address': 'Stop 1 Address',
    'latitude': 14.5555,
    'longitude': 121.0333,
    'contactName': 'John Doe',
    'contactPhone': '09171111111',
    'instructions': 'Ring doorbell',
  },
  {
    'address': 'Stop 2 Address',
    'latitude': 14.5666,
    'longitude': 121.0444,
    'contactName': 'Jane Smith',
    'contactPhone': '09172222222',
    'instructions': 'Leave at gate',
  },
];

// Create delivery with stops
final deliveryId = await DeliveryService.createDelivery(
  // ... pickup/delivery details
  additionalStops: additionalStops,
);
```

#### **Step 2: Backend Processing**

```dart
// lib/services/delivery_service.dart
static Future<void> _createMultiStopDelivery(
  String deliveryId,
  List<Map<String, dynamic>> stops,
) async {
  for (int i = 0; i < stops.length; i++) {
    await Supabase.instance.client.from('delivery_stops').insert({
      'delivery_id': deliveryId,
      'stop_number': i + 1,
      'address': stops[i]['address'],
      'latitude': stops[i]['latitude'],
      'longitude': stops[i]['longitude'],
      'contact_name': stops[i]['contactName'],
      'contact_phone': stops[i]['contactPhone'],
      'instructions': stops[i]['instructions'],
      'status': 'pending',
    });
  }
}
```

#### **Step 3: Tracking Multi-Stop Progress**

**Database: `delivery_stops` table:**
```sql
id: uuid
delivery_id: uuid (foreign key)
stop_number: 1
address: "Stop 1 Address"
latitude: 14.5555
longitude: 121.0333
contact_name: "John Doe"
contact_phone: "09171111111"
instructions: "Ring doorbell"
status: 'pending' → 'in_progress' → 'completed'
completed_at: NULL (until driver marks complete)
```

#### **Step 4: Driver Updates Stop Status**

**Driver App:**
```javascript
// Driver completes a stop
async function completeStop(stopId) {
  await supabase
    .from('delivery_stops')
    .update({ 
      status: 'completed',
      completed_at: new Date(),
    })
    .eq('id', stopId);

  // Publish update via Ably
  const channel = ably.channels.get(`delivery:${deliveryId}`);
  await channel.publish('stop_update', {
    stop_id: stopId,
    status: 'completed',
  });
}
```

#### **Step 5: Customer Sees Progress**

**Tracking Screen:**
```dart
// Shows multi-stop progress
Widget _buildMultiStopProgress() {
  return Column(
    children: _stops.map((stop) {
      return ListTile(
        leading: _buildStopIcon(stop.status),
        title: Text('Stop ${stop.stopNumber}'),
        subtitle: Text(stop.address),
        trailing: _buildStopStatus(stop.status),
      );
    }).toList(),
  );
}
```

---

## 7. Technical Architecture

### **System Components:**

```
┌─────────────────────────────────────────────────────────┐
│                    CUSTOMER APP                         │
│  - Location Selection Screen                            │
│  - Tracking Screen (real-time updates)                  │
│  - Order History                                        │
└─────────────────────────────────────────────────────────┘
                          ↓ ↑
                    (HTTP + Ably)
                          ↓ ↑
┌─────────────────────────────────────────────────────────┐
│                  SUPABASE BACKEND                       │
│  - PostgreSQL Database (deliveries, drivers, etc.)      │
│  - Edge Functions (driver matching, payments)           │
│  - Realtime (database change subscriptions)             │
│  - Auth (customer authentication)                       │
└─────────────────────────────────────────────────────────┘
                          ↓ ↑
                    (Webhooks + API)
                          ↓ ↑
┌─────────────────────────────────────────────────────────┐
│                   EXTERNAL SERVICES                     │
│  - Ably Realtime (live location/status updates)         │
│  - Maya Payment (authorization holds + captures)        │
│  - Mapbox (geocoding, routing, Matrix API)             │
│  - Push Notifications (driver app alerts)               │
└─────────────────────────────────────────────────────────┘
                          ↓ ↑
                      (Push + API)
                          ↓ ↑
┌─────────────────────────────────────────────────────────┐
│                    DRIVER APP                           │
│  - Receive delivery offers                              │
│  - Accept/reject deliveries                             │
│  - Update status (en route, arrived, picked up, etc.)   │
│  - Send GPS location every 3-5 seconds                  │
│  - Complete multi-stop deliveries                       │
└─────────────────────────────────────────────────────────┘
```

### **Data Flow Diagram:**

```
DELIVERY CREATION:
Customer App → Supabase → Edge Function → Database
     ↓
  Creates delivery record (status: 'pending')
     ↓
  Creates Maya authorization hold
     ↓
  Triggers driver matching
     ↓
  Sends push notifications to nearby drivers

DRIVER PAIRING:
Driver App → Supabase → Update delivery.driver_id
     ↓
  Publish 'driver_assigned' event via Ably
     ↓
  Customer App receives update
     ↓
  Navigate to tracking screen

REAL-TIME TRACKING:
Driver App → Ably Channel → Customer App
     ↓
  GPS location every 3-5 seconds
     ↓
  Status updates (en route, arrived, etc.)
     ↓
  Multi-stop progress updates

DELIVERY COMPLETION:
Driver App → Update status to 'delivered'
     ↓
  Calculate final price
     ↓
  Capture Maya payment
### **Key Files Reference:**

| Component | File | Purpose |
|-----------|------|---------|
| **Delivery Creation** | `lib/services/delivery_service.dart` | Creates deliveries, fetches quotes |
| **Location Selection** | `lib/screens/location_selection_screen.dart` | Address input, pricing display, multi-stop |
| **Address Search** | `lib/widgets/address_input_field.dart` | Inline search results with HybridAddressService |
| **Address Modal** | `lib/widgets/modals/address_input_modal.dart` | Full-screen address input modal |
| **Real-time Updates** | `lib/services/customer_ably_realtime_service.dart` | Subscribes to driver location/status |
| **Tracking UI** | `lib/screens/tracking_screen.dart` | Shows real-time tracking with map |
| **Payment** | `lib/services/payment_service.dart` | Maya authorization holds + captures |
| **Multi-Stop** | `lib/services/multi_stop_service.dart` | Manages multiple delivery stops |
| **Routing** | `lib/services/mapbox_matrix_service.dart` | Traffic-aware routing and ETA |
| **Single Quote** | `supabase/functions/quote/` | Single delivery pricing edge function |
| **Multi-Stop Quote** | `supabase/functions/quote_multi_stop/` | Multi-stop pricing with Mapbox Directions |
| **Driver Matching** | `supabase/functions/find-drivers/` | Edge function for driver pairing | pricing |
| **Real-time Updates** | `lib/services/customer_ably_realtime_service.dart` | Subscribes to driver location/status |
| **Tracking UI** | `lib/screens/tracking_screen.dart` | Shows real-time tracking with map |
| **Payment** | `lib/services/payment_service.dart` | Maya authorization holds + captures |
| **Multi-Stop** | `lib/services/multi_stop_service.dart` | Manages multiple delivery stops |
| **Routing** | `lib/services/mapbox_matrix_service.dart` | Traffic-aware routing and ETA |
| **Driver Matching** | `supabase/functions/find-drivers/` | Edge function for driver pairing |

---

## 🔧 **Testing the Flow**

### **Local Testing Checklist:**

1. ✅ **Create Delivery**
   - Enter pickup and delivery addresses
   - Select vehicle type
   - Add contact details
   - Verify pricing calculation
   - Confirm Maya authorization hold created

2. ✅ **Simulate Driver Assignment**
   - Manually update `deliveries.driver_id` in database
   - Update status to `driver_assigned`
   - Verify customer app receives Ably update

3. ✅ **Simulate Driver Location Updates**
   - Use Ably dashboard to publish test location messages
   - Verify marker moves on customer's map
   - Verify ETA updates in real-time

4. ✅ **Test Status Progression**
   - Manually update status through all states
   - Verify customer sees each status update
   - Verify navigation to completion screen on 'delivered'

5. ✅ **Test Multi-Stop**
   - Create delivery with 2+ stops
   - Verify all stops appear in tracking screen
   - Simulate stop completion via database
   - Verify progress updates in real-time

6. ✅ **Test Payment Capture**
   - Mark delivery as 'delivered'
   - Verify Maya payment capture
   - Verify final price calculation

---

## 📊 **Database Schema Quick Reference**

### **`deliveries` Table:**
```sql
id: uuid PRIMARY KEY
customer_id: uuid REFERENCES auth.users
driver_id: uuid REFERENCES driver_profiles (nullable until assigned)
status: text (pending, finding_driver, driver_assigned, etc.)
pickup_address: text
pickup_latitude: double precision
pickup_longitude: double precision
delivery_address: text
delivery_latitude: double precision
delivery_longitude: double precision
vehicle_type_id: uuid REFERENCES vehicle_types
estimated_price: numeric(10,2)
final_price: numeric(10,2) (nullable until delivered)
estimated_distance_km: double precision
estimated_duration_minutes: integer
sender_name: text
sender_phone: text
receiver_name: text
receiver_phone: text
receiver_instructions: text
payment_method: text
maya_payment_id: text
maya_authorization_id: text
maya_capture_id: text (nullable until captured)
is_multi_stop: boolean
created_at: timestamp
driver_assigned_at: timestamp
picked_up_at: timestamp
delivered_at: timestamp
```

### **`delivery_stops` Table:**
```sql
id: uuid PRIMARY KEY
delivery_id: uuid REFERENCES deliveries
stop_number: integer
address: text
latitude: double precision
longitude: double precision
contact_name: text
contact_phone: text
instructions: text
status: text (pending, in_progress, completed)
completed_at: timestamp
```

### **`driver_offers` Table:**
```sql
id: uuid PRIMARY KEY
delivery_id: uuid REFERENCES deliveries
driver_id: uuid REFERENCES driver_profiles
status: text (pending, accepted, rejected, expired)
created_at: timestamp
expires_at: timestamp
accepted_at: timestamp
```

---

## 🚀 **Production Deployment Notes**

### **Environment Variables Required:**

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Ably
ABLY_CLIENT_KEY=your-ably-key

# Maya Payment
MAYA_PUBLIC_KEY=your-maya-public-key
MAYA_SECRET_KEY=your-maya-secret-key
MAYA_IS_SANDBOX=false

# Mapbox
MAPBOX_ACCESS_TOKEN=your-mapbox-token
```

### **Required External Services:**

1. **Supabase Project** (Database + Backend)
2. **Ably Account** (Realtime messaging)
3. **Maya Account** (Payment processing)
4. **Mapbox Account** (Maps + Routing)
5. **Firebase/OneSignal** (Push notifications for driver app)

---

## 📞 **Support & Troubleshooting**

### **Common Issues:**

**1. Driver not receiving offers**
- Check driver's location is within 5km of pickup
- Verify driver's vehicle type matches delivery
- Check driver's online status in database

**2. Real-time updates not working**
- Verify Ably API key is correct
- Check Ably channel name matches delivery ID
- Ensure customer app subscribed to channel

**3. Payment authorization fails**
- Verify Maya API keys are correct
- Check customer has sufficient balance
- Ensure amount is within Maya limits

**4. ETA not updating**
- Verify Mapbox Matrix API is enabled
## 📝 **Version History**

- **v1.0.0** (Nov 5, 2025) - Initial comprehensive guide
  - Covers full delivery flow from creation to completion
  - Includes real-time tracking and multi-stop deliveries
  - Documents payment authorization and capture flow

- **v1.1.0** (Nov 6, 2025) - Multi-Stop Pricing & UX Updates
  - Added two-phase pricing system (Haversine + Mapbox Directions)
  - Documented quote and quote_multi_stop edge functions
  - Added additional stop charges documentation
  - Updated status flow with `at_destination` status
  - Documented inline address search results UX
  - Added pricing breakdown components
  - Updated file reference table

---

**Last Updated:** November 6, 2025  
**Author:** SwiftDash Development Teamcapture flow

---

**Last Updated:** November 5, 2025  
**Author:** SwiftDash Development Team
