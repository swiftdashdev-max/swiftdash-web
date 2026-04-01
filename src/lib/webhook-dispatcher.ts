/**
 * Webhook Dispatcher
 * Sends signed webhook payloads to all active registered endpoints
 * for a given business whenever a delivery status changes.
 *
 * Signature: HMAC-SHA256 of the raw JSON body, sent as `x-swiftdash-signature`
 * Consumers can verify: HMAC-SHA256(secret, body) === signature
 */

import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';

export type WebhookEvent =
  | 'delivery.created'
  | 'delivery.driver_assigned'
  | 'delivery.pickup_arrived'
  | 'delivery.package_collected'
  | 'delivery.in_transit'
  | 'delivery.delivered'
  | 'delivery.cancelled'
  | 'delivery.failed';

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  delivery_id: string;
  data: Record<string, unknown>;
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * Dispatches a webhook event to all active endpoints for the given business.
 * Logs each attempt in `webhook_delivery_logs`.
 * Non-blocking — call without await from route handlers.
 */
export async function dispatchWebhook(
  businessId: string,
  event: WebhookEvent,
  deliveryId: string,
  data: Record<string, unknown>
): Promise<void> {
  const supabase = getServiceClient();

  // Fetch all active webhooks subscribed to this event
  const { data: webhooks, error } = await supabase
    .from('business_webhooks')
    .select('id, url, secret, events')
    .eq('business_id', businessId)
    .eq('is_active', true);

  if (error || !webhooks?.length) return;

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    delivery_id: deliveryId,
    data,
  };

  const body = JSON.stringify(payload);

  await Promise.allSettled(
    webhooks
      .filter((wh) => (wh.events as string[]).includes(event))
      .map((wh) => sendToEndpoint(supabase, wh, event, deliveryId, body, payload))
  );
}

async function sendToEndpoint(
  supabase: ReturnType<typeof getServiceClient>,
  wh: { id: string; url: string; secret: string },
  event: WebhookEvent,
  deliveryId: string,
  body: string,
  payload: WebhookPayload
) {
  const signature = createHmac('sha256', wh.secret).update(body).digest('hex');

  let responseStatus: number | null = null;
  let responseBody: string | null = null;
  let success = false;

  try {
    const res = await fetch(wh.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-swiftdash-signature': `sha256=${signature}`,
        'x-swiftdash-event': event,
        'user-agent': 'SwiftDash-Webhooks/1.0',
      },
      body,
      signal: AbortSignal.timeout(10_000), // 10s timeout
    });

    responseStatus = res.status;
    responseBody = await res.text().catch(() => null);
    success = res.ok;
  } catch (err) {
    responseBody = err instanceof Error ? err.message : 'Unknown error';
  }

  // Log the attempt
  await supabase.from('webhook_delivery_logs').insert({
    webhook_id: wh.id,
    event,
    delivery_id: deliveryId,
    payload,
    response_status: responseStatus,
    response_body: responseBody,
    success,
  });
}

/**
 * Maps a Supabase delivery status string to the corresponding WebhookEvent.
 */
export function statusToWebhookEvent(status: string): WebhookEvent | null {
  const map: Record<string, WebhookEvent> = {
    pending:           'delivery.created',
    driver_assigned:   'delivery.driver_assigned',
    pickup_arrived:    'delivery.pickup_arrived',
    package_collected: 'delivery.package_collected',
    in_transit:        'delivery.in_transit',
    delivered:         'delivery.delivered',
    cancelled:         'delivery.cancelled',
    failed:            'delivery.failed',
  };
  return map[status] ?? null;
}
