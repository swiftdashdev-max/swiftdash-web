-- =====================================================
-- Cargo Manifest Tables
-- Run this in your Supabase SQL Editor
-- =====================================================

-- ── 1. Cargo Manifests (batch header) ─────────────────
-- Groups a batch of cargo items created in one session.
-- Pickup address comes from the business_accounts profile.
CREATE TABLE IF NOT EXISTS public.delivery_manifests (
  id                 uuid        NOT NULL DEFAULT gen_random_uuid(),
  business_id        uuid        NOT NULL,
  name               text        NOT NULL,          -- e.g. "Morning Run - Mar 18"
  total_items        integer     NOT NULL DEFAULT 0,
  booked_count       integer     NOT NULL DEFAULT 0,
  failed_count       integer     NOT NULL DEFAULT 0,
  total_weight_kg    numeric(10,2) NULL,
  total_declared_value numeric(12,2) NULL,
  total_cod          numeric(12,2) NULL,
  status             text        NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'booking', 'completed', 'partial')),
  notes              text        NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT delivery_manifests_pkey        PRIMARY KEY (id),
  CONSTRAINT delivery_manifests_business_fk FOREIGN KEY (business_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dm_business_id ON public.delivery_manifests (business_id);
CREATE INDEX IF NOT EXISTS idx_dm_created_at  ON public.delivery_manifests (created_at DESC);

ALTER TABLE public.delivery_manifests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "delivery_manifests_select_own"
  ON public.delivery_manifests FOR SELECT
  USING (auth.uid() = business_id);

CREATE POLICY "delivery_manifests_insert_own"
  ON public.delivery_manifests FOR INSERT
  WITH CHECK (auth.uid() = business_id);

CREATE POLICY "delivery_manifests_update_own"
  ON public.delivery_manifests FOR UPDATE
  USING (auth.uid() = business_id);

CREATE POLICY "delivery_manifests_delete_own"
  ON public.delivery_manifests FOR DELETE
  USING (auth.uid() = business_id);

-- ── 2. Manifest Items (the actual cargo) ─────────────
-- Each row = one package/parcel in the manifest.
CREATE TABLE IF NOT EXISTS public.manifest_items (
  id                 uuid        NOT NULL DEFAULT gen_random_uuid(),
  manifest_id        uuid        NOT NULL,
  sort_order         integer     NOT NULL DEFAULT 0,

  -- Cargo details
  reference_number   text        NULL,              -- business's own order/ref #
  item_name          text        NOT NULL,          -- what's being shipped
  quantity           integer     NOT NULL DEFAULT 1,
  weight_kg          numeric(8,2) NULL,
  length_cm          numeric(8,2) NULL,
  width_cm           numeric(8,2) NULL,
  height_cm          numeric(8,2) NULL,
  cargo_type         text        NOT NULL DEFAULT 'standard'
                     CHECK (cargo_type IN ('standard', 'fragile', 'perishable', 'hazardous', 'documents')),
  declared_value     numeric(12,2) NULL,
  cod_amount         numeric(12,2) NULL,            -- cash on delivery amount (0 = prepaid)

  -- Recipient
  recipient_name     text        NOT NULL,
  recipient_phone    text        NOT NULL,
  recipient_address  text        NOT NULL,
  recipient_lat      float8      NULL,
  recipient_lng      float8      NULL,
  delivery_notes     text        NULL,

  -- Status tracking
  status             text        NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'booked', 'failed')),
  delivery_id        uuid        NULL,              -- linked after booking

  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT manifest_items_pkey         PRIMARY KEY (id),
  CONSTRAINT manifest_items_manifest_fk  FOREIGN KEY (manifest_id)  REFERENCES public.delivery_manifests(id) ON DELETE CASCADE,
  CONSTRAINT manifest_items_delivery_fk  FOREIGN KEY (delivery_id)  REFERENCES public.deliveries(id)         ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_mi_manifest_id  ON public.manifest_items (manifest_id);
CREATE INDEX IF NOT EXISTS idx_mi_delivery_id  ON public.manifest_items (delivery_id) WHERE delivery_id IS NOT NULL;

ALTER TABLE public.manifest_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manifest_items_select_own"
  ON public.manifest_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.delivery_manifests dm
      WHERE dm.id = manifest_id AND dm.business_id = auth.uid()
    )
  );

CREATE POLICY "manifest_items_insert_own"
  ON public.manifest_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.delivery_manifests dm
      WHERE dm.id = manifest_id AND dm.business_id = auth.uid()
    )
  );

CREATE POLICY "manifest_items_update_own"
  ON public.manifest_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.delivery_manifests dm
      WHERE dm.id = manifest_id AND dm.business_id = auth.uid()
    )
  );

CREATE POLICY "manifest_items_delete_own"
  ON public.manifest_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.delivery_manifests dm
      WHERE dm.id = manifest_id AND dm.business_id = auth.uid()
    )
  );

-- ── 3. Add manifest_id to deliveries ─────────────────
-- Nullable — existing deliveries are unaffected
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS manifest_id uuid NULL
    REFERENCES public.delivery_manifests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_deliveries_manifest_id
  ON public.deliveries (manifest_id)
  WHERE manifest_id IS NOT NULL;
