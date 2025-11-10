# 🔔 Firebase Cloud Messaging (FCM) Integration Plan

**Date**: November 9, 2025  
**Purpose**: Send push notifications to driver mobile apps when business dispatchers assign deliveries  
**Current Status**: Edge function prepared, FCM integration TODO

---

## 📋 **Overview**

When a business dispatcher assigns a driver to a delivery via the admin web app, the driver needs to be notified immediately on their mobile device. We use **Firebase Cloud Messaging (FCM)** for this.

### **Current State:**
- ✅ Edge function `assign-business-driver` prepares notification payload
- ✅ Notification payload structure defined
- ❌ **TODO**: Firebase Admin SDK integration
- ❌ **TODO**: FCM token storage and management

---

## 🎯 **What We Need FCM For**

### **Primary Use Case: Driver Assignment Notification**

```
Dispatcher Action                Driver Experience
─────────────────               ───────────────────
1. Selects delivery             
2. Selects driver               
3. Clicks "Assign Driver"       
    ↓                           
4. Edge function validates      
5. Database updates             
6. **FCM sends notification** → 📱 Driver's phone buzzes
                                   "New Business Delivery Assigned"
                                   "Pickup: ABC Corp - ₱150.00"
    ↓                              ↓
7. Driver app polls database    Driver taps notification
8. Discovers new assignment     Opens app → Sees delivery details
```

---

## 🔧 **Technical Architecture**

### **Components Involved:**

```
Business Admin Web App
   ↓ (assigns driver)
Supabase Edge Function (assign-business-driver)
   ↓ (sends notification)
Firebase Cloud Messaging (FCM)
   ↓ (delivers push)
Driver Mobile App (Flutter/React Native)
   ↓ (handles notification)
Driver sees new delivery
```

### **Data Flow:**

```javascript
// 1. Edge function prepares payload
const notificationPayload = {
  notification: {
    title: 'New Business Delivery Assigned',
    body: `Pickup: ${businessName} - ₱${totalAmount}`
  },
  data: {
    type: 'business_delivery_assigned',
    delivery_id: 'uuid',
    business_name: 'ABC Corporation',
    pickup_address: '123 Ayala Ave',
    dropoff_address: '456 BGC',
    total_amount: '150.00',
    auto_accept: 'true'  // Driver app auto-navigates
  }
};

// 2. FCM sends to driver's device using FCM token
await admin.messaging().sendToDevice(fcmToken, notificationPayload);

// 3. Driver app receives notification
// 4. Driver taps → App opens delivery screen
// 5. Driver starts delivery
```

---

## 📝 **Implementation Steps**

### **Phase 1: Firebase Admin SDK Setup** (1-2 hours)

#### **Step 1.1: Create Firebase Project**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create new project or use existing "SwiftDash" project
3. Go to Project Settings → Service Accounts
4. Click "Generate New Private Key"
5. Download JSON file (keep it secure!)

#### **Step 1.2: Store Service Account in Supabase**
```bash
# Upload to Supabase Secrets (secure storage)
# Don't commit this file to git!

# Option A: Store as environment variable
supabase secrets set FIREBASE_SERVICE_ACCOUNT_KEY='<contents of JSON file>'

# Option B: Store as base64 encoded
cat service-account-key.json | base64
supabase secrets set FIREBASE_SERVICE_ACCOUNT_BASE64='<base64 output>'
```

#### **Step 1.3: Install Firebase Admin SDK**
Create `supabase/functions/_shared/firebase-admin.ts`:

```typescript
import { initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

// Parse service account from environment
const serviceAccount: ServiceAccount = JSON.parse(
  Deno.env.get('FIREBASE_SERVICE_ACCOUNT_KEY') || '{}'
);

// Initialize Firebase Admin
const app = initializeApp({
  credential: cert(serviceAccount)
});

const messaging = getMessaging(app);

export { messaging };
```

---

### **Phase 2: Integrate FCM in Edge Function** (30 minutes)

Update `supabase/functions/assign-business-driver/index.ts`:

```typescript
// At the top of the file
import { messaging } from '../_shared/firebase-admin.ts';

// Replace the TODO section (Step 6 in current code)
if (driverProfile?.fcm_token) {
  try {
    console.log(`[assign-business-driver] Sending FCM notification to driver ${driver_id}`);
    
    // Get business name
    const { data: business } = await supabaseAdmin
      .from('business_accounts')
      .select('business_name')
      .eq('id', delivery.business_id)
      .single();

    // Prepare FCM message
    const message = {
      notification: {
        title: 'New Business Delivery Assigned',
        body: `Pickup: ${business?.business_name || 'Business'} - ₱${delivery.total_amount}`
      },
      data: {
        type: 'business_delivery_assigned',
        delivery_id: delivery_id,
        business_name: business?.business_name || 'Business',
        business_id: delivery.business_id || '',
        pickup_address: delivery.pickup_address,
        dropoff_address: delivery.delivery_address,
        total_amount: delivery.total_amount.toString(),
        priority: 'normal',
        assignment_type: assignment_type,
        auto_accept: 'true'
      },
      token: driverProfile.fcm_token
    };

    // Send notification
    const response = await messaging.send(message);
    console.log('[assign-business-driver] FCM sent successfully:', response);
    
  } catch (notificationError) {
    console.error('[assign-business-driver] Failed to send notification:', notificationError);
    // Don't fail the assignment if notification fails
  }
} else {
  console.warn(`[assign-business-driver] No FCM token for driver ${driver_id}`);
}
```

---

### **Phase 3: FCM Token Management** (1 hour)

#### **Challenge:**
Drivers need to provide their FCM token to receive notifications. This happens in the driver mobile app.

#### **Solution:**
The driver app already stores FCM tokens in `driver_profiles.fcm_token`.

**Verification:**
```sql
-- Check if fcm_token column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'driver_profiles' 
  AND column_name = 'fcm_token';

-- If not, create migration:
ALTER TABLE driver_profiles
  ADD COLUMN IF NOT EXISTS fcm_token TEXT NULL;

COMMENT ON COLUMN driver_profiles.fcm_token IS 'Firebase Cloud Messaging token for push notifications';

CREATE INDEX IF NOT EXISTS idx_driver_profiles_fcm_token 
  ON driver_profiles(fcm_token) 
  WHERE fcm_token IS NOT NULL;
```

**Driver App Responsibilities:**
1. On app launch, request notification permissions
2. Get FCM token from Firebase SDK
3. Upload token to `driver_profiles.fcm_token`
4. Refresh token periodically (FCM tokens can expire)

**Example (Flutter):**
```dart
// Driver app code (already implemented by driver team)
import 'package:firebase_messaging/firebase_messaging.dart';

class FCMService {
  static Future<void> initialize() async {
    // Request permissions
    await FirebaseMessaging.instance.requestPermission();
    
    // Get FCM token
    final token = await FirebaseMessaging.instance.getToken();
    
    // Save to database
    await supabase.from('driver_profiles').update({
      'fcm_token': token,
      'updated_at': DateTime.now().toIso8601String()
    }).eq('id', currentDriverId);
  }
}
```

---

### **Phase 4: Testing** (2 hours)

#### **Test Scenarios:**

**Test 1: Successful Notification**
```
1. Dispatcher assigns driver
2. Edge function runs
3. FCM sends notification
4. Driver receives push on phone
5. Driver taps notification
6. App opens to delivery screen
Expected: ✅ Driver sees new delivery
```

**Test 2: Driver Offline**
```
1. Driver closes app / turns off phone
2. Dispatcher assigns driver
3. FCM queues notification
4. Driver opens app later
5. Notification delivers
Expected: ✅ Driver sees notification when online
```

**Test 3: Missing FCM Token**
```
1. Driver never provided FCM token
2. Dispatcher assigns driver
3. Edge function logs warning
4. Assignment still succeeds
5. Driver discovers via polling (30 sec)
Expected: ✅ Assignment works, driver sees it via polling
```

**Test 4: Invalid FCM Token**
```
1. Driver's FCM token expired
2. Dispatcher assigns driver
3. FCM returns error
4. Edge function logs error
5. Assignment still succeeds
Expected: ✅ Assignment works, driver discovers via polling
```

---

## 🚨 **Important Notes**

### **Why Notifications Don't Block Assignment:**
```typescript
// Notice: We wrap FCM in try-catch and don't fail on error
try {
  await messaging.send(message);
} catch (notificationError) {
  console.error('Failed to send notification:', notificationError);
  // DON'T THROW - assignment already succeeded in database
}
```

**Reasoning:**
- Database update is the source of truth
- Driver app polls every 30 seconds as backup
- Notification is a "nice to have" for faster discovery
- Assignment should never fail due to notification issues

### **Notification Delivery Guarantees:**
- **Best effort**: FCM tries to deliver but may fail
- **Queueing**: FCM queues notifications for offline devices
- **Expiration**: Notifications expire after 4 weeks
- **Throttling**: FCM may throttle excessive notifications

---

## 📊 **Cost Considerations**

### **Firebase Cloud Messaging Pricing:**
- **Free**: Unlimited notifications
- **Cost**: $0 (FCM is free for all users)

### **Supabase Edge Functions:**
- **Free tier**: 500K invocations/month
- **Pro tier**: $0.50 per 1M invocations
- **Estimate**: ~1 notification per assignment = negligible cost

---

## 🔐 **Security Best Practices**

### **Service Account Key:**
- ❌ **NEVER** commit to git
- ✅ **ALWAYS** store in Supabase Secrets
- ✅ Use environment variables
- ✅ Rotate keys periodically

### **FCM Tokens:**
- ✅ Stored securely in database
- ✅ Only accessible by driver who owns it
- ✅ Refresh automatically in driver app
- ✅ Remove when driver logs out

### **Notification Data:**
- ❌ Don't send sensitive data (payment info, passwords)
- ✅ Send IDs that app can use to fetch details
- ✅ Validate notification type in driver app
- ✅ Handle malicious payloads gracefully

---

## 🎯 **Next Steps**

### **Priority 1: Firebase Setup (Blocking)**
1. Create/access Firebase project
2. Generate service account key
3. Store in Supabase Secrets
4. Test edge function with real FCM token

### **Priority 2: Integration (2-3 hours)**
1. Create `_shared/firebase-admin.ts`
2. Update edge function to use Firebase Admin SDK
3. Test with driver team's test accounts

### **Priority 3: Validation (1 hour)**
1. Verify FCM token column exists
2. Check driver app updates tokens
3. Test notification delivery end-to-end

### **Priority 4: Monitoring (Optional)**
1. Log notification success/failure rates
2. Alert if FCM quota exceeded
3. Track notification delivery times

---

## 📞 **Coordination with Driver Team**

### **Questions to Ask:**
1. **Do drivers already have FCM tokens?**
   - Check: `SELECT COUNT(*) FROM driver_profiles WHERE fcm_token IS NOT NULL;`
2. **Does driver app handle `business_delivery_assigned` type?**
   - Verify notification handler exists
3. **What happens when driver taps notification?**
   - Does it open delivery screen automatically?
4. **How often do tokens refresh?**
   - Tokens can expire, need refresh strategy

### **What We Provide:**
- Notification payload structure (already defined)
- When notifications are sent (on assignment)
- What data is included (delivery details)

### **What They Provide:**
- Driver app FCM integration confirmation
- Test FCM tokens for staging
- Notification handler implementation

---

## ✅ **Summary**

**Current Progress:**
- ✅ Edge function prepared
- ✅ Notification payload defined
- ✅ Error handling implemented

**Remaining Work:**
- ⏳ Firebase Admin SDK setup (1-2 hours)
- ⏳ FCM integration (30 minutes)
- ⏳ Testing (2 hours)

**Total Time Estimate:** 4-5 hours for full FCM integration

**Dependencies:**
- Firebase project access
- Service account key
- Driver team coordination

**Fallback:**
- Driver app polling works without FCM
- Notifications are enhancement, not requirement
- Can ship without FCM if needed

---

**Ready to implement? Follow Phase 1-4 in order. Start with Firebase project setup and service account key generation.**
