# 🚀 SwiftDash Delivery API Documentation

**Version:** 1.0  
**Last Updated:** October 16, 2025  
**Base URL:** `https://your-project.supabase.co`  
**Environment:** Production

---

## 📋 Table of Contents

1. [Authentication](#authentication)
2. [API Endpoints](#api-endpoints)
3. [Create Single Delivery](#create-single-delivery)
4. [Create Multi-Stop Delivery](#create-multi-stop-delivery)
5. [Get Delivery Status](#get-delivery-status)
6. [Update Delivery](#update-delivery)
7. [Cancel Delivery](#cancel-delivery)
8. [List Deliveries](#list-deliveries)
9. [Webhooks](#webhooks)
10. [Error Codes](#error-codes)
11. [Rate Limits](#rate-limits)
12. [Code Examples](#code-examples)

---

## 🔐 Authentication

All API requests require authentication using Supabase API key.

### **Headers Required:**
```http
Content-Type: application/json
apikey: YOUR_SUPABASE_ANON_KEY
Authorization: Bearer YOUR_USER_JWT_TOKEN
```

### **Getting Your API Keys:**
1. Login to Supabase Dashboard
2. Go to Project Settings → API
3. Copy `anon` key (public key for client-side)
4. Copy `service_role` key (secret key for server-side)

⚠️ **IMPORTANT:** Never expose `service_role` key in client-side code!

---

## 📡 API Endpoints

### **Base Endpoint:**
```
https://your-project.supabase.co/rest/v1/
```

### **Available Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/rpc/create_delivery` | Create single-stop delivery |
| POST | `/functions/v1/create-delivery` | Create delivery (Edge Function) |
| POST | `/delivery_stops` | Create multi-stop delivery |
| GET | `/deliveries?id=eq.{delivery_id}` | Get delivery details |
| PATCH | `/deliveries?id=eq.{delivery_id}` | Update delivery |
| DELETE | `/deliveries?id=eq.{delivery_id}` | Cancel delivery |
| GET | `/deliveries?customer_id=eq.{customer_id}` | List customer deliveries |

---

## 📦 Create Single Delivery

### **Endpoint:**
```
POST /functions/v1/book-delivery
```

### **Request Body:**
```json
{
  "vehicleTypeId": "uuid-of-vehicle-type",
  "pickupAddress": "123 Main St, Quezon City, Metro Manila",
  "pickupLat": 14.6760,
  "pickupLng": 121.0437,
  "pickupContactName": "Juan Dela Cruz",
  "pickupContactPhone": "09171234567",
  "pickupInstructions": "Ring doorbell twice",
  "dropoffAddress": "456 Market St, Makati City, Metro Manila",
  "dropoffLat": 14.5547,
  "dropoffLng": 121.0244,
  "dropoffContactName": "Maria Santos",
  "dropoffContactPhone": "09181234567",
  "dropoffInstructions": "Leave at reception",
  "packageDescription": "Documents",
  "packageWeightKg": 0.5,
  "packageValue": 1000.00,
  "paymentBy": "sender",
  "paymentMethod": "cash",
  "paymentStatus": "pending"
}
```

### **Required Fields:**
- `vehicleTypeId` - UUID of vehicle type (motorcycle, sedan, suv, van, truck)
- `pickupAddress` - Full pickup address
- `pickupLat` - Pickup latitude (decimal degrees)
- `pickupLng` - Pickup longitude (decimal degrees)
- `pickupContactName` - Pickup contact person name
- `pickupContactPhone` - Pickup contact phone (Philippine format: 09XXXXXXXXX)
- `dropoffAddress` - Full delivery address
- `dropoffLat` - Delivery latitude (decimal degrees)
- `dropoffLng` - Delivery longitude (decimal degrees)
- `dropoffContactName` - Delivery contact person name
- `dropoffContactPhone` - Delivery contact phone

### **Optional Fields:**
- `pickupInstructions` - Special instructions for pickup
- `dropoffInstructions` - Special instructions for delivery
- `packageDescription` - What's being delivered
- `packageWeightKg` - Package weight in kilograms
- `packageValue` - Declared value in PHP
- `paymentBy` - Who pays: `"sender"` or `"recipient"` (default: `"sender"`)
- `paymentMethod` - Payment method: `"cash"`, `"creditCard"`, `"debitCard"`, `"maya"` (default: `"cash"`)
- `paymentStatus` - Payment status: `"pending"`, `"paid"`, `"failed"` (default: `"pending"`)

### **Response (Success):**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "status": "pending",
  "customer_id": "user-uuid",
  "vehicle_type_id": "vehicle-uuid",
  "pickup_address": "123 Main St, Quezon City, Metro Manila",
  "pickup_latitude": 14.6760,
  "pickup_longitude": 121.0437,
  "pickup_contact_name": "Juan Dela Cruz",
  "pickup_contact_phone": "09171234567",
  "delivery_address": "456 Market St, Makati City, Metro Manila",
  "delivery_latitude": 14.5547,
  "delivery_longitude": 121.0244,
  "delivery_contact_name": "Maria Santos",
  "delivery_contact_phone": "09181234567",
  "package_description": "Documents",
  "package_weight_kg": 0.5,
  "package_value": 1000.00,
  "total_price": 150.00,
  "payment_by": "sender",
  "payment_method": "cash",
  "payment_status": "pending",
  "created_at": "2025-10-16T10:30:00Z",
  "is_multi_stop": false
}
```

### **Response (Error):**
```json
{
  "error": "Invalid coordinates",
  "message": "Pickup coordinates are out of range",
  "code": "INVALID_COORDINATES"
}
```

---

## 🚏 Create Multi-Stop Delivery

### **Endpoint:**
```
POST /functions/v1/create-multi-stop-delivery
```

### **Request Body:**
```json
{
  "vehicleTypeId": "uuid-of-vehicle-type",
  "pickupAddress": "123 Main St, Quezon City, Metro Manila",
  "pickupLat": 14.6760,
  "pickupLng": 121.0437,
  "pickupContactName": "Juan Dela Cruz",
  "pickupContactPhone": "09171234567",
  "pickupInstructions": "Ring doorbell",
  "dropoffStops": [
    {
      "address": "456 Market St, Makati City, Metro Manila",
      "latitude": 14.5547,
      "longitude": 121.0244,
      "contactName": "Maria Santos",
      "contactPhone": "09181234567",
      "instructions": "Leave at reception"
    },
    {
      "address": "789 Park Ave, BGC, Taguig City, Metro Manila",
      "latitude": 14.5504,
      "longitude": 121.0511,
      "contactName": "Pedro Reyes",
      "contactPhone": "09191234567",
      "instructions": "Call upon arrival"
    }
  ],
  "packageDescription": "Multiple parcels",
  "packageWeightKg": 2.5,
  "packageValue": 5000.00,
  "totalPrice": 350.00,
  "paymentBy": "sender",
  "paymentMethod": "creditCard",
  "paymentStatus": "paid",
  "isScheduled": false
}
```

### **Required Fields:**
- `vehicleTypeId` - UUID of vehicle type
- `pickupAddress`, `pickupLat`, `pickupLng` - Pickup location
- `pickupContactName`, `pickupContactPhone` - Pickup contact
- `dropoffStops` - Array of stop objects (minimum 1, maximum 10)
  - Each stop requires:
    - `address` - Full delivery address
    - `latitude`, `longitude` - GPS coordinates
    - `contactName` - Recipient name
    - `contactPhone` - Recipient phone

### **Optional Fields:**
- `pickupInstructions` - Pickup instructions
- Each stop can have `instructions` - Delivery instructions
- `packageDescription`, `packageWeightKg`, `packageValue` - Package details
- `totalPrice` - Total delivery cost (auto-calculated if omitted)
- `isScheduled` - Schedule for later (default: false)
- `scheduledPickupTime` - ISO 8601 datetime if scheduled

### **Response (Success):**
```json
{
  "delivery": {
    "id": "delivery-uuid",
    "status": "pending",
    "customer_id": "user-uuid",
    "is_multi_stop": true,
    "total_stops": 2,
    "total_price": 350.00,
    "created_at": "2025-10-16T10:30:00Z"
  },
  "stops": [
    {
      "id": "stop-1-uuid",
      "delivery_id": "delivery-uuid",
      "stop_number": 1,
      "stop_type": "pickup",
      "address": "123 Main St, Quezon City",
      "latitude": 14.6760,
      "longitude": 121.0437,
      "recipient_name": "Juan Dela Cruz",
      "recipient_phone": "09171234567",
      "status": "pending"
    },
    {
      "id": "stop-2-uuid",
      "delivery_id": "delivery-uuid",
      "stop_number": 2,
      "stop_type": "dropoff",
      "address": "456 Market St, Makati City",
      "latitude": 14.5547,
      "longitude": 121.0244,
      "recipient_name": "Maria Santos",
      "recipient_phone": "09181234567",
      "status": "pending"
    },
    {
      "id": "stop-3-uuid",
      "delivery_id": "delivery-uuid",
      "stop_number": 3,
      "stop_type": "dropoff",
      "address": "789 Park Ave, BGC, Taguig City",
      "latitude": 14.5504,
      "longitude": 121.0511,
      "recipient_name": "Pedro Reyes",
      "recipient_phone": "09191234567",
      "status": "pending"
    }
  ]
}
```

---

## 📊 Get Delivery Status

### **Endpoint:**
```
GET /rest/v1/deliveries?id=eq.{delivery_id}&select=*
```

### **Headers:**
```http
apikey: YOUR_SUPABASE_ANON_KEY
Authorization: Bearer YOUR_JWT_TOKEN
```

### **Response:**
```json
{
  "id": "delivery-uuid",
  "status": "in_transit",
  "customer_id": "user-uuid",
  "driver_id": "driver-uuid",
  "vehicle_type_id": "vehicle-uuid",
  "pickup_address": "123 Main St",
  "delivery_address": "456 Market St",
  "pickup_contact_name": "Juan Dela Cruz",
  "pickup_contact_phone": "09171234567",
  "delivery_contact_name": "Maria Santos",
  "delivery_contact_phone": "09181234567",
  "total_price": 150.00,
  "payment_status": "paid",
  "is_multi_stop": false,
  "created_at": "2025-10-16T10:30:00Z",
  "picked_up_at": "2025-10-16T11:00:00Z",
  "delivered_at": null,
  "current_latitude": 14.5995,
  "current_longitude": 121.0340
}
```

### **Status Values:**
- `pending` - Waiting for driver
- `accepted` - Driver accepted
- `picking_up` - Driver en route to pickup
- `picked_up` - Package picked up
- `in_transit` - Delivering
- `delivered` - Completed
- `cancelled` - Cancelled

---

## 🔄 Update Delivery

### **Endpoint:**
```
PATCH /rest/v1/deliveries?id=eq.{delivery_id}
```

### **Request Body:**
```json
{
  "status": "cancelled",
  "cancellation_reason": "Customer request"
}
```

### **Updatable Fields:**
- `status` - Update delivery status (limited transitions)
- `pickup_instructions` - Update pickup instructions
- `delivery_instructions` - Update delivery instructions
- `cancellation_reason` - If cancelling

⚠️ **Note:** Cannot update after driver picks up package

---

## ❌ Cancel Delivery

### **Endpoint:**
```
PATCH /rest/v1/deliveries?id=eq.{delivery_id}
```

### **Request Body:**
```json
{
  "status": "cancelled",
  "cancellation_reason": "Customer changed plans"
}
```

### **Cancellation Rules:**
- ✅ Can cancel if status is `pending` or `accepted`
- ❌ Cannot cancel if `picking_up`, `picked_up`, or `in_transit`
- 💰 Refund policies apply for paid deliveries

---

## 📋 List Deliveries

### **Endpoint:**
```
GET /rest/v1/deliveries?customer_id=eq.{customer_id}&order=created_at.desc
```

### **Query Parameters:**
| Parameter | Description | Example |
|-----------|-------------|---------|
| `customer_id` | Filter by customer | `eq.user-uuid` |
| `status` | Filter by status | `eq.delivered` |
| `is_multi_stop` | Filter multi-stop | `eq.true` |
| `created_at` | Filter by date | `gte.2025-10-01` |
| `order` | Sort results | `created_at.desc` |
| `limit` | Limit results | `10` |
| `offset` | Pagination | `20` |

### **Example:**
```
GET /rest/v1/deliveries?customer_id=eq.user-123&status=eq.delivered&order=created_at.desc&limit=10
```

---

## 🔔 Webhooks

Subscribe to real-time delivery updates.

### **Available Events:**
- `delivery.created` - New delivery created
- `delivery.accepted` - Driver accepted
- `delivery.picked_up` - Package picked up
- `delivery.in_transit` - Delivery in progress
- `delivery.delivered` - Delivery completed
- `delivery.cancelled` - Delivery cancelled
- `driver.location_updated` - Driver GPS updated

### **Webhook Payload:**
```json
{
  "event": "delivery.picked_up",
  "timestamp": "2025-10-16T11:00:00Z",
  "delivery_id": "delivery-uuid",
  "data": {
    "id": "delivery-uuid",
    "status": "picked_up",
    "driver_id": "driver-uuid",
    "picked_up_at": "2025-10-16T11:00:00Z"
  }
}
```

### **Setup Webhook:**
```http
POST /rest/v1/webhooks
Content-Type: application/json

{
  "url": "https://your-server.com/webhooks/delivery",
  "events": ["delivery.picked_up", "delivery.delivered"],
  "secret": "your-webhook-secret"
}
```

---

## ⚠️ Error Codes

| Code | Message | Description |
|------|---------|-------------|
| `INVALID_COORDINATES` | Invalid coordinates | Lat/Lng out of range |
| `INVALID_PHONE` | Invalid phone number | Wrong format |
| `MISSING_FIELD` | Required field missing | Check request body |
| `INVALID_VEHICLE_TYPE` | Invalid vehicle type | Wrong UUID |
| `NO_DRIVER_AVAILABLE` | No driver available | No online drivers |
| `UNAUTHORIZED` | Unauthorized | Invalid API key |
| `RATE_LIMIT_EXCEEDED` | Too many requests | Slow down |
| `DUPLICATE_DELIVERY` | Duplicate delivery | Already exists |
| `INVALID_STATUS_TRANSITION` | Invalid status change | Cannot update |

---

## 🚦 Rate Limits

| Plan | Requests/Minute | Requests/Hour |
|------|-----------------|---------------|
| Free | 30 | 500 |
| Starter | 100 | 3,000 |
| Business | 500 | 20,000 |
| Enterprise | Unlimited | Unlimited |

**Rate Limit Headers:**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1634400000
```

---

## 💻 Code Examples

### **JavaScript/Node.js**

```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://your-project.supabase.co',
  'your-anon-key'
);

// Create Single Delivery
async function createDelivery() {
  const { data, error } = await supabase.functions.invoke('book-delivery', {
    body: {
      vehicleTypeId: 'vehicle-uuid',
      pickupAddress: '123 Main St, Quezon City',
      pickupLat: 14.6760,
      pickupLng: 121.0437,
      pickupContactName: 'Juan Dela Cruz',
      pickupContactPhone: '09171234567',
      dropoffAddress: '456 Market St, Makati City',
      dropoffLat: 14.5547,
      dropoffLng: 121.0244,
      dropoffContactName: 'Maria Santos',
      dropoffContactPhone: '09181234567',
      packageDescription: 'Documents',
      paymentBy: 'sender',
      paymentMethod: 'cash'
    }
  });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Delivery created:', data);
  return data;
}

// Get Delivery Status
async function getDeliveryStatus(deliveryId) {
  const { data, error } = await supabase
    .from('deliveries')
    .select('*')
    .eq('id', deliveryId)
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Delivery status:', data.status);
  return data;
}

// List Customer Deliveries
async function listDeliveries(customerId) {
  const { data, error } = await supabase
    .from('deliveries')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${data.length} deliveries`);
  return data;
}

// Cancel Delivery
async function cancelDelivery(deliveryId, reason) {
  const { data, error } = await supabase
    .from('deliveries')
    .update({
      status: 'cancelled',
      cancellation_reason: reason
    })
    .eq('id', deliveryId)
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Delivery cancelled');
  return data;
}
```

### **Python**

```python
from supabase import create_client, Client

supabase: Client = create_client(
    "https://your-project.supabase.co",
    "your-anon-key"
)

# Create Single Delivery
def create_delivery():
    response = supabase.functions.invoke("book-delivery", {
        "body": {
            "vehicleTypeId": "vehicle-uuid",
            "pickupAddress": "123 Main St, Quezon City",
            "pickupLat": 14.6760,
            "pickupLng": 121.0437,
            "pickupContactName": "Juan Dela Cruz",
            "pickupContactPhone": "09171234567",
            "dropoffAddress": "456 Market St, Makati City",
            "dropoffLat": 14.5547,
            "dropoffLng": 121.0244,
            "dropoffContactName": "Maria Santos",
            "dropoffContactPhone": "09181234567",
            "packageDescription": "Documents",
            "paymentBy": "sender",
            "paymentMethod": "cash"
        }
    })
    
    return response.json()

# Get Delivery Status
def get_delivery_status(delivery_id):
    response = supabase.table("deliveries") \
        .select("*") \
        .eq("id", delivery_id) \
        .single() \
        .execute()
    
    return response.data

# List Deliveries
def list_deliveries(customer_id):
    response = supabase.table("deliveries") \
        .select("*") \
        .eq("customer_id", customer_id) \
        .order("created_at", desc=True) \
        .limit(10) \
        .execute()
    
    return response.data
```

### **PHP**

```php
<?php
require 'vendor/autoload.php';

use Supabase\CreateClient;

$supabase = CreateClient::create(
    'https://your-project.supabase.co',
    'your-anon-key'
);

// Create Delivery
function createDelivery($supabase) {
    $response = $supabase->functions->invoke('book-delivery', [
        'body' => [
            'vehicleTypeId' => 'vehicle-uuid',
            'pickupAddress' => '123 Main St, Quezon City',
            'pickupLat' => 14.6760,
            'pickupLng' => 121.0437,
            'pickupContactName' => 'Juan Dela Cruz',
            'pickupContactPhone' => '09171234567',
            'dropoffAddress' => '456 Market St, Makati City',
            'dropoffLat' => 14.5547,
            'dropoffLng' => 121.0244,
            'dropoffContactName' => 'Maria Santos',
            'dropoffContactPhone' => '09181234567',
            'packageDescription' => 'Documents',
            'paymentBy' => 'sender',
            'paymentMethod' => 'cash'
        ]
    ]);
    
    return $response;
}

// Get Delivery
function getDelivery($supabase, $deliveryId) {
    $response = $supabase->from('deliveries')
        ->select('*')
        ->eq('id', $deliveryId)
        ->single()
        ->execute();
    
    return $response->data;
}
?>
```

### **cURL**

```bash
# Create Delivery
curl -X POST 'https://your-project.supabase.co/functions/v1/book-delivery' \
  -H 'Content-Type: application/json' \
  -H 'apikey: your-anon-key' \
  -H 'Authorization: Bearer your-jwt-token' \
  -d '{
    "vehicleTypeId": "vehicle-uuid",
    "pickupAddress": "123 Main St, Quezon City",
    "pickupLat": 14.6760,
    "pickupLng": 121.0437,
    "pickupContactName": "Juan Dela Cruz",
    "pickupContactPhone": "09171234567",
    "dropoffAddress": "456 Market St, Makati City",
    "dropoffLat": 14.5547,
    "dropoffLng": 121.0244,
    "dropoffContactName": "Maria Santos",
    "dropoffContactPhone": "09181234567",
    "packageDescription": "Documents"
  }'

# Get Delivery Status
curl -X GET 'https://your-project.supabase.co/rest/v1/deliveries?id=eq.delivery-uuid' \
  -H 'apikey: your-anon-key' \
  -H 'Authorization: Bearer your-jwt-token'

# Cancel Delivery
curl -X PATCH 'https://your-project.supabase.co/rest/v1/deliveries?id=eq.delivery-uuid' \
  -H 'Content-Type: application/json' \
  -H 'apikey: your-anon-key' \
  -H 'Authorization: Bearer your-jwt-token' \
  -d '{
    "status": "cancelled",
    "cancellation_reason": "Customer request"
  }'
```

---

## 🚗 Vehicle Types

Get available vehicle types:

```http
GET /rest/v1/vehicle_types?select=*
```

**Response:**
```json
[
  {
    "id": "motorcycle-uuid",
    "name": "Motorcycle",
    "base_price": 50.00,
    "price_per_km": 8.00,
    "max_weight_kg": 20,
    "icon": "🏍️"
  },
  {
    "id": "sedan-uuid",
    "name": "Sedan",
    "base_price": 100.00,
    "price_per_km": 12.00,
    "max_weight_kg": 100,
    "icon": "🚗"
  },
  {
    "id": "suv-uuid",
    "name": "SUV",
    "base_price": 150.00,
    "price_per_km": 15.00,
    "max_weight_kg": 300,
    "icon": "🚙"
  },
  {
    "id": "van-uuid",
    "name": "Van",
    "base_price": 200.00,
    "price_per_km": 18.00,
    "max_weight_kg": 500,
    "icon": "🚐"
  },
  {
    "id": "truck-uuid",
    "name": "Truck",
    "base_price": 300.00,
    "price_per_km": 25.00,
    "max_weight_kg": 2000,
    "icon": "🚚"
  }
]
```

---

## 🧪 Testing

### **Sandbox Environment:**
```
Base URL: https://your-project.supabase.co
API Key: Use test API keys from Supabase
```

### **Test Cards (for payment testing):**
- **Success:** `4111111111111111`
- **Decline:** `4000000000000002`
- **3D Secure:** `4000002500003155`

---

## 📞 Support

- **Documentation:** https://docs.swiftdash.com
- **Email:** api-support@swiftdash.com
- **Discord:** https://discord.gg/swiftdash
- **Status Page:** https://status.swiftdash.com

---

## 📄 License

This API is proprietary. Usage requires an active SwiftDash account.

**Terms of Service:** https://swiftdash.com/terms  
**Privacy Policy:** https://swiftdash.com/privacy

---

**Last Updated:** October 16, 2025  
**API Version:** 1.0.0
