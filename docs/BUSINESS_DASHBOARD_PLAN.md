# 🏢 SwiftDash Business Dashboard Development Plan

**Project:** SwiftDash Business Account Dashboard  
**Version:** 1.0  
**Last Updated:** October 16, 2025  
**Status:** 🟡 Planning Phase

---

## 📋 Executive Summary

This document outlines the phased development approach for building the SwiftDash Business Dashboard - a comprehensive platform for businesses to manage deliveries, teams, fleet, and finances. The dashboard will follow SwiftDash's established branding (dark blue #2E4A9B, light blue #1DA1F2) and integrate with the existing Supabase backend.

---

## 🎯 Project Goals

1. **Multi-tenant Business Dashboard** - Allow businesses to manage operations independently
2. **Consistent UX** - Match admin dashboard patterns (sidebar + topbar)
3. **API Integration** - Connect to Supabase backend (see API_DOCUMENTATION.md)
4. **Role-based Access** - Owner, Manager, Dispatcher permissions
5. **Real-time Updates** - Live delivery tracking and status updates
6. **Mobile Responsive** - Desktop-first, mobile-friendly

---

## 🏗️ Architecture Overview

### Current Structure
```
src/app/business/
├── dashboard/          ✅ EXISTS - Basic metrics page
│   └── page.tsx       
├── deliveries/         ⚠️ NEEDS EXPANSION
│   └── new/
│       └── page.tsx
├── fleet/             ❌ TO CREATE
├── team/              ❌ TO CREATE
├── financials/        ❌ TO CREATE
├── reports/           ✅ EXISTS - Placeholder
│   └── page.tsx
└── layout.tsx         ⚠️ NEEDS SIDEBAR
```

### Target Structure
```
src/app/business/
├── layout.tsx                    # AppShell with sidebar
├── dashboard/
│   └── page.tsx                  # Overview dashboard
├── deliveries/
│   ├── page.tsx                  # List all deliveries
│   ├── new/
│   │   └── page.tsx             # Create single delivery
│   ├── multi-stop/
│   │   └── page.tsx             # Create multi-stop delivery
│   ├── schedule/
│   │   └── page.tsx             # Schedule deliveries
│   ├── [id]/
│   │   └── page.tsx             # Delivery details
│   └── map/
│       └── page.tsx             # Live tracking map
├── fleet/
│   ├── page.tsx                  # Fleet overview
│   ├── drivers/
│   │   ├── page.tsx             # Driver list
│   │   └── [id]/
│   │       └── page.tsx         # Driver profile
│   └── vehicles/
│       ├── page.tsx             # Vehicle list
│       └── [id]/
│           └── page.tsx         # Vehicle details
├── team/
│   ├── page.tsx                  # Team members list
│   ├── roles/
│   │   └── page.tsx             # Role management
│   └── invite/
│       └── page.tsx             # Invite members
├── financials/
│   ├── page.tsx                  # Financial overview
│   ├── invoices/
│   │   ├── page.tsx             # Invoice list
│   │   └── [id]/
│   │       └── page.tsx         # Invoice details
│   └── statements/
│       └── page.tsx             # Monthly statements
└── reports/
    ├── page.tsx                  # Reports hub
    ├── delivery-volume/
    │   └── page.tsx             # Volume analytics
    └── cost-analysis/
        └── page.tsx             # Cost breakdown
```

---

## 📊 Database Schema Requirements

### Tables Needed (Check Supabase)
```sql
-- Business Accounts
business_accounts (
  id UUID PRIMARY KEY,
  owner_id UUID REFERENCES auth.users,
  business_name TEXT NOT NULL,
  business_type TEXT,
  registration_number TEXT,
  tax_id TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  created_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true
)

-- Team Members
business_team_members (
  id UUID PRIMARY KEY,
  business_id UUID REFERENCES business_accounts,
  user_id UUID REFERENCES auth.users,
  role TEXT, -- 'owner', 'manager', 'dispatcher'
  invited_by UUID REFERENCES auth.users,
  joined_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true
)

-- Business Deliveries (extends deliveries table)
-- Add business_id column to existing deliveries table

-- Business Fleet (if they own drivers)
business_fleet (
  id UUID PRIMARY KEY,
  business_id UUID REFERENCES business_accounts,
  driver_id UUID REFERENCES drivers,
  vehicle_id UUID,
  hired_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true
)

-- Invoices
business_invoices (
  id UUID PRIMARY KEY,
  business_id UUID REFERENCES business_accounts,
  invoice_number TEXT UNIQUE,
  period_start DATE,
  period_end DATE,
  total_amount DECIMAL,
  deliveries_count INTEGER,
  status TEXT, -- 'pending', 'paid', 'overdue'
  due_date DATE,
  paid_at TIMESTAMP,
  created_at TIMESTAMP
)
```

---

## 🎨 Design System

### Colors (from blueprint.md)
- **Primary:** `#2E4A9B` (Dark Blue) - Sidebar, headers
- **Accent:** `#1DA1F2` (Light Blue) - Buttons, highlights
- **Background:** `#FFFFFF` (White) - Content areas
- **Success:** `#10B981` (Green) - Delivered status
- **Warning:** `#F59E0B` (Orange) - Pending status
- **Error:** `#EF4444` (Red) - Cancelled status

### Typography
- **Font:** Inter (sans-serif)
- **Headers:** Bold (600-700)
- **Body:** Regular (400)
- **Small:** 12px, Medium: 14px, Large: 16px

### Components
- **Cards:** `rounded-2xl` with soft shadows
- **Buttons:** Light Blue CTAs with hover animations
- **Icons:** Lucide icons (consistent with admin)
- **Sidebar:** Dark Blue with light icons
- **Charts:** Recharts library for data visualization

---

## 📅 Phase Breakdown

---

## ⚙️ PHASE 1: UI & Layout Foundation
**Status:** 🟡 In Progress  
**Timeline:** 2-3 days  
**Priority:** 🔴 Critical

### Goals
- ✅ Build Business Dashboard shell with AppShell
- ✅ Implement sidebar navigation
- ✅ Setup routing structure
- ✅ Create placeholder pages
- ✅ Apply Swiftdash branding

### Tasks

#### 1.1 Layout & Navigation (Day 1)
- [ ] **Create business layout with AppShell**
  - File: `src/app/business/layout.tsx`
  - Use existing `AppShell` component from `@/components/app-shell.tsx`
  - Define business sidebar navigation items:
    ```typescript
    const businessNavItems: NavItem[] = [
      { label: 'Dashboard', href: '/business/dashboard', icon: 'LayoutDashboard' },
      { label: 'Deliveries', href: '/business/deliveries', icon: 'Package' },
      { label: 'Fleet', href: '/business/fleet', icon: 'Truck' },
      { label: 'Team', href: '/business/team', icon: 'Users' },
      { label: 'Financials', href: '/business/financials', icon: 'DollarSign' },
      { label: 'Reports', href: '/business/reports', icon: 'BarChart3' },
      { label: 'Support', href: '/business/support', icon: 'HelpCircle' },
    ];
    ```
  - Apply dark blue (#2E4A9B) to sidebar
  - Add user dropdown (Owner, Manager, Dispatcher role display)

#### 1.2 Dashboard Page Enhancement (Day 1-2)
- [x] **Enhance existing dashboard page** (ALREADY COMPLETED!)
  - File: `src/app/business/dashboard/page.tsx`
  - ✅ Metrics cards: Deliveries Today, Scheduled, Monthly Spend, Active Drivers
  - ✅ Quick actions: Create Delivery, Schedule, Live Map, Invoices
  - ✅ Active/Recent deliveries tabs
  - Status: **WORKING - NO ERRORS**

#### 1.3 Placeholder Pages (Day 2)
- [ ] **Create empty page structures**
  - `src/app/business/deliveries/page.tsx` - List view placeholder
  - `src/app/business/fleet/page.tsx` - Fleet overview placeholder
  - `src/app/business/team/page.tsx` - Team list placeholder
  - `src/app/business/financials/page.tsx` - Financial overview placeholder
  - Each page should have:
    - Page header with title and breadcrumb
    - Empty state component with icon and call-to-action
    - Loading skeleton states

#### 1.4 Branding & Theme (Day 2-3)
- [ ] **Apply Swiftdash brand colors**
  - Update `tailwind.config.ts` with business theme colors:
    ```typescript
    colors: {
      business: {
        primary: '#2E4A9B',
        accent: '#1DA1F2',
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
      }
    }
    ```
  - Create business-specific color utility classes
  - Test color contrast for accessibility (WCAG AA)

- [ ] **Style sidebar with dark blue theme**
  - Background: `#2E4A9B`
  - Active item: Light blue accent `#1DA1F2`
  - Hover states with smooth transitions
  - Icon colors: White with opacity

- [ ] **Create reusable business components**
  - `<BusinessCard>` - Styled card for metrics
  - `<BusinessButton>` - Light blue CTA button
  - `<StatusBadge>` - Color-coded status indicators
  - `<EmptyState>` - Consistent empty state UI

#### 1.5 Responsive Design (Day 3)
- [ ] **Test mobile/tablet layouts**
  - Collapsible sidebar on mobile
  - Stacked metrics cards on small screens
  - Touch-friendly button sizes (min 44x44px)
  - Test on: Desktop (1920x1080), Tablet (768x1024), Mobile (375x667)

### Deliverables
- ✅ Functional sidebar navigation
- ✅ Working dashboard with metrics
- [ ] 6 placeholder pages with routing
- [ ] Branded theme applied consistently
- [ ] Mobile-responsive layout

### Success Criteria
- ✅ User can navigate between all business pages
- ✅ Dashboard shows mock data correctly
- [ ] All pages load without errors
- [ ] UI matches SwiftDash branding guidelines
- [ ] Mobile layout works on 375px width

---

## 🔌 PHASE 2: Dashboard Metrics Integration
**Status:** ⚪ Not Started  
**Timeline:** 3-4 days  
**Priority:** 🔴 Critical

### Goals
- Connect dashboard to Supabase backend
- Display real-time business metrics
- Implement data fetching with React Query
- Add loading and error states

### Tasks

#### 2.1 Supabase Setup (Day 1)
- [ ] **Configure Supabase client for business context**
  - File: `src/lib/supabase/business-client.ts`
  - Setup authenticated client with user session
  - Add business_id to queries from user context
  - Implement Row Level Security (RLS) policies

- [ ] **Create business data hooks**
  - File: `src/hooks/use-business-data.ts`
  - Hook: `useBusinessMetrics()` - Fetch dashboard stats
  - Hook: `useActiveDeliveries()` - Get in-progress deliveries
  - Hook: `useRecentDeliveries()` - Get completed deliveries
  - Use React Query for caching and refetching

#### 2.2 API Integration (Day 1-2)
- [ ] **Fetch deliveries data**
  - Endpoint: `GET /rest/v1/deliveries?business_id=eq.{id}`
  - Filter by business_id from authenticated user
  - Query params: status, date range, limit
  - Response: Array of delivery objects

- [ ] **Calculate dashboard metrics**
  ```typescript
  interface BusinessMetrics {
    deliveriesToday: number;       // COUNT(deliveries WHERE date = today)
    scheduledDeliveries: number;   // COUNT(deliveries WHERE is_scheduled = true)
    monthlySpend: number;          // SUM(total_price WHERE month = current)
    activeDrivers: number;         // COUNT(drivers WHERE status = 'active')
    activeDeliveries: number;      // COUNT(deliveries WHERE status IN ['in_transit', 'picking_up'])
  }
  ```

- [ ] **Implement real-time subscriptions**
  - Subscribe to delivery status changes
  - Update metrics when new delivery is created
  - Show toast notifications for status updates
  - Use Supabase Realtime: `supabase.channel('deliveries').on(...)`

#### 2.3 Dashboard UI Updates (Day 2-3)
- [ ] **Replace mock data with real API calls**
  - Remove `mockStats`, `mockActiveDeliveries`, `mockRecentDeliveries`
  - Add loading skeletons while fetching
  - Add error boundaries for failed requests
  - Implement retry logic with React Query

- [ ] **Add data visualization**
  - Install Recharts: `npm install recharts`
  - Create delivery volume chart (last 7 days)
  - Create cost trend chart (last 30 days)
  - Add tooltips and legends

- [ ] **Implement filters**
  - Date range picker: Today, This Week, This Month, Custom
  - Status filter: All, Active, Completed, Cancelled
  - Sort options: Date, Price, Status
  - Persist filters in URL params

#### 2.4 Performance Optimization (Day 3-4)
- [ ] **Implement caching strategies**
  - React Query cache: 5 minutes for metrics
  - Stale-while-revalidate pattern
  - Prefetch data on page hover
  - Cache delivery list with pagination

- [ ] **Optimize queries**
  - Use select only needed columns
  - Add database indexes on business_id, created_at
  - Paginate delivery lists (limit 20 per page)
  - Use COUNT queries for metrics instead of fetching all

- [ ] **Add loading states**
  - Skeleton loaders for cards
  - Progressive loading for charts
  - Optimistic UI updates for actions
  - Suspense boundaries for async components

#### 2.5 Error Handling (Day 4)
- [ ] **Implement error boundaries**
  - Component: `<BusinessErrorBoundary>`
  - Catch rendering errors and API failures
  - Show user-friendly error messages
  - Log errors to error tracking service

- [ ] **Add retry mechanisms**
  - Retry failed API requests (max 3 attempts)
  - Exponential backoff: 1s, 2s, 4s
  - Show retry button on permanent failures
  - Handle network offline state

### Deliverables
- [ ] Dashboard connected to Supabase
- [ ] Real-time metrics display
- [ ] Data visualization charts
- [ ] Error handling and loading states
- [ ] Optimized data fetching

### Success Criteria
- [ ] Metrics update in real-time
- [ ] Page loads in < 2 seconds
- [ ] Errors are handled gracefully
- [ ] Data is accurate and up-to-date
- [ ] Works with 100+ deliveries without lag

### API Endpoints Used
```typescript
// From API_DOCUMENTATION.md
GET /rest/v1/deliveries?business_id=eq.{id}
GET /rest/v1/deliveries?business_id=eq.{id}&status=eq.in_transit
GET /rest/v1/deliveries?business_id=eq.{id}&created_at=gte.{date}
GET /rest/v1/vehicle_types?select=*
```

---

## 📦 PHASE 3: Delivery Management
**Status:** ⚪ Not Started  
**Timeline:** 5-7 days  
**Priority:** 🟠 High

### Goals
- Build delivery creation forms (single & multi-stop)
- Implement live tracking map
- Add delivery history and filters
- Enable delivery scheduling

### Tasks

#### 3.1 Create Single Delivery (Day 1-2)
- [ ] **Build delivery form**
  - File: `src/app/business/deliveries/new/page.tsx`
  - Form fields (match API_DOCUMENTATION.md):
    ```typescript
    - Vehicle Type (dropdown: Motorcycle, Sedan, SUV, Van, Truck)
    - Pickup Address (autocomplete with Google Places API)
    - Pickup Contact Name
    - Pickup Contact Phone
    - Pickup Instructions (optional)
    - Dropoff Address (autocomplete)
    - Dropoff Contact Name
    - Dropoff Contact Phone
    - Dropoff Instructions (optional)
    - Package Description
    - Package Weight (kg)
    - Package Value (₱)
    - Payment By (sender/recipient)
    - Payment Method (cash/creditCard/debitCard/maya)
    ```
  - Use React Hook Form for validation
  - Add Zod schema for type safety

- [ ] **Integrate address autocomplete**
  - Use Google Places API for Philippine addresses
  - Auto-populate lat/lng from selected address
  - Validate coordinates are within Metro Manila
  - Show map preview of pickup/dropoff locations

- [ ] **Calculate pricing**
  - Fetch vehicle types from API: `GET /rest/v1/vehicle_types`
  - Calculate distance using Google Maps Distance Matrix API
  - Formula: `total = base_price + (distance_km * price_per_km)`
  - Show price breakdown: Base Fee, Distance, Total
  - Add surge pricing for peak hours

- [ ] **Submit delivery**
  - Endpoint: `POST /functions/v1/book-delivery`
  - Show loading spinner during submission
  - On success: Redirect to delivery details page
  - On error: Show validation errors inline
  - Save draft in localStorage before submit

#### 3.2 Create Multi-Stop Delivery (Day 2-3)
- [ ] **Build multi-stop form**
  - File: `src/app/business/deliveries/multi-stop/page.tsx`
  - Single pickup location
  - Dynamic dropoff stops (add/remove)
  - Minimum 1 stop, maximum 10 stops
  - Each stop has: address, contact, instructions
  - Show route on map with numbered markers

- [ ] **Route optimization**
  - Use Google Maps Directions API for optimal route
  - Calculate total distance and time
  - Show estimated arrival time per stop
  - Allow manual reordering of stops (drag & drop)

- [ ] **Multi-stop pricing**
  - Base price + per-stop fee + distance-based pricing
  - Formula: `total = base + (stops * 20) + (distance * price_per_km)`
  - Show itemized breakdown
  - Validate total weight doesn't exceed vehicle capacity

- [ ] **Submit multi-stop delivery**
  - Endpoint: `POST /functions/v1/create-multi-stop-delivery`
  - Request body includes `dropoffStops[]` array
  - Create delivery + all stops in transaction
  - Return delivery ID and stop IDs

#### 3.3 Delivery Tracking Map (Day 3-4)
- [ ] **Setup Mapbox GL JS**
  - Install: `npm install mapbox-gl react-map-gl`
  - Get Mapbox API key from environment variables
  - Create `<MapboxMap>` component
  - Set initial view to Metro Manila bounds

- [ ] **Display active deliveries**
  - Fetch active deliveries: `GET /rest/v1/deliveries?status=in.in_transit,picking_up`
  - Show delivery markers on map (colored by status)
  - Show driver markers with real-time location
  - Add clustering for many deliveries

- [ ] **Real-time driver tracking**
  - Subscribe to driver location updates via Supabase Realtime
  - Update driver marker position smoothly (animate)
  - Show ETA and current status
  - Draw route line from driver to destination

- [ ] **Map interactions**
  - Click marker to show delivery popup:
    - Delivery ID
    - Status badge
    - Pickup/Dropoff addresses
    - Driver name
    - ETA
    - "View Details" button
  - Filter map by status (in_transit, picking_up)
  - Toggle layers: drivers, deliveries, routes

#### 3.4 Delivery History (Day 4-5)
- [ ] **Create deliveries list page**
  - File: `src/app/business/deliveries/page.tsx`
  - Data table with columns:
    - ID (clickable to details)
    - Status (badge with color)
    - Pickup → Dropoff
    - Date/Time
    - Driver
    - Price
    - Actions (View, Cancel, Invoice)
  - Pagination: 20 deliveries per page
  - Sort by: Date, Price, Status

- [ ] **Implement filters**
  - Status: All, Pending, Active, Completed, Cancelled
  - Date range: Today, This Week, This Month, Custom
  - Search: Delivery ID, addresses, driver name
  - Export: CSV, PDF

- [ ] **Delivery details page**
  - File: `src/app/business/deliveries/[id]/page.tsx`
  - Show full delivery information
  - Timeline of status changes
  - Map with pickup/dropoff markers
  - Driver info and contact
  - Package details
  - Payment information
  - Invoice download button

#### 3.5 Schedule Deliveries (Day 5-6)
- [ ] **Add scheduling to forms**
  - Checkbox: "Schedule for later"
  - Date picker: Select future date (max 30 days ahead)
  - Time picker: Select time slot (8 AM - 10 PM)
  - Show scheduling fee if applicable

- [ ] **Create scheduled deliveries page**
  - File: `src/app/business/deliveries/schedule/page.tsx`
  - Calendar view of scheduled deliveries
  - List view with sorting by scheduled time
  - Ability to edit scheduled time
  - Cancel scheduled delivery

- [ ] **Scheduled delivery logic**
  - Store in database with `is_scheduled = true`
  - Add `scheduled_pickup_time` field
  - Don't assign driver until scheduled time
  - Send reminder notification 30 mins before

#### 3.6 Delivery Actions (Day 6-7)
- [ ] **Cancel delivery**
  - Button on delivery details page
  - Modal confirmation: "Are you sure?"
  - Input: Cancellation reason (required)
  - Endpoint: `PATCH /deliveries?id=eq.{id}` with status='cancelled'
  - Refund policy: Full refund if not picked up

- [ ] **Modify delivery**
  - Allow changes before driver picks up
  - Editable fields: instructions, contact phone
  - Cannot edit: addresses, vehicle type, price
  - Show warning if modification affects price

- [ ] **Rate delivery**
  - After delivery completed
  - Star rating (1-5)
  - Optional comment
  - Rate driver separately
  - Store in `delivery_ratings` table

### Deliverables
- [ ] Single delivery creation form
- [ ] Multi-stop delivery form
- [ ] Live tracking map with real-time updates
- [ ] Delivery history with filters
- [ ] Scheduled delivery management
- [ ] Delivery actions (cancel, modify, rate)

### Success Criteria
- [ ] User can create delivery in < 2 minutes
- [ ] Map shows driver location in real-time
- [ ] Pricing is accurate and transparent
- [ ] Delivery history loads < 1 second
- [ ] Forms validate all inputs correctly
- [ ] Works on mobile devices

### API Endpoints Used
```typescript
// From API_DOCUMENTATION.md
POST /functions/v1/book-delivery
POST /functions/v1/create-multi-stop-delivery
GET /rest/v1/vehicle_types
GET /rest/v1/deliveries?business_id=eq.{id}
GET /rest/v1/deliveries?id=eq.{delivery_id}
PATCH /rest/v1/deliveries?id=eq.{id}
```

---

## 🚗 PHASE 4: Fleet & Team Management
**Status:** ⚪ Not Started  
**Timeline:** 4-5 days  
**Priority:** 🟡 Medium

### Goals
- Manage business-owned drivers and vehicles
- Add team members with role-based access
- Driver verification and onboarding
- Team permissions and settings

### Tasks

#### 4.1 Fleet Overview (Day 1)
- [ ] **Create fleet dashboard**
  - File: `src/app/business/fleet/page.tsx`
  - Metrics cards:
    - Total Drivers
    - Active Drivers (online now)
    - Total Vehicles
    - Deliveries Completed Today
  - Quick actions:
    - Add Driver
    - Add Vehicle
    - View Reports

- [ ] **Driver list**
  - File: `src/app/business/fleet/drivers/page.tsx`
  - Data table with columns:
    - Photo
    - Name
    - Status (Online, Offline, Busy)
    - Rating (⭐ 4.8)
    - Deliveries Completed
    - Joined Date
    - Actions (View, Edit, Remove)
  - Filters: Status, Rating, Availability

#### 4.2 Driver Management (Day 1-2)
- [ ] **Driver profile page**
  - File: `src/app/business/fleet/drivers/[id]/page.tsx`
  - Personal info: Name, photo, phone, email
  - Documents: License, vehicle registration, insurance
  - Verification status: Pending, Approved, Rejected
  - Performance metrics:
    - Total deliveries
    - Average rating
    - On-time delivery rate
    - Acceptance rate
  - Delivery history (last 50)

- [ ] **Add driver form**
  - File: `src/app/business/fleet/drivers/new/page.tsx`
  - Fields:
    - Full name
    - Phone number
    - Email address
    - Driver's license number
    - License expiry date
    - Upload license photo (front & back)
    - Vehicle type
    - Plate number
  - Send invitation email
  - Driver must complete onboarding

- [ ] **Driver verification**
  - Admin reviews submitted documents
  - Approve/Reject with reason
  - Update status in `business_fleet` table
  - Send email notification to driver

#### 4.3 Vehicle Management (Day 2-3)
- [ ] **Vehicle list**
  - File: `src/app/business/fleet/vehicles/page.tsx`
  - Data table:
    - Vehicle Type (icon)
    - Plate Number
    - Assigned Driver
    - Status (Active, Maintenance, Inactive)
    - Capacity (kg)
    - Actions

- [ ] **Vehicle details**
  - File: `src/app/business/fleet/vehicles/[id]/page.tsx`
  - Vehicle info: Type, make, model, year, color
  - Registration: Plate number, OR/CR, expiry
  - Maintenance records
  - Delivery history
  - Assigned driver

- [ ] **Add vehicle form**
  - File: `src/app/business/fleet/vehicles/new/page.tsx`
  - Vehicle type (select)
  - Plate number
  - OR/CR number
  - Insurance details
  - Upload documents
  - Assign to driver (optional)

#### 4.4 Team Management (Day 3-4)
- [ ] **Team members list**
  - File: `src/app/business/team/page.tsx`
  - Data table:
    - Photo
    - Name
    - Email
    - Role (Owner, Manager, Dispatcher)
    - Status (Active, Invited, Suspended)
    - Joined Date
    - Actions (Edit, Remove)

- [ ] **Invite team member**
  - File: `src/app/business/team/invite/page.tsx`
  - Fields:
    - Email address
    - Role (select)
    - Custom message
  - Send invitation email
  - Create pending record in `business_team_members`
  - Expire invitation after 7 days

- [ ] **Team member profile**
  - View member details
  - Change role (Owner only)
  - Suspend/Reactivate account
  - View activity log
  - Remove from team (with confirmation)

#### 4.5 Role-Based Access Control (Day 4-5)
- [ ] **Define permission levels**
  ```typescript
  const permissions = {
    owner: ['all'], // Full access
    manager: [
      'view_dashboard',
      'create_delivery',
      'view_deliveries',
      'manage_fleet',
      'view_reports',
      'manage_team',
    ],
    dispatcher: [
      'view_dashboard',
      'create_delivery',
      'view_deliveries',
      'view_fleet',
    ],
  };
  ```

- [ ] **Implement permission checks**
  - Create `<ProtectedRoute>` component
  - Check user role from `business_team_members` table
  - Hide UI elements based on permissions
  - Block API requests for unauthorized actions
  - Show "Access Denied" page if needed

- [ ] **Role management page**
  - File: `src/app/business/team/roles/page.tsx`
  - List roles and their permissions
  - Owner can customize permissions
  - Save custom roles to database

### Deliverables
- [ ] Fleet dashboard with driver/vehicle lists
- [ ] Driver and vehicle management forms
- [ ] Team member invitation system
- [ ] Role-based access control
- [ ] Document verification workflow

### Success Criteria
- [ ] Owner can add/remove team members
- [ ] Drivers can be verified and onboarded
- [ ] Permissions enforced on all pages
- [ ] Vehicle tracking integrated with deliveries
- [ ] Team activity is logged and auditable

---

## 💰 PHASE 5: Financials & Reports
**Status:** ⚪ Not Started  
**Timeline:** 4-5 days  
**Priority:** 🟡 Medium

### Goals
- Display financial overview and metrics
- Generate and download invoices
- Show monthly statements with breakdowns
- Provide downloadable reports (PDF/CSV)

### Tasks

#### 5.1 Financial Overview (Day 1)
- [ ] **Create financials dashboard**
  - File: `src/app/business/financials/page.tsx`
  - Metrics cards:
    - Total Spend (this month)
    - Average Delivery Cost
    - Outstanding Balance
    - Last Payment Date
  - Charts:
    - Monthly spend trend (line chart)
    - Spend by vehicle type (pie chart)
    - Cost per delivery (bar chart)

#### 5.2 Invoice System (Day 1-3)
- [ ] **Invoice list page**
  - File: `src/app/business/financials/invoices/page.tsx`
  - Data table:
    - Invoice Number (INV-2025-001)
    - Period (Oct 1 - Oct 31, 2025)
    - Amount
    - Status (Paid, Pending, Overdue)
    - Due Date
    - Actions (View, Download)
  - Filters: Status, Month, Year

- [ ] **Invoice details page**
  - File: `src/app/business/financials/invoices/[id]/page.tsx`
  - Invoice header:
    - Business name and address
    - Invoice number and date
    - Payment terms
  - Line items:
    - Delivery ID
    - Date
    - Route
    - Vehicle Type
    - Amount
  - Totals:
    - Subtotal
    - Discounts (if any)
    - Taxes (VAT 12%)
    - Total Amount
  - Payment info:
    - Payment method
    - Transaction ID
    - Paid date

- [ ] **Generate invoice PDF**
  - Install: `npm install @react-pdf/renderer`
  - Create PDF template matching SwiftDash branding
  - Include:
    - Company logo
    - Invoice details
    - Itemized list of deliveries
    - Payment instructions
    - Terms and conditions
  - Download button
  - Email invoice option

#### 5.3 Monthly Statements (Day 3-4)
- [ ] **Statements page**
  - File: `src/app/business/financials/statements/page.tsx`
  - List of monthly statements
  - Select month/year dropdown
  - Show summary:
    - Total deliveries
    - Total cost
    - Average cost per delivery
    - Breakdown by vehicle type
    - Breakdown by payment method

- [ ] **Statement PDF export**
  - Comprehensive monthly report
  - Include charts and graphs
  - Delivery volume trend
  - Cost analysis
  - Top routes
  - Peak hours analysis

#### 5.4 Payment Management (Day 4)
- [ ] **Payment methods page**
  - Add/Remove credit cards
  - Add bank account for direct debit
  - Set default payment method
  - Payment history

- [ ] **Payment reminders**
  - Email notification 3 days before due date
  - SMS reminder on due date
  - Overdue notice after 7 days
  - Suspend account after 30 days overdue

#### 5.5 Reports (Day 4-5)
- [ ] **Reports hub**
  - File: `src/app/business/reports/page.tsx`
  - Available reports:
    - Delivery Volume Report
    - Cost Analysis Report
    - Driver Performance Report
    - Peak Hours Report
    - Route Efficiency Report

- [ ] **Delivery volume report**
  - File: `src/app/business/reports/delivery-volume/page.tsx`
  - Chart: Deliveries per day (last 30 days)
  - Breakdown by status
  - Comparison to previous period
  - Export to CSV

- [ ] **Cost analysis report**
  - File: `src/app/business/reports/cost-analysis/page.tsx`
  - Chart: Cost per delivery over time
  - Breakdown by vehicle type
  - Identify cost-saving opportunities
  - Recommendations

### Deliverables
- [ ] Financial overview dashboard
- [ ] Invoice generation and download
- [ ] Monthly statements with PDF export
- [ ] Payment method management
- [ ] Comprehensive reports with exports

### Success Criteria
- [ ] Invoices are accurate and detailed
- [ ] PDFs match SwiftDash branding
- [ ] Reports provide actionable insights
- [ ] Payment reminders are timely
- [ ] All financial data is auditable

---

## 🎫 PHASE 6: Support & CRM Integration (FUTURE)
**Status:** ⚪ Not Started  
**Timeline:** TBD  
**Priority:** 🔵 Low (Not in current scope)

### Goals
- Enable businesses to submit support tickets
- Track ticket status
- Live chat with support team

### Tasks
- [ ] Support ticket submission form
- [ ] Ticket list and details pages
- [ ] Live chat widget integration
- [ ] FAQ and knowledge base

**Note:** This phase will be addressed in a future iteration.

---

## 📋 Implementation Checklist

### Prerequisites
- [x] API_DOCUMENTATION.md reviewed
- [x] Database schema planned
- [x] Design system defined
- [x] Component library ready (shadcn/ui)
- [ ] Supabase project configured
- [ ] Environment variables set

### Phase 1: UI & Layout ✅ (MOSTLY COMPLETE)
- [x] Business layout with AppShell
- [ ] Sidebar navigation with branding
- [x] Dashboard page with metrics
- [ ] Placeholder pages created
- [ ] Mobile responsive design

### Phase 2: Dashboard Metrics
- [ ] Supabase client configured
- [ ] API hooks created
- [ ] Real-time subscriptions
- [ ] Data visualization charts
- [ ] Error handling

### Phase 3: Delivery Management
- [ ] Single delivery form
- [ ] Multi-stop delivery form
- [ ] Live tracking map
- [ ] Delivery history
- [ ] Schedule deliveries

### Phase 4: Fleet & Team
- [ ] Fleet dashboard
- [ ] Driver management
- [ ] Vehicle management
- [ ] Team member invitations
- [ ] Role-based access control

### Phase 5: Financials & Reports
- [ ] Financial overview
- [ ] Invoice generation
- [ ] Monthly statements
- [ ] Payment management
- [ ] Reports with exports

---

## 🧪 Testing Strategy

### Unit Tests
- [ ] Test API hooks with mock data
- [ ] Test form validation logic
- [ ] Test permission checks
- [ ] Test utility functions

### Integration Tests
- [ ] Test delivery creation flow
- [ ] Test team invitation flow
- [ ] Test invoice generation
- [ ] Test map interactions

### End-to-End Tests
- [ ] Test complete delivery workflow
- [ ] Test multi-stop delivery creation
- [ ] Test team member onboarding
- [ ] Test financial report generation

### Performance Tests
- [ ] Test with 1000+ deliveries
- [ ] Test map with 100+ active drivers
- [ ] Test real-time updates under load
- [ ] Measure page load times

---

## 🚀 Deployment Plan

### Staging Environment
- [ ] Deploy to staging (staging.swiftdash.com/business)
- [ ] Test with sample data
- [ ] QA testing by team
- [ ] User acceptance testing (UAT)

### Production Release
- [ ] Production deployment checklist
- [ ] Database migrations
- [ ] Environment variables configured
- [ ] Monitoring and logging setup
- [ ] Feature flags enabled

### Rollout Strategy
- [ ] Phase 1: Beta testing with 5 businesses
- [ ] Phase 2: Limited release to 20 businesses
- [ ] Phase 3: General availability
- [ ] Monitor metrics and user feedback

---

## 📊 Success Metrics

### User Engagement
- Active business accounts: Target 50 in Month 1
- Daily active users: Target 70% of accounts
- Average session duration: Target 10+ minutes
- Feature adoption: Track usage of each feature

### Business Metrics
- Deliveries created per business: Target 50+/month
- Time to create delivery: Target < 3 minutes
- Invoice download rate: Target 80%
- Support ticket volume: Target < 5% of users

### Technical Metrics
- Page load time: Target < 2 seconds
- API response time: Target < 500ms
- Error rate: Target < 1%
- Uptime: Target 99.9%

---

## 🔒 Security Considerations

### Authentication
- [x] Use Supabase Auth for all requests
- [ ] Implement JWT token validation
- [ ] Add refresh token rotation
- [ ] Enforce MFA for Owner role

### Authorization
- [ ] Row Level Security (RLS) on all tables
- [ ] Check business_id on every query
- [ ] Validate user permissions before actions
- [ ] Audit log for sensitive operations

### Data Protection
- [ ] Encrypt sensitive data at rest
- [ ] Use HTTPS for all requests
- [ ] Sanitize user inputs
- [ ] Prevent SQL injection
- [ ] Implement rate limiting

---

## 📚 Documentation

### Developer Docs
- [x] API_DOCUMENTATION.md (complete)
- [x] BUSINESS_DASHBOARD_PLAN.md (this file)
- [ ] CONTRIBUTING.md
- [ ] TESTING.md

### User Docs
- [ ] Business Dashboard User Guide
- [ ] Delivery Creation Tutorial
- [ ] Fleet Management Guide
- [ ] Financial Reports Guide
- [ ] FAQ

---

## 🐛 Known Issues & Risks

### Technical Risks
- **Real-time updates:** Supabase Realtime may have scaling issues
- **Map performance:** Many markers may slow down map
- **Mobile experience:** Complex forms may be difficult on mobile

### Business Risks
- **Driver availability:** No drivers online = deliveries stuck
- **Payment failures:** Need robust retry logic
- **Data accuracy:** GPS errors may affect routing

### Mitigation Plans
- [ ] Implement fallback for Realtime (polling)
- [ ] Use map clustering for performance
- [ ] Simplify mobile forms
- [ ] Add driver availability alerts
- [ ] Implement payment retry queue
- [ ] Validate GPS coordinates

---

## 🎯 Next Steps

### Immediate (This Week)
1. ✅ Review and approve this plan
2. [ ] Complete Phase 1 tasks (sidebar, placeholders)
3. [ ] Setup Supabase database tables
4. [ ] Configure environment variables

### Short-term (Next 2 Weeks)
1. [ ] Complete Phase 2 (dashboard metrics)
2. [ ] Start Phase 3 (delivery forms)
3. [ ] Test with sample data
4. [ ] Internal demo to team

### Long-term (Next Month)
1. [ ] Complete Phase 3-5
2. [ ] Beta testing with 5 businesses
3. [ ] Iterate based on feedback
4. [ ] Production launch

---

## 📞 Contacts & Resources

### Team
- **Project Manager:** [Name]
- **Tech Lead:** [Name]
- **Frontend Developer:** [Name]
- **Backend Developer:** [Name]
- **QA Engineer:** [Name]

### Resources
- **Figma Designs:** [Link]
- **Supabase Dashboard:** [Link]
- **API Docs:** `/docs/API_DOCUMENTATION.md`
- **Project Board:** [Link]

---

**Last Updated:** October 16, 2025  
**Version:** 1.0  
**Status:** 🟡 In Progress - Phase 1

---

## ✅ Quick Start for Developers

```bash
# 1. Clone repo and install dependencies
git clone <repo-url>
cd swiftdash-admin
npm install

# 2. Setup environment variables
cp .env.example .env.local
# Add your Supabase keys

# 3. Run development server
npm run dev

# 4. Navigate to business dashboard
http://localhost:3000/business/dashboard

# 5. Start with Phase 1 tasks
# See section: PHASE 1: UI & Layout Foundation
```

---

**END OF DOCUMENT**
