// Dynamic OG image for the tracking page
// Generates a branded preview card when shared on WhatsApp / iMessage / Twitter
import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';
export const contentType = 'image/png';
export const size = { width: 1200, height: 630 };

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending pickup',
  driver_assigned: 'Driver assigned',
  pickup_arrived: 'Driver at pickup',
  package_collected: 'Package collected',
  in_transit: '🚚 On the way',
  delivered: '✅ Delivered',
  cancelled: 'Cancelled',
};

const STATUS_BG: Record<string, string> = {
  pending: '#fef9c3',
  driver_assigned: '#dbeafe',
  pickup_arrived: '#f3e8ff',
  package_collected: '#e0e7ff',
  in_transit: '#cffafe',
  delivered: '#dcfce7',
  cancelled: '#fee2e2',
};

const STATUS_TEXT: Record<string, string> = {
  pending: '#854d0e',
  driver_assigned: '#1e40af',
  pickup_arrived: '#6b21a8',
  package_collected: '#3730a3',
  in_transit: '#0e7490',
  delivered: '#15803d',
  cancelled: '#b91c1c',
};

export default async function OGImage({
  params,
}: {
  params: { trackingNumber: string };
}) {
  const { trackingNumber } = params;

  let businessName = 'SwiftDash';
  let status = 'in_transit';
  let deliveryAddress = '';
  let logoUrl: string | null = null;
  let primaryColor = '#3b82f6';

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Resolve tracking number to delivery
    const { data: delivery } = await supabase
      .from('deliveries')
      .select(`
        status,
        delivery_address,
        business_id
      `)
      .or(`tracking_number.eq.${trackingNumber},id.eq.${trackingNumber}`)
      .single();

    if (delivery) {
      status = delivery.status ?? 'in_transit';
      deliveryAddress = delivery.delivery_address ?? '';

      if (delivery.business_id) {
        const { data: biz } = await supabase
          .from('business_accounts')
          .select('business_name, settings')
          .eq('id', delivery.business_id)
          .single();

        if (biz) {
          businessName = biz.business_name ?? 'SwiftDash';
          logoUrl = biz.settings?.logo_url ?? null;
          primaryColor = biz.settings?.primary_color ?? '#3b82f6';
        }
      }
    }
  } catch {
    // fallback values used
  }

  const statusLabel = STATUS_LABEL[status] ?? status;
  const statusBg = STATUS_BG[status] ?? '#f3f4f6';
  const statusFg = STATUS_TEXT[status] ?? '#374151';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#f9fafb',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Header bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            padding: '40px 60px',
            backgroundColor: primaryColor,
          }}
        >
          {logoUrl && (
            <img
              src={logoUrl}
              style={{ height: 72, width: 'auto', borderRadius: 12, background: 'white', padding: 8 }}
            />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 36, fontWeight: 700, color: 'white' }}>{businessName}</span>
            <span style={{ fontSize: 22, color: 'rgba(255,255,255,0.8)' }}>Delivery Tracking</span>
          </div>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '40px 60px',
            gap: 28,
          }}
        >
          {/* Tracking number */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 20, color: '#6b7280' }}>Tracking Number</span>
            <span
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: '#111827',
                background: '#f3f4f6',
                padding: '6px 16px',
                borderRadius: 8,
                fontFamily: 'monospace',
              }}
            >
              {trackingNumber}
            </span>
          </div>

          {/* Status pill */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '12px 28px',
              borderRadius: 999,
              backgroundColor: statusBg,
              color: statusFg,
              fontSize: 28,
              fontWeight: 700,
              width: 'fit-content',
            }}
          >
            {statusLabel}
          </div>

          {/* Delivery address */}
          {deliveryAddress && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <span style={{ fontSize: 24, color: '#ef4444', marginTop: 2 }}>📍</span>
              <span style={{ fontSize: 24, color: '#374151', maxWidth: 900 }}>{deliveryAddress}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '20px 60px',
            backgroundColor: '#f3f4f6',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 18, color: '#9ca3af' }}>Tap to track your delivery live</span>
          <span style={{ fontSize: 18, color: primaryColor, fontWeight: 600 }}>swiftdash.app</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
