# This is the deliveries table

create table public.deliveries (
  id uuid not null default gen_random_uuid (),
  customer_id uuid not null,
  driver_id uuid null,
  vehicle_type_id uuid not null,
  pickup_address text not null,
  pickup_latitude numeric(10, 8) not null,
  pickup_longitude numeric(11, 8) not null,
  pickup_contact_name text not null,
  pickup_contact_phone text not null,
  pickup_instructions text null,
  delivery_address text not null,
  delivery_latitude numeric(10, 8) not null,
  delivery_longitude numeric(11, 8) not null,
  delivery_contact_name text not null,
  delivery_contact_phone text not null,
  delivery_instructions text null,
  package_description text not null,
  package_weight numeric(8, 2) null,
  package_value numeric(10, 2) null,
  distance_km numeric(8, 2) null,
  estimated_duration integer null,
  total_price numeric(10, 2) not null,
  status text null default 'pending'::text,
  customer_rating integer null,
  driver_rating integer null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  completed_at timestamp with time zone null,
  payment_by text null,
  payment_method text null,
  payment_status text null default 'pending'::text,
  delivery_fee numeric(10, 2) null default 0.00,
  tip_amount numeric(10, 2) null default 0.00,
  total_amount numeric(10, 2) null default 0.00,
  constraint deliveries_pkey primary key (id),
  constraint deliveries_driver_id_fkey foreign KEY (driver_id) references driver_profiles (id),
  constraint deliveries_customer_id_fkey foreign KEY (customer_id) references auth.users (id),
  constraint deliveries_vehicle_type_id_fkey foreign KEY (vehicle_type_id) references vehicle_types (id),
  constraint deliveries_payment_by_check check (
    (
      payment_by = any (array['sender'::text, 'recipient'::text])
    )
  ),
  constraint deliveries_payment_method_check check (
    (
      payment_method = any (
        array[
          'credit_card'::text,
          'maya_wallet'::text,
          'qr_ph'::text,
          'cash'::text
        ]
      )
    )
  ),
  constraint deliveries_payment_status_check check (
    (
      payment_status = any (
        array[
          'pending'::text,
          'paid'::text,
          'failed'::text,
          'cash_pending'::text
        ]
      )
    )
  ),
  constraint deliveries_customer_rating_check check (
    (
      (customer_rating >= 1)
      and (customer_rating <= 5)
    )
  ),
  constraint deliveries_status_check check (
    (
      status = any (
        array[
          'pending'::text,
          'driver_assigned'::text,
          'pickup_arrived'::text,
          'package_collected'::text,
          'in_transit'::text,
          'delivered'::text,
          'cancelled'::text,
          'failed'::text
        ]
      )
    )
  ),
  constraint deliveries_driver_rating_check check (
    (
      (driver_rating >= 1)
      and (driver_rating <= 5)
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_deliveries_pending_unassigned on public.deliveries using btree (created_at desc) TABLESPACE pg_default
where
  (
    (status = 'pending'::text)
    and (driver_id is null)
  );

create index IF not exists idx_deliveries_active_by_driver on public.deliveries using btree (driver_id, status, created_at desc) TABLESPACE pg_default
where
  (
    status = any (
      array[
        'driver_assigned'::text,
        'package_collected'::text,
        'in_transit'::text
      ]
    )
  );

create index IF not exists idx_deliveries_payment_status on public.deliveries using btree (payment_status) TABLESPACE pg_default;

create trigger trigger_update_driver_status
after
update on deliveries for EACH row
execute FUNCTION update_driver_status_on_delivery_change ();



# This is the Delivery Payments table


create table public.delivery_payments (
  id uuid not null default gen_random_uuid (),
  delivery_id uuid not null,
  maya_checkout_id text not null,
  amount numeric(10, 2) not null,
  currency text null default 'PHP'::text,
  status text not null default 'pending'::text,
  payment_method text null default 'maya'::text,
  payment_data jsonb null,
  webhook_data jsonb null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint delivery_payments_pkey primary key (id),
  constraint delivery_payments_maya_checkout_id_key unique (maya_checkout_id),
  constraint delivery_payments_delivery_id_fkey foreign KEY (delivery_id) references deliveries (id)
) TABLESPACE pg_default;

create index IF not exists idx_delivery_payments_delivery_id on public.delivery_payments using btree (delivery_id) TABLESPACE pg_default;

create index IF not exists idx_delivery_payments_status on public.delivery_payments using btree (status) TABLESPACE pg_default;

create index IF not exists idx_delivery_payments_maya_checkout_id on public.delivery_payments using btree (maya_checkout_id) TABLESPACE pg_default;




# This is the driver cash balance table


create table public.driver_cash_balances (
  id uuid not null default gen_random_uuid (),
  driver_id uuid not null,
  total_cash_on_hand numeric(10, 2) null default 0.00,
  pending_remittance numeric(10, 2) null default 0.00,
  overdue_amount numeric(10, 2) null default 0.00,
  next_remittance_due timestamp with time zone null,
  last_remittance_at timestamp with time zone null,
  remittance_status text null default 'current'::text,
  is_suspended boolean null default false,
  suspension_reason text null,
  suspended_at timestamp with time zone null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint driver_cash_balances_pkey primary key (id),
  constraint driver_cash_balances_driver_id_key unique (driver_id),
  constraint driver_cash_balances_driver_id_fkey foreign KEY (driver_id) references driver_profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_driver_cash_balances_driver_id on public.driver_cash_balances using btree (driver_id) TABLESPACE pg_default;

create index IF not exists idx_driver_cash_balances_status on public.driver_cash_balances using btree (remittance_status) TABLESPACE pg_default;

create index IF not exists idx_driver_cash_balances_due_date on public.driver_cash_balances using btree (next_remittance_due) TABLESPACE pg_default;



# This is the Driver Earnings table


create table public.driver_earnings (
  id uuid not null default gen_random_uuid (),
  driver_id uuid null,
  delivery_id uuid null,
  base_earnings numeric(10, 2) null,
  distance_earnings numeric(10, 2) null,
  surge_earnings numeric(10, 2) null,
  tips numeric(10, 2) null default 0,
  total_earnings numeric(10, 2) null,
  earnings_date date null,
  created_at timestamp with time zone null default now(),
  payout_status text null default 'pending'::text,
  payout_date timestamp with time zone null,
  updated_at timestamp with time zone null default now(),
  payment_method text null default 'card'::text,
  platform_commission numeric(10, 2) null default 0.00,
  driver_net_earnings numeric(10, 2) null,
  cash_collected_at timestamp with time zone null,
  remittance_due_at timestamp with time zone null,
  remittance_status text null default 'not_applicable'::text,
  remittance_id uuid null,
  earnings_status text null default 'pending'::text,
  constraint driver_earnings_pkey primary key (id),
  constraint driver_earnings_delivery_id_fkey foreign KEY (delivery_id) references deliveries (id),
  constraint driver_earnings_driver_id_fkey foreign KEY (driver_id) references driver_profiles (id),
  constraint driver_earnings_remittance_id_fkey foreign KEY (remittance_id) references cash_remittances (id)
) TABLESPACE pg_default;

create index IF not exists idx_driver_earnings_driver_id on public.driver_earnings using btree (driver_id) TABLESPACE pg_default;

create index IF not exists idx_driver_earnings_payment_method on public.driver_earnings using btree (payment_method) TABLESPACE pg_default;

create index IF not exists idx_driver_earnings_remittance_status on public.driver_earnings using btree (remittance_status) TABLESPACE pg_default;

create index IF not exists idx_driver_earnings_earnings_status on public.driver_earnings using btree (earnings_status) TABLESPACE pg_default;

create index IF not exists idx_driver_earnings_remittance_due on public.driver_earnings using btree (remittance_due_at) TABLESPACE pg_default;



# this the the Driver payout table


create table public.driver_payouts (
  id uuid not null default gen_random_uuid (),
  driver_id uuid not null,
  delivery_id uuid null,
  amount numeric(10, 2) not null,
  currency text null default 'PHP'::text,
  reason text not null,
  maya_transaction_id text null,
  status text not null default 'pending'::text,
  payout_method text null default 'maya'::text,
  payout_data jsonb null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint driver_payouts_pkey primary key (id),
  constraint driver_payouts_delivery_id_fkey foreign KEY (delivery_id) references deliveries (id),
  constraint driver_payouts_driver_id_fkey foreign KEY (driver_id) references driver_profiles (id)
) TABLESPACE pg_default;

create index IF not exists idx_driver_payouts_driver_id on public.driver_payouts using btree (driver_id) TABLESPACE pg_default;

create index IF not exists idx_driver_payouts_status on public.driver_payouts using btree (status) TABLESPACE pg_default;

create index IF not exists idx_driver_payouts_created_at on public.driver_payouts using btree (created_at) TABLESPACE pg_default;



# This is the Driver profile table

create table public.driver_profiles (
  id uuid not null,
  vehicle_type_id uuid null,
  license_number text null,
  vehicle_model text null,
  is_verified boolean null default false,
  is_online boolean null default false,
  current_latitude numeric(10, 8) null,
  current_longitude numeric(11, 8) null,
  rating numeric(3, 2) null default 0.00,
  total_deliveries integer null default 0,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  is_available boolean null default false,
  location_updated_at timestamp with time zone null default now(),
  profile_picture_url text null,
  vehicle_picture_url text null,
  ltfrb_number text null,
  ltfrb_picture_url text null,
  bank_name text null,
  bank_account_number text null,
  bank_account_name text null,
  payout_preference text null default 'maya'::text,
  constraint driver_profiles_pkey primary key (id),
  constraint driver_profiles_id_fkey foreign KEY (id) references auth.users (id),
  constraint driver_profiles_vehicle_type_id_fkey foreign KEY (vehicle_type_id) references vehicle_types (id)
) TABLESPACE pg_default;



# This is the User profile table


create table public.user_profiles (
  id uuid not null,
  phone_number character varying(20) not null,
  first_name character varying(100) not null,
  last_name character varying(100) not null,
  user_type text not null,
  profile_image_url text null,
  status text null default 'active'::text,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  business_name text null,
  constraint user_profiles_pkey primary key (id),
  constraint user_profiles_phone_number_key unique (phone_number),
  constraint user_profiles_id_fkey foreign KEY (id) references auth.users (id),
  constraint user_profiles_status_check check (
    (
      status = any (
        array[
          'active'::text,
          'inactive'::text,
          'suspended'::text
        ]
      )
    )
  ),
  constraint user_profiles_user_type_check check (
    (
      user_type = any (
        array[
          'customer'::text,
          'driver'::text,
          'admin'::text,
          'business'::text,
          'crm'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;





# This is the vehicle type table

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS vehicle_types CASCADE;

CREATE TABLE vehicle_types (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    max_weight_kg DECIMAL(8, 2) NOT NULL,
    base_price DECIMAL(8, 2) NOT NULL,
    price_per_km DECIMAL(6, 2) NOT NULL,
    icon_url TEXT,
    is_active BOOLEAN DEFAULT TRUE
);

-- Insert Lalamove Vehicle Types & Pricing (simplified to fit schema)
INSERT INTO vehicle_types (name, description, max_weight_kg, base_price, price_per_km, is_active) VALUES
('Motorcycle', 'Up to 20kg, Size 0.5×0.4×0.5m. ₱6/km (first 5km), ₱5/km afterwards. Stop Fee: ₱40', 20, 49.00, 6.00, true),

('Sedan 200kg', 'Up to 200kg, Size 1×0.6×0.7m. ₱18/km (first 5km), ₱15/km afterwards. Stop Fee: ₱45', 200, 100.00, 18.00, true),

('SUV / Crossover 300kg', 'Up to 300kg, Size 1.2×1×0.9m. Flat ₱20/km. Stop Fee: ₱45', 300, 115.00, 20.00, true),

('7-Seater SUV / Small Van 600kg', 'Up to 600kg, Size 2.1×1.2×1.1m. Flat ₱20/km. Stop Fee: ₱50', 600, 200.00, 20.00, true),

('Pickup 800kg', 'Up to 800kg, Size 2.7×1.5×0.5m. Flat ₱20/km. Stop Fee: ₱50', 800, 240.00, 20.00, true),

('Light Truck 1000kg', 'Up to 1000kg, Size 2.1×1.2×1.2m. Flat ₱20/km (≈ ₱19 official). Stop Fee: ₱100', 1000, 280.00, 20.00, true),

('Medium Truck 2000kg FB', 'Up to 2000kg, Size 3×1.7×1.7m. ₱26/km. Stop Fee: ₱255', 2000, 940.00, 26.00, true),

('Medium Truck 2000kg Aluminum', 'Up to 2000kg, Size 3×1.7×1.7m. ₱29/km. Stop Fee: ₱255', 2000, 1040.00, 29.00, true),

('Medium Truck 3000kg Aluminum', 'Up to 3000kg, Size ~4.2×1.8×1.8m. Rate varies. Stop Fee: ₱255', 3000, 2000.00, 25.00, true),

('Large Truck 7000kg Aluminum', 'Up to 7000kg, Size ~6×2.1×2.1m. Rate varies. Stop Fee: ₱255', 7000, 4420.00, 30.00, true),

('Large Truck 12000kg Wing Van', 'Up to 12000kg, Size ~9×2.4×2.4m. Rate varies. Stop Fee: ₱255', 12000, 7200.00, 35.00, true);





# This is the cash remittance table


create table public.cash_remittances (
  id uuid not null default gen_random_uuid (),
  driver_id uuid not null,
  total_remittance_amount numeric(10, 2) not null,
  platform_commission numeric(10, 2) not null,
  driver_payout_amount numeric(10, 2) not null,
  paymaya_reference_number text null,
  paymaya_transaction_id text null,
  proof_of_payment_url text null,
  status text null default 'submitted'::text,
  verification_notes text null,
  delivery_ids uuid[] null,
  submitted_at timestamp with time zone null default now(),
  verified_at timestamp with time zone null,
  disbursed_at timestamp with time zone null,
  created_at timestamp with time zone null default now(),
  constraint cash_remittances_pkey primary key (id),
  constraint cash_remittances_driver_id_fkey foreign KEY (driver_id) references driver_profiles (id)
) TABLESPACE pg_default;

create index IF not exists idx_cash_remittances_driver_id on public.cash_remittances using btree (driver_id) TABLESPACE pg_default;

create index IF not exists idx_cash_remittances_status on public.cash_remittances using btree (status) TABLESPACE pg_default;

create index IF not exists idx_cash_remittances_submitted_at on public.cash_remittances using btree (submitted_at) TABLESPACE pg_default;