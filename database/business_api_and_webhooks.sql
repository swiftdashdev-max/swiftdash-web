-- =====================================================
-- Business API Keys & Webhooks
-- Run this in your Supabase SQL Editor
-- =====================================================

-- ── 1. Business API Keys ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.business_api_keys (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  business_id  uuid        NOT NULL,          -- references auth.users(id)
  name         text        NOT NULL,          -- human label, e.g. "Production Key"
  key_hash     text        NOT NULL UNIQUE,   -- sha-256 hash of the raw key
  key_prefix   text        NOT NULL,          -- first 8 chars shown in UI (e.g. "sd_live_")
  is_active    boolean     NOT NULL DEFAULT true,
  last_used_at timestamptz NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  revoked_at   timestamptz NULL,
  CONSTRAINT business_api_keys_pkey         PRIMARY KEY (id),
  CONSTRAINT business_api_keys_business_fk  FOREIGN KEY (business_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bak_business_id ON public.business_api_keys (business_id);
CREATE INDEX IF NOT EXISTS idx_bak_key_hash    ON public.business_api_keys (key_hash);

-- RLS: only the owning business can read/manage their keys via the dashboard
ALTER TABLE public.business_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business_api_keys_select_own"
  ON public.business_api_keys FOR SELECT
  USING (auth.uid() = business_id);

CREATE POLICY "business_api_keys_insert_own"
  ON public.business_api_keys FOR INSERT
  WITH CHECK (auth.uid() = business_id);

CREATE POLICY "business_api_keys_update_own"
  ON public.business_api_keys FOR UPDATE
  USING (auth.uid() = business_id);

-- ── 2. Business Webhooks ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.business_webhooks (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  business_id  uuid        NOT NULL,
  url          text        NOT NULL,          -- HTTPS endpoint
  secret       text        NOT NULL,          -- used to sign payloads (HMAC-SHA256)
  events       text[]      NOT NULL DEFAULT ARRAY[
    'delivery.created',
    'delivery.driver_assigned',
    'delivery.pickup_arrived',
    'delivery.package_collected',
    'delivery.in_transit',
    'delivery.delivered',
    'delivery.cancelled',
    'delivery.failed'
  ],
  is_active    boolean     NOT NULL DEFAULT true,
  description  text        NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_webhooks_pkey        PRIMARY KEY (id),
  CONSTRAINT business_webhooks_business_fk FOREIGN KEY (business_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bwh_business_id ON public.business_webhooks (business_id);
CREATE INDEX IF NOT EXISTS idx_bwh_is_active   ON public.business_webhooks (is_active);

ALTER TABLE public.business_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business_webhooks_select_own"
  ON public.business_webhooks FOR SELECT
  USING (auth.uid() = business_id);

CREATE POLICY "business_webhooks_insert_own"
  ON public.business_webhooks FOR INSERT
  WITH CHECK (auth.uid() = business_id);

CREATE POLICY "business_webhooks_update_own"
  ON public.business_webhooks FOR UPDATE
  USING (auth.uid() = business_id);

CREATE POLICY "business_webhooks_delete_own"
  ON public.business_webhooks FOR DELETE
  USING (auth.uid() = business_id);

-- ── 3. Webhook Delivery Logs ──────────────────────────
CREATE TABLE IF NOT EXISTS public.webhook_delivery_logs (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  webhook_id      uuid        NOT NULL,
  event           text        NOT NULL,
  delivery_id     uuid        NULL,
  payload         jsonb       NOT NULL,
  response_status integer     NULL,
  response_body   text        NULL,
  attempt         integer     NOT NULL DEFAULT 1,
  success         boolean     NOT NULL DEFAULT false,
  sent_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT webhook_delivery_logs_pkey       PRIMARY KEY (id),
  CONSTRAINT webhook_delivery_logs_webhook_fk FOREIGN KEY (webhook_id) REFERENCES public.business_webhooks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_wdl_webhook_id  ON public.webhook_delivery_logs (webhook_id);
CREATE INDEX IF NOT EXISTS idx_wdl_delivery_id ON public.webhook_delivery_logs (delivery_id);

ALTER TABLE public.webhook_delivery_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_logs_select_own"
  ON public.webhook_delivery_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.business_webhooks bw
      WHERE bw.id = webhook_id AND bw.business_id = auth.uid()
    )
  );
