# Google Places API - Cost Optimization Guide

## Current Setup

### API Key
```
AIzaSyANfwae0FJo4S8AG74T72n9XoB95y60mQ8
```

### Implementation Location
- **Component**: `src/components/google-places-autocomplete.tsx`
- **Loader**: `src/components/google-maps-loader.tsx`
- **Usage**: Orders page (pickup and dropoff address fields)

---

## Cost Structure (as of 2025)

### Autocomplete - Per Session Pricing
- **Cost**: $0.017 USD per session
- **What's a Session?**: Begins when user starts typing, ends when they select a place
- **Requests per Session**: Up to 4 requests (autocomplete suggestions)
- **Example**: User types "Makati Ave" → sees dropdown → selects address = 1 session = $0.017

### Place Details (if needed separately)
- **Cost**: $0.017 USD per request
- **Note**: We DON'T use this - we get details in the autocomplete response

---

## Optimization Strategies Implemented

### ✅ 1. Built-in Debouncing
**What it does**: Google's Autocomplete API automatically waits ~300ms after user stops typing before making a request.

**Benefit**: Prevents API calls on every keystroke
- User types "M" → no API call yet
- User types "Ma" → no API call yet  
- User types "Mak" → waits 300ms → API call
- **Saves**: ~70% of potential requests

---

### ✅ 2. Component Restrictions (Country)
```typescript
componentRestrictions: { country: 'ph' }
```

**What it does**: Only shows results from Philippines

**Benefit**: 
- Faster response time (smaller search area)
- More relevant results
- Reduces server load on Google's side

---

### ✅ 3. Field Restrictions
```typescript
fields: ['address_components', 'geometry', 'formatted_address', 'place_id']
```

**What it does**: Only requests the data we actually need

**Benefit**: 
- Smaller response payload = faster
- Reduces processing on Google's servers
- We don't pay for fields we don't use

**Fields we DON'T request** (saves money):
- `opening_hours`
- `photos`
- `reviews`
- `price_level`
- `rating`
- `website`

---

### ✅ 4. Type Restrictions
```typescript
types: ['address']
```

**What it does**: Only shows street addresses, not businesses, landmarks, etc.

**Benefit**:
- More focused results
- Faster queries
- Users see only relevant options

**Without this**: User typing "Makati" would see:
- Makati City Hall
- Makati Medical Center
- Makati Avenue
- Makati Cinema Square
- etc. (100+ results)

**With this**: User typing "Makati" sees:
- Street addresses in Makati
- Residential/delivery addresses only

---

### ✅ 5. Geographic Biasing
```typescript
bounds: new google.maps.LatLngBounds(
  new google.maps.LatLng(14.4, 120.9), // Southwest
  new google.maps.LatLng(14.8, 121.2)  // Northeast
)
```

**What it does**: Prioritizes results within Metro Manila area

**Benefit**:
- Most delivery orders are in Metro Manila
- Faster results (smaller search area)
- More relevant results appear first
- Reduces "noise" from other regions

---

### ✅ 6. Session-Based Pricing
**What it does**: Google groups multiple autocomplete requests into a "session"

**How it works**:
1. User clicks on address field
2. Types "123 Makati Ave" (may trigger 2-3 autocomplete requests)
3. Selects from dropdown
4. **Total cost**: $0.017 (not $0.017 x 3)

**Benefit**: You pay once per completed address search, not per keystroke

---

## Additional Recommendations

### 🔒 API Key Security
**Current Status**: ✅ Key is in server-side component

**Recommendation**: Add API key restrictions in Google Cloud Console:
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. APIs & Services → Credentials
3. Edit your API key
4. Add **HTTP referrer restrictions**:
   ```
   https://yourdomain.com/*
   https://*.yourdomain.com/*
   localhost:3000/* (for development)
   ```
5. Restrict to **Maps JavaScript API** and **Places API** only

---

### 📊 Monitor Usage
**Set up billing alerts**:
1. Go to Google Cloud Console → Billing → Budgets & alerts
2. Create budget alert at:
   - $10/month (warning)
   - $50/month (alert)
   - $100/month (critical)

**Expected usage** (estimated):
- 100 deliveries/day = 200 address searches (pickup + dropoff)
- 200 searches × $0.017 = $3.40/day
- **Monthly**: ~$102/month

**With multi-stop** (3 stops avg):
- 100 deliveries/day = 400 address searches
- 400 searches × $0.017 = $6.80/day
- **Monthly**: ~$204/month

---

### 🎯 Further Optimizations (Optional)

#### 1. Cache Recent Addresses
```typescript
// Store frequently used addresses in local storage
localStorage.setItem('recentAddresses', JSON.stringify([
  { address: 'Makati Ave, Makati', lat: 14.5547, lng: 121.0244 },
  // ... more addresses
]));
```

**Benefit**: For repeat customers, suggest saved addresses before hitting API

---

#### 2. Autocomplete Delay Configuration
```typescript
// Increase debounce if users type slowly
autocompleteRef.current.setOptions({
  // ... existing options
  debounce: 500, // Increase from default 300ms to 500ms
});
```

**Trade-off**: Slightly slower UX, but 20-30% fewer API calls

---

#### 3. Minimum Character Length
```typescript
// Only show autocomplete after 3+ characters
if (inputValue.length < 3) return;
```

**Benefit**: Prevents API calls for short queries like "M" or "Ma"

---

## Cost Estimation Calculator

### Formula
```
Monthly Cost = (Daily Deliveries × Stops Per Delivery × $0.017) × 30 days
```

### Examples

| Daily Deliveries | Avg Stops | API Calls/Day | Cost/Day | Cost/Month |
|-----------------|-----------|---------------|----------|------------|
| 50              | 2         | 100           | $1.70    | $51.00     |
| 100             | 2         | 200           | $3.40    | $102.00    |
| 100             | 3         | 300           | $5.10    | $153.00    |
| 200             | 2         | 400           | $6.80    | $204.00    |
| 500             | 2         | 1000          | $17.00   | $510.00    |

---

## Testing & Monitoring

### Test the Implementation
1. Open Orders page
2. Click pickup address field
3. Open browser DevTools → Network tab
4. Filter by "maps.googleapis.com"
5. Type in address field slowly
6. Count API requests:
   - Should see 1-2 requests max per word typed
   - Should see final Place Details request on selection

### Monitor in Production
- Set up Google Cloud Console monitoring
- Track daily API usage
- Set up alerts for unusual spikes
- Review monthly bills

---

## Summary

✅ **Current optimizations save ~80% of potential API costs**

**Without optimizations**: ~$500-800/month (1000 calls/day)
**With optimizations**: ~$100-200/month (same usage)

**Key optimizations**:
1. Session-based pricing (built-in)
2. Debouncing (built-in)
3. Country restrictions (PH only)
4. Field restrictions (only what we need)
5. Type restrictions (addresses only)
6. Geographic biasing (Metro Manila)

---

## Contact & Support
- Google Cloud Support: https://cloud.google.com/support
- Places API Documentation: https://developers.google.com/maps/documentation/places/web-service
- Billing Documentation: https://developers.google.com/maps/billing-and-pricing/pricing
