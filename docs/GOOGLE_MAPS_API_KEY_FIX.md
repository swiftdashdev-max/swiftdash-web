# Google Maps API Key Configuration Fix

## Error: ApiTargetBlockedMapError

This error occurs when the API key has restrictions that block the current request.

---

## Quick Fix Steps

### 1. Go to Google Cloud Console
Visit: https://console.cloud.google.com/google/maps-apis/credentials

### 2. Find Your API Key
Look for key: `AIzaSyANfwae0FJo4S8AG74T72n9XoB95y60mQ8`

### 3. Click on the API Key to Edit

---

## Configuration Settings

### ✅ Application Restrictions

**Choose ONE option:**

#### Option A: No Restrictions (for testing)
- Select: **None**
- ⚠️ **Warning**: Only use for testing! Not secure for production.

#### Option B: HTTP Referrers (Recommended for web apps)
- Select: **HTTP referrers (websites)**
- Add these referrer patterns:
  ```
  http://localhost:3000/*
  http://localhost:*/*
  https://yourdomain.com/*
  https://*.yourdomain.com/*
  ```

#### Option C: IP Addresses (if using server-side)
- Only if making requests from server
- Not needed for client-side Places Autocomplete

---

### ✅ API Restrictions

**MUST enable these APIs:**

1. **Maps JavaScript API** ✅ (Required)
2. **Places API** ✅ (Required)
3. **Geocoding API** (Optional - for address validation)
4. **Directions API** (Optional - for routes)

**How to enable:**
1. In API restrictions section, select: **Restrict key**
2. Check the boxes for:
   - ✅ Maps JavaScript API
   - ✅ Places API
   - ✅ Geocoding API
   - ✅ Directions API (if using)

---

## Step-by-Step Visual Guide

### Step 1: Navigate to Credentials
```
Google Cloud Console → Menu (☰) → APIs & Services → Credentials
```

### Step 2: Find Your Key
Look in the "API Keys" section for your key

### Step 3: Click Edit (pencil icon)

### Step 4: Configure Application Restrictions
- For **development/testing**: Choose "None"
- For **production**: Choose "HTTP referrers" and add your domains

### Step 5: Configure API Restrictions
- Click "Restrict key"
- Select these APIs:
  - Maps JavaScript API
  - Places API
  - Geocoding API
  - Directions API

### Step 6: Save
Click "Save" at the bottom

### Step 7: Wait 5 minutes
API key changes can take up to 5 minutes to propagate

---

## Testing After Configuration

1. Open your browser's DevTools (F12)
2. Go to Console tab
3. Clear any errors
4. Refresh the page
5. Try typing in an address field
6. You should see autocomplete suggestions

---

## Still Getting Errors?

### Check the Console for Specific Error Code

#### Error: `RefererNotAllowedMapError`
**Solution**: Add your domain to HTTP referrers list

#### Error: `ApiNotActivatedMapError`
**Solution**: Enable Maps JavaScript API in Google Cloud Console

#### Error: `InvalidKeyMapError`
**Solution**: Check if API key is correct

---

## Alternative: Create New API Key

If issues persist, create a fresh API key:

1. Go to: https://console.cloud.google.com/google/maps-apis/credentials
2. Click: **+ CREATE CREDENTIALS** → API key
3. Copy the new key
4. Click "RESTRICT KEY" immediately
5. Add restrictions as shown above
6. Enable required APIs
7. Save
8. Update the key in your code

---

## Quick Test Command

After configuring, test in browser console:
```javascript
console.log('Google Maps loaded:', typeof google !== 'undefined');
console.log('Places loaded:', typeof google?.maps?.places !== 'undefined');
```

Should see:
```
Google Maps loaded: true
Places loaded: true
```

---

## Contact Support

If still blocked after trying all steps:
- Google Maps Support: https://developers.google.com/maps/support
- Check billing is enabled: https://console.cloud.google.com/billing
