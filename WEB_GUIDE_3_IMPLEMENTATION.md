# 📘 SWIFTDASH WEB VERSION - PART 3: IMPLEMENTATION GUIDE

**Technical Implementation & Code Examples**  
**Date**: October 26, 2025

---

## 🎯 **OVERVIEW**

This guide shows you **exactly how** to build the SwiftDash web app using the backend services from Part 1 and the customer flow from Part 2.

**We'll cover**:
1. Project setup (React/Vue/Angular examples)
2. Supabase SDK integration
3. Mapbox GL JS setup
4. Google Places Autocomplete
5. Maya payment integration
6. Ably real-time tracking
7. Authentication flow
8. Complete code examples for key features

---

## 🚀 **PROJECT SETUP**

### **Option A: React (Recommended)**

```bash
# Create new React app
npx create-react-app swiftdash-web
cd swiftdash-web

# Install dependencies
npm install @supabase/supabase-js
npm install mapbox-gl
npm install @mapbox/mapbox-gl-directions
npm install @react-google-maps/api
npm install ably
npm install axios
npm install react-router-dom
npm install zustand  # State management

# Install dev dependencies
npm install --save-dev @types/mapbox-gl
```

### **Option B: Vue 3**

```bash
# Create Vue app
npm create vue@latest swiftdash-web
cd swiftdash-web

# Install dependencies
npm install @supabase/supabase-js
npm install mapbox-gl
npm install vue-google-maps-community-fork
npm install ably
npm install axios
npm install vue-router
npm install pinia  # State management
```

### **Option C: Next.js (For SEO)**

```bash
# Create Next.js app
npx create-next-app swiftdash-web
cd swiftdash-web

# Install same dependencies as React
npm install @supabase/supabase-js mapbox-gl ably axios zustand
```

---

## 📦 **ENVIRONMENT VARIABLES**

Create `.env` file:

```bash
# Supabase
VITE_SUPABASE_URL=https://lygzxmhskkqrntnmxtbb.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5Z3p4bWhza2txcm50bm14dGJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTEyNjk0MzIsImV4cCI6MjAyNjg0NTQzMn0.AXpznyj7ra4eUoDiYQmqEQ_enUzT-McFkC3r4J5p3cw

# Mapbox (Public token for frontend)
VITE_MAPBOX_ACCESS_TOKEN=pk.eyJ1Ijoicm9kbmV5dGV0IiwiYSI6ImNseDZ4N3AxbzJmYncybG9ibmhyOTZ4ODAifQ.gMB1qU5LR2dLdJqM0lJ0jQ

# Google Places
VITE_GOOGLE_PLACES_API_KEY=AIzaSyBUC3QHH7_o1PVEZHxRVKVmPiZo1X9dD_w

# Maya Payment (Public key only)
VITE_MAYA_PUBLIC_KEY=pk-MFsDKJXzLYMjOhMiT5P8541WCBWIDXgVn78ZpPIPXRSL

# Ably (Client key only)
VITE_ABLY_CLIENT_KEY=client_key_here

# App Config
VITE_APP_ENV=production
VITE_MAP_PROVIDER=mapbox
```

**⚠️ SECURITY NOTES**:
- **NEVER** expose secret tokens in frontend code
- Use environment variables for all keys
- Server-side operations (Maya payment capture, driver pairing) must use Edge Functions
- Only public/client keys in web app

---

## 🔧 **1. SUPABASE CLIENT SETUP**

### **Initialize Supabase** (`src/lib/supabase.js`):

```javascript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Helper to get current user
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  return user;
};

// Helper to check auth status
export const isAuthenticated = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
};
```

---

## 🔐 **2. AUTHENTICATION IMPLEMENTATION**

### **Login Component** (`src/components/Login.jsx`):

```javascript
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Login with Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (error) throw error;

      // Fetch customer profile
      const { data: profile, error: profileError } = await supabase
        .from('customer_profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError) throw profileError;

      // Save to state (Zustand/Redux/Context)
      // userStore.setUser(profile);

      // Redirect to location selection
      navigate('/location');

    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <h1>Welcome to SwiftDash</h1>
      
      <form onSubmit={handleLogin}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        
        {error && <div className="error">{error}</div>}
        
        <button type="submit" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
      
      <p>Don't have an account? <a href="/signup">Sign Up</a></p>
    </div>
  );
}
```

### **Signup Component** (`src/components/Signup.jsx`):

```javascript
import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Signup() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validate
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
            phone: formData.phone
          }
        }
      });

      if (authError) throw authError;

      // 2. Create customer profile
      const { error: profileError } = await supabase
        .from('customer_profiles')
        .insert({
          id: authData.user.id,
          first_name: formData.firstName,
          last_name: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          created_at: new Date().toISOString()
        });

      if (profileError) throw profileError;

      // 3. Auto-login (already logged in after signUp)
      alert('Account created! Redirecting...');
      window.location.href = '/location';

    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSignup}>
      <input
        placeholder="First Name"
        value={formData.firstName}
        onChange={(e) => setFormData({...formData, firstName: e.target.value})}
        required
      />
      <input
        placeholder="Last Name"
        value={formData.lastName}
        onChange={(e) => setFormData({...formData, lastName: e.target.value})}
        required
      />
      <input
        type="email"
        placeholder="Email"
        value={formData.email}
        onChange={(e) => setFormData({...formData, email: e.target.value})}
        required
      />
      <input
        placeholder="Phone (09XX-XXX-XXXX)"
        value={formData.phone}
        onChange={(e) => setFormData({...formData, phone: e.target.value})}
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={formData.password}
        onChange={(e) => setFormData({...formData, password: e.target.value})}
        required
      />
      <input
        type="password"
        placeholder="Confirm Password"
        value={formData.confirmPassword}
        onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
        required
      />
      
      {error && <div className="error">{error}</div>}
      
      <button type="submit" disabled={loading}>
        {loading ? 'Creating Account...' : 'Sign Up'}
      </button>
    </form>
  );
}
```

---

## 🗺️ **3. MAPBOX INTEGRATION**

### **Map Component** (`src/components/Map.jsx`):

```javascript
import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

export default function Map({ 
  center = [121.0244, 14.5547], // [lng, lat] - Manila
  zoom = 12,
  markers = [],
  route = null
}) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Initialize map
  useEffect(() => {
    if (map.current) return; // Already initialized

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: center,
      zoom: zoom
    });

    map.current.on('load', () => {
      setMapLoaded(true);
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Add geolocate control (user's current location)
    map.current.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showUserHeading: true
      }),
      'top-right'
    );

  }, []);

  // Update markers
  useEffect(() => {
    if (!mapLoaded || !markers.length) return;

    // Remove existing markers
    const existingMarkers = document.querySelectorAll('.mapboxgl-marker');
    existingMarkers.forEach(marker => marker.remove());

    // Add new markers
    markers.forEach(({ lat, lng, color, number, popup }) => {
      const el = document.createElement('div');
      el.className = 'marker';
      el.style.backgroundColor = color || '#3887be';
      el.style.width = '30px';
      el.style.height = '30px';
      el.style.borderRadius = '50%';
      el.style.border = '2px solid white';
      
      if (number) {
        el.innerHTML = `<span style="color: white; font-weight: bold;">${number}</span>`;
      }

      const marker = new mapboxgl.Marker(el)
        .setLngLat([lng, lat])
        .addTo(map.current);

      if (popup) {
        marker.setPopup(new mapboxgl.Popup().setHTML(popup));
      }
    });

  }, [markers, mapLoaded]);

  // Draw route
  useEffect(() => {
    if (!mapLoaded || !route) return;

    // Remove existing route
    if (map.current.getLayer('route')) {
      map.current.removeLayer('route');
    }
    if (map.current.getSource('route')) {
      map.current.removeSource('route');
    }

    // Add new route
    map.current.addSource('route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: route.coordinates
        }
      }
    });

    map.current.addLayer({
      id: 'route',
      type: 'line',
      source: 'route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#3887be',
        'line-width': 5,
        'line-opacity': 0.75
      }
    });

    // Fit map to route bounds
    const bounds = new mapboxgl.LngLatBounds();
    route.coordinates.forEach(coord => bounds.extend(coord));
    map.current.fitBounds(bounds, { padding: 50 });

  }, [route, mapLoaded]);

  return (
    <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
  );
}
```

### **Get Directions** (`src/services/mapbox.js`):

```javascript
const MAPBOX_SECRET_TOKEN = 'sk.eyJ1Ijoicm9kbmV5dGV0IiwiYSI6ImNseDZ4OXcwZjFzcGcyanM2c2c0YmNmczYifQ.123abc...';

export const getDirections = async (coordinates) => {
  // coordinates = [[lng1, lat1], [lng2, lat2], ...]
  
  const coordsString = coordinates.map(c => `${c[0]},${c[1]}`).join(';');
  
  const response = await fetch(
    `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coordsString}?` +
    `geometries=geojson&overview=full&steps=true&` +
    `annotations=duration,distance,speed,congestion&` +
    `access_token=${MAPBOX_SECRET_TOKEN}`
  );

  const data = await response.json();
  
  if (!data.routes || data.routes.length === 0) {
    throw new Error('No route found');
  }

  const route = data.routes[0];
  
  return {
    coordinates: route.geometry.coordinates,
    distance: route.distance / 1000, // Convert to km
    duration: route.duration / 60, // Convert to minutes
    congestion: route.legs[0].annotation?.congestion || []
  };
};

// Optimize multi-stop route
export const optimizeRoute = async (coordinates) => {
  const coordsString = coordinates.map(c => `${c[0]},${c[1]}`).join(';');
  
  const response = await fetch(
    `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coordsString}?` +
    `source=first&destination=any&roundtrip=false&` +
    `geometries=geojson&overview=full&` +
    `access_token=${MAPBOX_SECRET_TOKEN}`
  );

  const data = await response.json();
  const trip = data.trips[0];
  
  return {
    coordinates: trip.geometry.coordinates,
    distance: trip.distance / 1000,
    duration: trip.duration / 60,
    optimizedOrder: data.waypoints.map(w => w.waypoint_index)
  };
};
```

---

## 📍 **4. GOOGLE PLACES AUTOCOMPLETE**

### **Address Search Component** (`src/components/AddressSearch.jsx`):

```javascript
import { useEffect, useRef, useState } from 'react';

export default function AddressSearch({ onSelect, placeholder }) {
  const inputRef = useRef(null);
  const [autocomplete, setAutocomplete] = useState(null);

  useEffect(() => {
    // Load Google Maps script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_PLACES_API_KEY}&libraries=places`;
    script.async = true;
    script.onload = initAutocomplete;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const initAutocomplete = () => {
    const autocompleteInstance = new window.google.maps.places.Autocomplete(
      inputRef.current,
      {
        componentRestrictions: { country: 'ph' }, // Philippines only
        fields: ['formatted_address', 'geometry', 'name']
      }
    );

    autocompleteInstance.addListener('place_changed', () => {
      const place = autocompleteInstance.getPlace();
      
      if (!place.geometry) {
        alert('No details available for: ' + place.name);
        return;
      }

      // Extract data
      const result = {
        address: place.formatted_address,
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
        name: place.name
      };

      onSelect(result);
    });

    setAutocomplete(autocompleteInstance);
  };

  return (
    <input
      ref={inputRef}
      type="text"
      placeholder={placeholder || "Search address..."}
      className="address-search-input"
    />
  );
}

// Usage:
// <AddressSearch 
//   onSelect={(location) => setPickupLocation(location)}
//   placeholder="Pickup address"
// />
```

---

## 🚗 **5. LOCATION SELECTION SCREEN**

### **Complete Implementation** (`src/pages/LocationSelection.jsx`):

```javascript
import { useState, useEffect } from 'react';
import Map from '../components/Map';
import AddressSearch from '../components/AddressSearch';
import { getDirections, optimizeRoute } from '../services/mapbox';

export default function LocationSelection() {
  const [pickupLocation, setPickupLocation] = useState(null);
  const [deliveryStops, setDeliveryStops] = useState([]);
  const [isMultiStop, setIsMultiStop] = useState(false);
  const [route, setRoute] = useState(null);
  const [pricing, setPricing] = useState({ distance: 0, duration: 0 });
  const [loading, setLoading] = useState(false);

  // Calculate route when locations change
  useEffect(() => {
    if (!pickupLocation) return;
    
    if (!isMultiStop && deliveryStops.length === 0) return;
    if (isMultiStop && deliveryStops.length < 1) return;

    calculateRoute();
  }, [pickupLocation, deliveryStops, isMultiStop]);

  const calculateRoute = async () => {
    setLoading(true);
    
    try {
      const coordinates = [
        [pickupLocation.lng, pickupLocation.lat],
        ...deliveryStops.map(stop => [stop.lng, stop.lat])
      ];

      let routeData;
      
      if (isMultiStop && deliveryStops.length > 1) {
        // Use optimization API for multiple stops
        routeData = await optimizeRoute(coordinates);
      } else {
        // Use directions API for single stop
        routeData = await getDirections(coordinates);
      }

      setRoute({
        coordinates: routeData.coordinates
      });

      setPricing({
        distance: routeData.distance,
        duration: routeData.duration
      });

    } catch (error) {
      console.error('Route calculation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const addDeliveryStop = (location) => {
    if (isMultiStop) {
      setDeliveryStops([...deliveryStops, location]);
    } else {
      setDeliveryStops([location]);
    }
  };

  const removeDeliveryStop = (index) => {
    setDeliveryStops(deliveryStops.filter((_, i) => i !== index));
  };

  const handleContinue = () => {
    // Save to state and navigate to vehicle selection
    const bookingData = {
      pickupLocation,
      deliveryStops,
      distance: pricing.distance,
      duration: pricing.duration
    };
    
    localStorage.setItem('booking', JSON.stringify(bookingData));
    window.location.href = '/vehicle-selection';
  };

  // Prepare markers for map
  const markers = [
    pickupLocation && {
      lat: pickupLocation.lat,
      lng: pickupLocation.lng,
      color: '#4CAF50',
      popup: `<b>Pickup:</b><br>${pickupLocation.address}`
    },
    ...deliveryStops.map((stop, index) => ({
      lat: stop.lat,
      lng: stop.lng,
      color: '#FF5722',
      number: index + 1,
      popup: `<b>Stop ${index + 1}:</b><br>${stop.address}`
    }))
  ].filter(Boolean);

  return (
    <div className="location-selection">
      {/* Map */}
      <div className="map-container">
        <Map markers={markers} route={route} />
      </div>

      {/* Location Inputs */}
      <div className="location-inputs">
        <div className="input-group">
          <label>📍 Pickup Location</label>
          <AddressSearch
            onSelect={setPickupLocation}
            placeholder="Where to pick up?"
          />
          {pickupLocation && (
            <div className="selected-location">{pickupLocation.address}</div>
          )}
        </div>

        <div className="input-group">
          <label>🏁 Delivery Location{isMultiStop && 's'}</label>
          
          {!isMultiStop ? (
            <>
              <AddressSearch
                onSelect={(loc) => setDeliveryStops([loc])}
                placeholder="Where to deliver?"
              />
              {deliveryStops[0] && (
                <div className="selected-location">{deliveryStops[0].address}</div>
              )}
            </>
          ) : (
            <>
              {deliveryStops.map((stop, index) => (
                <div key={index} className="multi-stop-item">
                  <span className="stop-number">{index + 1}</span>
                  <span className="stop-address">{stop.address}</span>
                  <button onClick={() => removeDeliveryStop(index)}>❌</button>
                </div>
              ))}
              <AddressSearch
                key={deliveryStops.length} // Force re-render
                onSelect={addDeliveryStop}
                placeholder={`Stop ${deliveryStops.length + 1} address`}
              />
            </>
          )}
        </div>

        {/* Multi-Stop Toggle */}
        <div className="toggle-group">
          <label>
            <input
              type="checkbox"
              checked={isMultiStop}
              onChange={(e) => setIsMultiStop(e.target.checked)}
            />
            Multi-Stop Delivery
          </label>
        </div>

        {/* Pricing Summary */}
        {pricing.distance > 0 && (
          <div className="pricing-summary">
            <span>{deliveryStops.length} stop{deliveryStops.length > 1 ? 's' : ''}</span>
            <span>{pricing.distance.toFixed(1)} km</span>
            <span>~{Math.round(pricing.duration)} min</span>
          </div>
        )}

        {/* Continue Button */}
        <button
          onClick={handleContinue}
          disabled={!pickupLocation || deliveryStops.length === 0 || loading}
          className="continue-btn"
        >
          {loading ? 'Calculating...' : 'Continue to Vehicle Selection'}
        </button>
      </div>
    </div>
  );
}
```

---

## 💳 **6. MAYA PAYMENT INTEGRATION**

### **Payment Service** (`src/services/payment.js`):

```javascript
import { supabase } from '../lib/supabase';

export const createCheckout = async (deliveryData) => {
  try {
    // Call Edge Function to create Maya checkout
    const { data, error } = await supabase.functions.invoke('create-maya-checkout', {
      body: {
        amount: deliveryData.totalPrice,
        deliveryId: deliveryData.tempId, // Temporary ID
        customerEmail: deliveryData.customerEmail,
        customerPhone: deliveryData.customerPhone,
        customerName: deliveryData.customerName
      }
    });

    if (error) throw error;

    return {
      checkoutId: data.checkoutId,
      redirectUrl: data.redirectUrl
    };

  } catch (error) {
    console.error('Payment creation failed:', error);
    throw error;
  }
};

export const verifyPayment = async (checkoutId) => {
  // Check payment status from database
  const { data, error } = await supabase
    .from('maya_payments')
    .select('*')
    .eq('checkout_id', checkoutId)
    .single();

  if (error) throw error;

  return {
    status: data.status,
    isPaid: data.status === 'PAYMENT_SUCCESS' || data.status === 'AUTH_SUCCESS'
  };
};
```

### **Payment Flow Component** (`src/pages/OrderSummary.jsx`):

```javascript
import { useState } from 'react';
import { createCheckout } from '../services/payment';
import { supabase } from '../lib/supabase';

export default function OrderSummary() {
  const [booking, setBooking] = useState(
    JSON.parse(localStorage.getItem('booking'))
  );
  const [processing, setProcessing] = useState(false);

  const handlePayment = async () => {
    setProcessing(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get customer profile
      const { data: profile } = await supabase
        .from('customer_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      // Create checkout
      const { checkoutId, redirectUrl } = await createCheckout({
        totalPrice: booking.totalPrice,
        tempId: `TEMP-${Date.now()}`,
        customerEmail: profile.email,
        customerPhone: profile.phone,
        customerName: `${profile.first_name} ${profile.last_name}`
      });

      // Save checkout ID to continue after payment
      localStorage.setItem('pending_checkout_id', checkoutId);
      localStorage.setItem('pending_booking', JSON.stringify(booking));

      // Redirect to Maya payment page
      window.location.href = redirectUrl;

    } catch (error) {
      alert('Payment failed: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="order-summary">
      <h2>Order Summary</h2>
      
      {/* Display booking details */}
      <div className="summary-section">
        <h3>📍 Locations</h3>
        <p>Pickup: {booking.pickupLocation.address}</p>
        {booking.deliveryStops.map((stop, i) => (
          <p key={i}>Stop {i + 1}: {stop.address}</p>
        ))}
      </div>

      <div className="summary-section">
        <h3>💰 Pricing</h3>
        <div className="price-row">
          <span>Base Price</span>
          <span>₱{booking.basePrice.toFixed(2)}</span>
        </div>
        <div className="price-row">
          <span>Distance ({booking.distance.toFixed(1)} km)</span>
          <span>₱{booking.distancePrice.toFixed(2)}</span>
        </div>
        {booking.deliveryStops.length > 1 && (
          <div className="price-row">
            <span>Additional Stops ({booking.deliveryStops.length - 1})</span>
            <span>₱{booking.additionalStopsPrice.toFixed(2)}</span>
          </div>
        )}
        <div className="price-row total">
          <span><b>TOTAL</b></span>
          <span><b>₱{booking.totalPrice.toFixed(2)}</b></span>
        </div>
      </div>

      <button
        onClick={handlePayment}
        disabled={processing}
        className="payment-btn"
      >
        {processing ? 'Processing...' : `Pay ₱${booking.totalPrice.toFixed(2)}`}
      </button>
    </div>
  );
}
```

### **Payment Callback Handler** (`src/pages/PaymentCallback.jsx`):

```javascript
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { verifyPayment } from '../services/payment';
import { supabase } from '../lib/supabase';

export default function PaymentCallback() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('verifying');

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    const checkoutId = localStorage.getItem('pending_checkout_id');
    const booking = JSON.parse(localStorage.getItem('pending_booking'));

    if (!checkoutId) {
      setStatus('error');
      return;
    }

    try {
      // Verify payment status
      const { status: paymentStatus, isPaid } = await verifyPayment(checkoutId);

      if (isPaid) {
        // Payment successful - Create delivery
        await createDelivery(booking, checkoutId);
        setStatus('success');
        
        // Clear localStorage
        localStorage.removeItem('pending_checkout_id');
        localStorage.removeItem('pending_booking');
        
        // Redirect to matching screen
        setTimeout(() => {
          window.location.href = '/matching';
        }, 2000);
        
      } else if (paymentStatus === 'PAYMENT_FAILED') {
        setStatus('failed');
      } else {
        // Still processing
        setStatus('processing');
        
        // Poll every 2 seconds
        setTimeout(handleCallback, 2000);
      }

    } catch (error) {
      console.error('Payment verification failed:', error);
      setStatus('error');
    }
  };

  const createDelivery = async (booking, checkoutId) => {
    // Call Edge Function to create delivery
    const { data, error } = await supabase.functions.invoke(
      'book_multi_stop_delivery',
      {
        body: {
          pickup_address: booking.pickupLocation.address,
          pickup_latitude: booking.pickupLocation.lat,
          pickup_longitude: booking.pickupLocation.lng,
          delivery_stops: booking.deliveryStops.map((stop, index) => ({
            stop_number: index + 1,
            address: stop.address,
            latitude: stop.lat,
            longitude: stop.lng,
            recipient_name: stop.recipientName,
            recipient_phone: stop.recipientPhone,
            instructions: stop.instructions
          })),
          vehicle_type_id: booking.vehicleType.id,
          sender_name: booking.senderName,
          sender_phone: booking.senderPhone,
          package_description: booking.packageDescription,
          distance_km: booking.distance,
          price: booking.totalPrice,
          maya_checkout_id: checkoutId
        }
      }
    );

    if (error) throw error;
    
    // Save delivery ID for tracking
    localStorage.setItem('active_delivery_id', data.deliveryId);
  };

  return (
    <div className="payment-callback">
      {status === 'verifying' && <p>⏳ Verifying payment...</p>}
      {status === 'processing' && <p>⏳ Processing payment...</p>}
      {status === 'success' && <p>✅ Payment successful! Finding driver...</p>}
      {status === 'failed' && (
        <>
          <p>❌ Payment failed</p>
          <button onClick={() => window.location.href = '/order-summary'}>
            Try Again
          </button>
        </>
      )}
      {status === 'error' && <p>❌ An error occurred</p>}
    </div>
  );
}
```

---

## 📡 **7. REAL-TIME TRACKING WITH ABLY**

### **Ably Setup** (`src/services/ably.js`):

```javascript
import Ably from 'ably';

const ABLY_CLIENT_KEY = import.meta.env.VITE_ABLY_CLIENT_KEY;

export const ablyClient = new Ably.Realtime(ABLY_CLIENT_KEY);

export const subscribeToDriverLocation = (driverId, callback) => {
  const channel = ablyClient.channels.get(`driver-location:${driverId}`);
  
  channel.subscribe('location-update', (message) => {
    const { latitude, longitude, heading, speed } = message.data;
    callback({ latitude, longitude, heading, speed });
  });

  return () => {
    channel.unsubscribe();
  };
};

export const subscribeToDeliveryStatus = (deliveryId, callback) => {
  // This uses Supabase Realtime, not Ably
  const { supabase } = require('../lib/supabase');
  
  const subscription = supabase
    .channel(`delivery:${deliveryId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'deliveries',
      filter: `id=eq.${deliveryId}`
    }, (payload) => {
      callback(payload.new);
    })
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
};
```

### **Tracking Screen** (`src/pages/Tracking.jsx`):

```javascript
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { subscribeToDriverLocation, subscribeToDeliveryStatus } from '../services/ably';
import Map from '../components/Map';
import { getDirections } from '../services/mapbox';

export default function Tracking() {
  const [delivery, setDelivery] = useState(null);
  const [driver, setDriver] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [route, setRoute] = useState(null);
  const [currentStop, setCurrentStop] = useState(0);

  const deliveryId = localStorage.getItem('active_delivery_id');

  useEffect(() => {
    loadDeliveryData();
  }, []);

  useEffect(() => {
    if (!driver) return;

    // Subscribe to driver GPS updates
    const unsubscribeLocation = subscribeToDriverLocation(
      driver.id,
      (location) => {
        setDriverLocation(location);
        updateRoute(location);
      }
    );

    // Subscribe to delivery status changes
    const unsubscribeStatus = subscribeToDeliveryStatus(
      deliveryId,
      (updatedDelivery) => {
        setDelivery(updatedDelivery);
        checkStopProgress(updatedDelivery);
      }
    );

    return () => {
      unsubscribeLocation();
      unsubscribeStatus();
    };
  }, [driver]);

  const loadDeliveryData = async () => {
    // Fetch delivery with stops and driver
    const { data, error } = await supabase
      .from('deliveries')
      .select(`
        *,
        delivery_stops(*),
        driver_profiles(*)
      `)
      .eq('id', deliveryId)
      .single();

    if (error) {
      console.error('Failed to load delivery:', error);
      return;
    }

    setDelivery(data);
    setDriver(data.driver_profiles);
  };

  const updateRoute = async (driverLoc) => {
    if (!delivery || !driverLoc) return;

    let destination;
    
    if (delivery.status === 'heading_to_pickup') {
      destination = {
        lat: delivery.pickup_latitude,
        lng: delivery.pickup_longitude
      };
    } else {
      // Going to current delivery stop
      const stops = delivery.delivery_stops.sort((a, b) => a.stop_number - b.stop_number);
      const nextStop = stops.find(s => s.status !== 'delivered');
      
      if (nextStop) {
        destination = {
          lat: nextStop.latitude,
          lng: nextStop.longitude
        };
      }
    }

    if (destination) {
      const routeData = await getDirections([
        [driverLoc.longitude, driverLoc.latitude],
        [destination.lng, destination.lat]
      ]);

      setRoute({ coordinates: routeData.coordinates });
    }
  };

  const checkStopProgress = (updatedDelivery) => {
    const stops = updatedDelivery.delivery_stops;
    const completedCount = stops.filter(s => s.status === 'delivered').length;
    setCurrentStop(completedCount);
  };

  if (!delivery) return <div>Loading...</div>;

  const markers = [
    // Pickup marker
    {
      lat: delivery.pickup_latitude,
      lng: delivery.pickup_longitude,
      color: '#4CAF50',
      popup: 'Pickup Location'
    },
    // Driver marker (animated)
    driverLocation && {
      lat: driverLocation.latitude,
      lng: driverLocation.longitude,
      color: '#2196F3',
      popup: `Driver - ${driver?.first_name}`,
      icon: '🚗' // You can use custom icon
    },
    // Stop markers
    ...delivery.delivery_stops.map((stop, index) => ({
      lat: stop.latitude,
      lng: stop.longitude,
      color: stop.status === 'delivered' ? '#8BC34A' : '#FF5722',
      number: index + 1,
      popup: `Stop ${index + 1}: ${stop.address}<br>Status: ${stop.status}`
    }))
  ].filter(Boolean);

  return (
    <div className="tracking-screen">
      {/* Map */}
      <div className="map-container">
        <Map markers={markers} route={route} />
      </div>

      {/* Driver Info */}
      <div className="driver-info">
        <div className="driver-header">
          <img src={driver?.profile_photo_url || '/default-avatar.png'} alt="Driver" />
          <div>
            <h3>{driver?.first_name} {driver?.last_name}</h3>
            <p>⭐ {driver?.rating?.toFixed(1)} ({driver?.total_trips} trips)</p>
            <p>🚗 {driver?.vehicle_model} • {driver?.vehicle_plate}</p>
          </div>
          <div className="driver-actions">
            <button onClick={() => window.location.href = `tel:${driver?.phone}`}>
              📞 Call
            </button>
          </div>
        </div>

        {/* Status */}
        <div className="status-section">
          <h4>📍 Status: {getStatusText(delivery.status)}</h4>
          
          {/* Progress Bar */}
          <div className="progress-bar">
            <div className="progress-step completed">✓ Accepted</div>
            <div className={`progress-step ${delivery.status !== 'pending' ? 'completed' : ''}`}>
              {delivery.status === 'heading_to_pickup' ? '→' : '✓'} Pickup
            </div>
            {delivery.delivery_stops.map((stop, index) => (
              <div
                key={stop.id}
                className={`progress-step ${stop.status === 'delivered' ? 'completed' : ''}`}
              >
                {stop.status === 'delivered' ? '✓' : index + 1} Stop {index + 1}
              </div>
            ))}
          </div>

          {/* Stop Details */}
          <div className="stops-list">
            {delivery.delivery_stops.map((stop, index) => (
              <div key={stop.id} className={`stop-item ${stop.status}`}>
                <span className="stop-number">{index + 1}</span>
                <div className="stop-details">
                  <p className="stop-address">{stop.address}</p>
                  <p className="stop-recipient">{stop.recipient_name}</p>
                  {stop.status === 'delivered' && (
                    <p className="stop-status">✅ Delivered at {new Date(stop.completed_at).toLocaleTimeString()}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function getStatusText(status) {
  const statusMap = {
    'pending': 'Finding Driver',
    'driver_assigned': 'Driver Accepted',
    'heading_to_pickup': 'On the way to pickup',
    'arrived_at_pickup': 'Driver has arrived',
    'picked_up': 'Package picked up',
    'heading_to_dropoff': 'On the way to stop',
    'arrived_at_dropoff': 'Driver at stop',
    'delivered': 'All deliveries complete!'
  };
  return statusMap[status] || status;
}
```

---

## 🎯 **8. STATE MANAGEMENT (Zustand)**

### **Store Setup** (`src/store/useStore.js`):

```javascript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useStore = create(
  persist(
    (set, get) => ({
      // User
      user: null,
      setUser: (user) => set({ user }),
      clearUser: () => set({ user: null }),

      // Booking
      booking: {
        pickupLocation: null,
        deliveryStops: [],
        vehicleType: null,
        senderInfo: {},
        recipients: [],
        packageDetails: {},
        pricing: {
          basePrice: 0,
          distancePrice: 0,
          additionalStopsPrice: 0,
          total: 0
        }
      },
      updateBooking: (updates) => set({
        booking: { ...get().booking, ...updates }
      }),
      clearBooking: () => set({
        booking: {
          pickupLocation: null,
          deliveryStops: [],
          vehicleType: null,
          senderInfo: {},
          recipients: [],
          packageDetails: {},
          pricing: { basePrice: 0, distancePrice: 0, additionalStopsPrice: 0, total: 0 }
        }
      }),

      // Active Delivery
      activeDelivery: null,
      setActiveDelivery: (delivery) => set({ activeDelivery: delivery }),
      clearActiveDelivery: () => set({ activeDelivery: null })
    }),
    {
      name: 'swiftdash-storage', // LocalStorage key
      partialize: (state) => ({
        // Only persist user and active delivery
        user: state.user,
        activeDelivery: state.activeDelivery
      })
    }
  )
);
```

**Usage in components**:

```javascript
import { useStore } from '../store/useStore';

function LocationSelection() {
  const { booking, updateBooking } = useStore();

  const handleLocationSelect = (location) => {
    updateBooking({ pickupLocation: location });
  };

  return (
    <div>
      {booking.pickupLocation?.address}
    </div>
  );
}
```

---

## 🚀 **9. DEPLOYMENT**

### **Build for Production**:

```bash
# React/Vite
npm run build

# Output: dist/ folder

# Test production build locally
npm run preview
```

### **Deploy to Vercel** (Recommended):

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Project name: swiftdash-web
# - Root directory: ./
# - Build command: npm run build
# - Output directory: dist

# Add environment variables in Vercel dashboard:
# https://vercel.com/your-project/settings/environment-variables
```

### **CORS Configuration** (Supabase):

1. Go to Supabase Dashboard
2. Settings → API
3. Add your domain to **Allowed Origins**:
   - `https://your-domain.com`
   - `http://localhost:5173` (for development)

---

## ✅ **COMPLETE IMPLEMENTATION CHECKLIST**

- [ ] Project setup (React/Vue/Next.js)
- [ ] Environment variables configured
- [ ] Supabase client initialized
- [ ] Authentication (login, signup, logout)
- [ ] Map integration (Mapbox GL JS)
- [ ] Address search (Google Places)
- [ ] Location selection (pickup + multi-stop)
- [ ] Route calculation (Mapbox Directions/Optimization)
- [ ] Vehicle selection
- [ ] Contact information forms
- [ ] Order summary
- [ ] Payment integration (Maya)
- [ ] Payment callback handler
- [ ] Driver matching screen
- [ ] Real-time tracking (Ably + Supabase Realtime)
- [ ] Delivery completion
- [ ] Receipt and rating
- [ ] Order history
- [ ] Saved addresses
- [ ] Profile management
- [ ] State management (Zustand/Redux)
- [ ] Error handling
- [ ] Loading states
- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Push notifications (optional)
- [ ] Testing (unit, integration)
- [ ] Production build
- [ ] Deployment (Vercel/Netlify)
- [ ] CORS configuration

---

## 📚 **ADDITIONAL RESOURCES**

### **Official Documentation**:
- Supabase: https://supabase.com/docs
- Mapbox GL JS: https://docs.mapbox.com/mapbox-gl-js/
- Google Places: https://developers.google.com/maps/documentation/places
- Maya API: https://developers.maya.ph/
- Ably: https://ably.com/docs

### **Sample Code Repositories**:
- Supabase Auth Examples: https://github.com/supabase/supabase/tree/master/examples
- Mapbox GL JS Examples: https://docs.mapbox.com/mapbox-gl-js/examples/

---

## 🎓 **LEARNING PATH FOR WEB TEAM**

### **Week 1: Foundation**
- Set up development environment
- Implement authentication
- Basic map display
- Address search

### **Week 2: Core Features**
- Location selection (single-stop)
- Vehicle selection
- Price calculation
- Order summary

### **Week 3: Payment & Tracking**
- Maya payment integration
- Payment callback handling
- Real-time tracking setup
- Driver location updates

### **Week 4: Multi-Stop & Polish**
- Multi-stop functionality
- Route optimization
- UI/UX improvements
- Error handling
- Testing

### **Week 5: Deployment**
- Production build
- Environment configuration
- Deployment to Vercel
- CORS setup
- Final testing

---

## 🔥 **QUICK START COMMAND**

```bash
# Clone starter template (if you create one)
git clone https://github.com/yourcompany/swiftdash-web-starter.git
cd swiftdash-web-starter

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Add your API keys to .env

# Start development server
npm run dev

# Open http://localhost:5173
```

---

## 💡 **PRO TIPS**

1. **Start Simple**: Build single-stop first, then add multi-stop
2. **Test Locally**: Use Maya sandbox mode for testing
3. **Cache Data**: Save booking data to localStorage between screens
4. **Handle Errors**: Always show user-friendly error messages
5. **Optimize Maps**: Only load map when needed (lazy load)
6. **Mobile First**: Design for mobile, enhance for desktop
7. **Real-time Updates**: Use Supabase Realtime for delivery status, Ably for driver GPS
8. **Security**: Never expose secret keys in frontend
9. **Performance**: Use code splitting, lazy loading
10. **Analytics**: Add tracking (Google Analytics, Mixpanel)

---

📄 **Document**: WEB_GUIDE_3_IMPLEMENTATION.md  
🗓️ **Version**: 1.0  
👤 **Author**: SwiftDash Development Team  
✅ **Status**: Complete

---

🎉 **YOU NOW HAVE EVERYTHING YOU NEED TO BUILD THE WEB VERSION!**

All 3 guides combined provide:
- ✅ All backend services and API keys (Part 1)
- ✅ Complete customer flow and screens (Part 2)
- ✅ Full implementation with code examples (Part 3)

Good luck! 🚀
