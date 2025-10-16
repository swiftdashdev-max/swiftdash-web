# 🚀 Supabase Edge Functions Guide for SwiftDash Delivery

**Target Audience:** Web Development Team  
**Last Updated:** October 17, 2025  
**Version:** 1.0

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Edge Functions Architecture](#edge-functions-architecture)
3. [Authentication & Security](#authentication--security)
4. [Core Delivery Functions](#core-delivery-functions)
5. [Database Operations](#database-operations)
6. [Real-time Features](#real-time-features)
7. [Payment Integration](#payment-integration)
8. [Error Handling](#error-handling)
9. [Testing & Development](#testing--development)
10. [Best Practices](#best-practices)

---

## 🎯 Overview

Supabase Edge Functions are TypeScript/JavaScript functions that run on the edge, closer to your users. They provide server-side logic for:

- **Secure delivery creation** with trusted pricing
- **Payment processing** with Maya integration
- **Driver matching** and assignment
- **Real-time updates** and notifications
- **Business logic** that shouldn't run on the client

### Why Edge Functions?

✅ **Security:** Sensitive operations away from client  
✅ **Performance:** Run close to users globally  
✅ **Trusted:** Server-side pricing and validation  
✅ **Scalable:** Auto-scaling based on demand  

---

## 🏗️ Edge Functions Architecture

### Current Edge Functions in SwiftDash:

```
supabase/functions/
├── quote/              # Get delivery pricing
├── book-delivery/      # Create single delivery
├── create-multi-stop-delivery/  # Create multi-stop delivery
├── pair-driver/        # Match driver with delivery
└── shared/            # Shared utilities
    ├── cors.ts
    ├── database.ts
    └── pricing.ts
```

### Function Structure:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request
    const { data } = await req.json()
    
    // Business logic
    const result = await processDelivery(data)
    
    // Return response
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
```

---

## 🔐 Authentication & Security

### 1. **API Key Authentication**

All Edge Functions require proper authentication:

```javascript
// Client-side (Flutter/Web)
const supabase = createClient(
  'https://your-project.supabase.co',
  'your-anon-key'
)

// Call Edge Function
const { data, error } = await supabase.functions.invoke('quote', {
  body: { /* request data */ }
})
```

### 2. **Row Level Security (RLS)**

Database tables use RLS policies:

```sql
-- Example RLS policy for deliveries table
CREATE POLICY "Users can only access their own deliveries" ON deliveries
FOR ALL USING (auth.uid() = customer_id);
```

### 3. **Service Role vs Anon Key**

- **Anon Key:** Client-side operations, RLS enforced
- **Service Role:** Server-side operations, bypass RLS (use carefully)

---

## 📦 Core Delivery Functions

### 1. **Quote Function** (`/functions/quote`)

**Purpose:** Calculate delivery pricing securely on the server

**Request:**
```javascript
const { data, error } = await supabase.functions.invoke('quote', {
  body: {
    vehicleTypeId: "uuid-of-vehicle-type",
    pickup: { lat: 14.6760, lng: 121.0437 },
    dropoff: { lat: 14.5547, lng: 121.0244 },
    weightKg: 2.5,        // Optional
    surge: 1.2           // Optional surge multiplier
  }
})
```

**Response:**
```json
{
  "vehicleTypeId": "uuid",
  "distanceKm": 15.2,
  "estimatedMinutes": 45,
  "basePrice": 100.00,
  "distancePrice": 76.00,
  "surgePrice": 21.12,
  "total": 197.12,
  "breakdown": {
    "base": 100.00,
    "distance": "15.2km × ₱5.00 = ₱76.00",
    "surge": "20% surge applied"
  }
}
```

**Implementation:**
```typescript
// supabase/functions/quote/index.ts
export default async function handler(req: Request) {
  const { vehicleTypeId, pickup, dropoff, weightKg, surge } = await req.json()
  
  // 1. Validate coordinates
  if (!isValidCoordinates(pickup) || !isValidCoordinates(dropoff)) {
    throw new Error('Invalid coordinates')
  }
  
  // 2. Calculate distance using Mapbox/Google
  const distanceKm = await calculateDistance(pickup, dropoff)
  
  // 3. Get vehicle type pricing
  const vehicleType = await getVehicleType(vehicleTypeId)
  
  // 4. Calculate total price
  const pricing = calculatePricing({
    vehicleType,
    distanceKm,
    weightKg,
    surge: surge || 1.0
  })
  
  return pricing
}
```

### 2. **Book Delivery Function** (`/functions/book-delivery`)

**Purpose:** Create a single-stop delivery with atomic operations

**Request:**
```javascript
const { data, error } = await supabase.functions.invoke('book-delivery', {
  body: {
    vehicleTypeId: "uuid",
    pickup: {
      address: "123 Main St, Quezon City",
      location: { lat: 14.6760, lng: 121.0437 },
      contactName: "Juan Dela Cruz",
      contactPhone: "09171234567",
      instructions: "Ring doorbell twice"
    },
    dropoff: {
      address: "456 Market St, Makati City",
      location: { lat: 14.5547, lng: 121.0244 },
      contactName: "Maria Santos", 
      contactPhone: "09181234567",
      instructions: "Leave at reception"
    },
    package: {
      description: "Documents",
      weightKg: 0.5,
      value: 1000.00
    },
    payment: {
      paymentBy: "sender",
      paymentMethod: "cash",
      paymentStatus: "pending"
    }
  }
})
```

**Response:**
```json
{
  "id": "delivery-uuid",
  "status": "pending",
  "customer_id": "user-uuid",
  "total_price": 150.00,
  "estimated_duration": 45,
  "created_at": "2025-10-17T10:30:00Z"
}
```

### 3. **Multi-Stop Delivery Function** (`/functions/create-multi-stop-delivery`)

**Purpose:** Create deliveries with multiple stops and route optimization

**Request:**
```javascript
const { data, error } = await supabase.functions.invoke('create-multi-stop-delivery', {
  body: {
    vehicleTypeId: "uuid",
    pickup: {
      address: "123 Main St, Quezon City",
      location: { lat: 14.6760, lng: 121.0437 },
      contactName: "Juan Dela Cruz",
      contactPhone: "09171234567"
    },
    dropoffStops: [
      {
        address: "456 Market St, Makati City", 
        location: { lat: 14.5547, lng: 121.0244 },
        contactName: "Maria Santos",
        contactPhone: "09181234567"
      },
      {
        address: "789 Park Ave, BGC, Taguig",
        location: { lat: 14.5504, lng: 121.0511 },
        contactName: "Pedro Reyes", 
        contactPhone: "09191234567"
      }
    ],
    package: {
      description: "Multiple parcels",
      weightKg: 2.5
    }
  }
})
```

**What it does:**
1. **Route Optimization:** Uses Mapbox Optimization API to find best route
2. **Atomic Creation:** Creates delivery + all stops in single transaction
3. **Pricing Calculation:** Multi-stop pricing with additional stop charges
4. **Stop Management:** Creates ordered stops with proper sequencing

### 4. **Driver Matching Function** (`/functions/pair-driver`)

**Purpose:** Find and assign available drivers to deliveries

**Request:**
```javascript
const { data, error } = await supabase.functions.invoke('pair-driver', {
  body: {
    deliveryId: "delivery-uuid"
  }
})
```

**Algorithm:**
1. **Find Available Drivers:** Query drivers with status 'online'
2. **Location Filtering:** Drivers within reasonable distance
3. **Vehicle Matching:** Driver's vehicle matches delivery requirements  
4. **Assignment:** Update delivery with driver_id
5. **Notification:** Send push notification to driver

---

## 💾 Database Operations

### Core Tables Structure:

```sql
-- Deliveries table
CREATE TABLE deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES auth.users(id),
    driver_id UUID REFERENCES driver_profiles(id),
    vehicle_type_id UUID REFERENCES vehicle_types(id),
    status TEXT DEFAULT 'pending',
    
    -- Pickup details
    pickup_address TEXT NOT NULL,
    pickup_latitude DOUBLE PRECISION NOT NULL,
    pickup_longitude DOUBLE PRECISION NOT NULL,
    pickup_contact_name TEXT NOT NULL,
    pickup_contact_phone TEXT NOT NULL,
    
    -- Delivery details  
    delivery_address TEXT NOT NULL,
    delivery_latitude DOUBLE PRECISION NOT NULL,
    delivery_longitude DOUBLE PRECISION NOT NULL,
    delivery_contact_name TEXT NOT NULL,
    delivery_contact_phone TEXT NOT NULL,
    
    -- Pricing & Package
    total_price DECIMAL(10,2) NOT NULL,
    package_description TEXT,
    package_weight DECIMAL(5,2),
    
    -- Multi-stop support
    is_multi_stop BOOLEAN DEFAULT FALSE,
    total_stops INTEGER,
    current_stop_index INTEGER DEFAULT 0,
    
    -- Payment info
    payment_by TEXT DEFAULT 'sender',
    payment_method TEXT DEFAULT 'cash', 
    payment_status TEXT DEFAULT 'pending',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Delivery stops table (for multi-stop)
CREATE TABLE delivery_stops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id UUID REFERENCES deliveries(id) ON DELETE CASCADE,
    stop_number INTEGER NOT NULL,
    stop_type TEXT NOT NULL, -- 'pickup' or 'dropoff'
    
    address TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    recipient_name TEXT,
    recipient_phone TEXT,
    
    status TEXT DEFAULT 'pending',
    arrived_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);
```

### RLS Policies:

```sql
-- Enable RLS
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_stops ENABLE ROW LEVEL SECURITY;

-- Customers can only see their own deliveries
CREATE POLICY "customer_deliveries" ON deliveries
FOR ALL USING (auth.uid() = customer_id);

-- Drivers can see assigned deliveries
CREATE POLICY "driver_deliveries" ON deliveries  
FOR SELECT USING (auth.uid() = driver_id);

-- Stops follow delivery permissions
CREATE POLICY "delivery_stops_access" ON delivery_stops
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM deliveries 
        WHERE deliveries.id = delivery_stops.delivery_id
        AND (deliveries.customer_id = auth.uid() OR deliveries.driver_id = auth.uid())
    )
);
```

---

## 🔄 Real-time Features

### 1. **Real-time Subscriptions**

```javascript
// Subscribe to delivery updates
const subscription = supabase
  .channel('delivery-updates')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'deliveries',
    filter: `customer_id=eq.${userId}`
  }, (payload) => {
    console.log('Delivery updated:', payload)
  })
  .subscribe()
```

### 2. **Real-time Driver Location**

```javascript
// Driver broadcasts location (no DB writes)
const channel = supabase.channel(`driver-location-${deliveryId}`)

// Driver side - broadcast location
await channel.send({
  type: 'broadcast',
  event: 'location_update',
  payload: {
    driverId: 'driver-uuid',
    deliveryId: 'delivery-uuid', 
    latitude: 14.6760,
    longitude: 121.0437,
    timestamp: new Date().toISOString()
  }
})

// Customer side - listen for updates
channel.on('broadcast', { event: 'location_update' }, (payload) => {
  updateMapWithDriverLocation(payload)
})
```

### 3. **Driver Status Table**

```sql
-- Lightweight table for real-time driver status
CREATE TABLE driver_current_status (
    driver_id UUID PRIMARY KEY REFERENCES driver_profiles(id),
    status TEXT DEFAULT 'offline', -- 'online', 'busy', 'offline'
    current_latitude DOUBLE PRECISION,
    current_longitude DOUBLE PRECISION,
    current_delivery_id UUID REFERENCES deliveries(id),
    last_updated TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 💳 Payment Integration

### Maya Payment Flow:

```javascript
// 1. Create Maya checkout session (Edge Function)
const { data: checkout } = await supabase.functions.invoke('create-maya-checkout', {
  body: {
    amount: 150.00,
    description: "Delivery Payment",
    deliveryId: "delivery-uuid"
  }
})

// 2. Redirect user to Maya checkout
window.location.href = checkout.checkoutUrl

// 3. Handle webhook (Edge Function)
// Maya calls: POST /functions/maya-webhook
// Validates payment and updates delivery status

// 4. Verify payment status
const { data: delivery } = await supabase
  .from('deliveries')
  .select('payment_status')
  .eq('id', deliveryId)
  .single()
```

### Payment States:
- `pending` - Awaiting payment
- `paid` - Successfully paid
- `failed` - Payment failed
- `cash_pending` - Cash payment on delivery

---

## ❌ Error Handling

### Standardized Error Responses:

```typescript
// Edge Function error handling
try {
  const result = await processDelivery(data)
  return successResponse(result)
} catch (error) {
  console.error('Delivery creation failed:', error)
  
  // Return structured error
  return errorResponse({
    code: 'DELIVERY_CREATION_FAILED',
    message: error.message,
    details: error.details || null
  }, 400)
}

function errorResponse(error: any, status = 400) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}
```

### Common Error Codes:

| Code | Description | Action |
|------|-------------|--------|
| `INVALID_COORDINATES` | Invalid lat/lng | Validate coordinates |
| `VEHICLE_TYPE_NOT_FOUND` | Invalid vehicle type | Check vehicle type ID |
| `NO_DRIVER_AVAILABLE` | No online drivers | Retry or suggest later |
| `PAYMENT_FAILED` | Payment processing failed | Retry payment |
| `RATE_LIMIT_EXCEEDED` | Too many requests | Implement backoff |

---

## 🧪 Testing & Development

### 1. **Local Development**

```bash
# Install Supabase CLI
npm install -g supabase

# Start local development
supabase start

# Serve functions locally
supabase functions serve --debug

# Test function
curl -X POST http://localhost:54321/functions/v1/quote \
  -H "Content-Type: application/json" \
  -d '{"vehicleTypeId":"uuid","pickup":{"lat":14.6760,"lng":121.0437},"dropoff":{"lat":14.5547,"lng":121.0244}}'
```

### 2. **Testing Edge Functions**

```typescript
// tests/quote.test.ts
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts"

Deno.test("Quote calculation test", async () => {
  const response = await fetch("http://localhost:54321/functions/v1/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      vehicleTypeId: "test-uuid",
      pickup: { lat: 14.6760, lng: 121.0437 },
      dropoff: { lat: 14.5547, lng: 121.0244 }
    })
  })
  
  const data = await response.json()
  assertEquals(response.status, 200)
  assertEquals(typeof data.total, "number")
})
```

### 3. **Environment Variables**

```bash
# .env.local
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=your-anon-key
MAPBOX_ACCESS_TOKEN=your-mapbox-token
MAYA_PUBLIC_KEY=your-maya-public-key
MAYA_SECRET_KEY=your-maya-secret-key
```

---

## 🏆 Best Practices

### 1. **Security**
- ✅ Always validate input data
- ✅ Use RLS policies for data access
- ✅ Sanitize user inputs
- ✅ Rate limit API calls
- ❌ Never expose service role keys client-side

### 2. **Performance**
- ✅ Use connection pooling for DB
- ✅ Cache frequently accessed data
- ✅ Minimize external API calls
- ✅ Use database transactions for atomic operations

### 3. **Error Handling**
- ✅ Return consistent error formats
- ✅ Log errors for debugging
- ✅ Provide meaningful error messages
- ✅ Handle network timeouts gracefully

### 4. **Code Organization**

```typescript
// Good structure
supabase/functions/
├── shared/
│   ├── database.ts      # DB utilities
│   ├── pricing.ts       # Pricing logic
│   ├── validation.ts    # Input validation
│   └── types.ts         # TypeScript types
├── quote/
│   └── index.ts
├── book-delivery/
│   └── index.ts
└── pair-driver/
    └── index.ts
```

### 5. **Database Best Practices**
- ✅ Use indexes on frequently queried columns
- ✅ Use UUIDs for primary keys
- ✅ Include proper foreign key constraints
- ✅ Use TIMESTAMPTZ for timestamps
- ✅ Enable RLS on all user-facing tables

---

## 🚀 Deployment

### 1. **Deploy Functions**

```bash
# Deploy specific function
supabase functions deploy quote

# Deploy all functions  
supabase functions deploy

# View logs
supabase functions logs quote
```

### 2. **Environment Variables in Production**

```bash
# Set secrets in Supabase dashboard
supabase secrets set MAPBOX_ACCESS_TOKEN=your-token
supabase secrets set MAYA_SECRET_KEY=your-secret
```

### 3. **Monitoring**

- **Logs:** Check Supabase dashboard for function logs
- **Metrics:** Monitor function execution time and errors
- **Alerts:** Set up alerts for high error rates

---

## 📝 Quick Reference

### Function URLs:
```
https://your-project.supabase.co/functions/v1/quote
https://your-project.supabase.co/functions/v1/book-delivery  
https://your-project.supabase.co/functions/v1/create-multi-stop-delivery
https://your-project.supabase.co/functions/v1/pair-driver
```

### Common Headers:
```javascript
const headers = {
  'Content-Type': 'application/json',
  'apikey': 'your-anon-key',
  'Authorization': `Bearer ${userToken}`
}
```

### Database Connection:
```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)
```

---

## 💡 Tips for Web Team

1. **Start Simple:** Begin with the quote function to understand the pattern
2. **Use TypeScript:** Better type safety and developer experience  
3. **Test Locally:** Use local Supabase development environment
4. **Handle Errors:** Always implement proper error handling
5. **Monitor Performance:** Keep functions fast (<1s execution time)
6. **Security First:** Never trust client-side data, validate everything

---

**Need Help?**
- 📚 [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- 🔧 [Deno Documentation](https://deno.land/manual)
- 💬 Team Slack: #backend-questions

**Contributors:** SwiftDash Development Team  
**Last Review:** October 17, 2025