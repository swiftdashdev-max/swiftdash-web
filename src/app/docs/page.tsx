'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { Menu, X, ExternalLink, ArrowRight, Zap, Shield, Webhook } from 'lucide-react';
import { SidebarNav, type NavSection } from '@/components/docs/SidebarNav';
import { CodeBlock } from '@/components/docs/CodeBlock';
import { ParamTable } from '@/components/docs/ParamTable';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/theme-toggle';

// ── Sidebar nav structure ─────────────────────────────────────────────────────
const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Getting Started',
    items: [
      { id: 'introduction',   label: 'Introduction' },
      { id: 'authentication', label: 'Authentication' },
      { id: 'base-url',       label: 'Base URL' },
      { id: 'errors',         label: 'Errors' },
      { id: 'rate-limits',    label: 'Rate Limits' },
    ],
  },
  {
    label: 'Deliveries',
    items: [
      { id: 'deliveries-list',   label: 'List Deliveries' },
      { id: 'deliveries-create', label: 'Create Delivery' },
      { id: 'deliveries-get',    label: 'Get Delivery' },
      { id: 'deliveries-cancel', label: 'Cancel Delivery' },
    ],
  },
  {
    label: 'Vehicles',
    items: [
      { id: 'vehicles-list', label: 'List Vehicles' },
    ],
  },
  {
    label: 'Webhooks',
    items: [
      { id: 'webhooks-register', label: 'Register Endpoint' },
      { id: 'webhooks-list',     label: 'List Endpoints' },
      { id: 'webhooks-update',   label: 'Update Endpoint' },
      { id: 'webhooks-delete',   label: 'Delete Endpoint' },
      { id: 'webhooks-verify',   label: 'Verify Signature' },
    ],
  },
];

// ── Method badge ──────────────────────────────────────────────────────────────
function MethodBadge({ method }: { method: 'GET' | 'POST' | 'PATCH' | 'DELETE' }) {
  const colors: Record<string, string> = {
    GET:    'border-blue-400/40 bg-blue-500/10 text-blue-400',
    POST:   'border-green-400/40 bg-green-500/10 text-green-400',
    PATCH:  'border-yellow-400/40 bg-yellow-500/10 text-yellow-400',
    DELETE: 'border-red-400/40 bg-red-500/10 text-red-400',
  };
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-bold font-mono ${colors[method]}`}>
      {method}
    </span>
  );
}

// ── Endpoint heading ──────────────────────────────────────────────────────────
function Endpoint({ method, path }: { method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; path: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-muted/60 border border-border px-4 py-3 my-4 font-mono text-sm">
      <MethodBadge method={method} />
      <span className="text-foreground">{path}</span>
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="pt-12 pb-4 scroll-mt-20 border-b border-border last:border-0">
      <h2 className="text-xl font-bold mb-4 text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function SubSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="pt-10 pb-2 scroll-mt-20 border-b border-border/50 last:border-0">
      <h3 className="text-lg font-semibold mb-3 text-foreground">{title}</h3>
      {children}
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground text-sm leading-7 mb-4">{children}</p>;
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-foreground border border-border">
      {children}
    </code>
  );
}

function Note({ children, variant = 'info' }: { children: React.ReactNode; variant?: 'info' | 'warn' | 'danger' }) {
  const styles: Record<string, string> = {
    info:   'bg-blue-500/8 border-blue-500/30 text-blue-700 dark:text-blue-300',
    warn:   'bg-yellow-500/8 border-yellow-500/30 text-yellow-700 dark:text-yellow-300',
    danger: 'bg-red-500/8 border-red-400/30 text-red-700 dark:text-red-300',
  };
  const icons: Record<string, string> = { info: 'ℹ️', warn: '⚠️', danger: '🚨' };
  return (
    <div className={`flex gap-3 rounded-lg border px-4 py-3 text-sm my-4 ${styles[variant]}`}>
      <span>{icons[variant]}</span>
      <span className="leading-relaxed">{children}</span>
    </div>
  );
}

// ── STATUS pill ───────────────────────────────────────────────────────────────
const statusColors: Record<string, string> = {
  pending:           'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  driver_assigned:   'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  pickup_arrived:    'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  package_collected: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  in_transit:        'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  delivered:         'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  cancelled:         'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  failed:            'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
};

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-mono font-medium ${statusColors[status] ?? 'bg-muted text-muted-foreground'}`}>
      {status}
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PAGE
// ══════════════════════════════════════════════════════════════════════════════

export default function DocsPage() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const BASE = '/api/v1';

  return (
    <div className="min-h-screen bg-background text-foreground font-body">

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex h-14 items-center justify-between px-4 max-w-screen-2xl mx-auto">
          <div className="flex items-center gap-3">
            {/* Mobile menu toggle */}
            <button
              className="md:hidden p-1 rounded-md text-muted-foreground hover:text-foreground"
              onClick={() => setMobileNavOpen((v) => !v)}
            >
              {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            <Link href="/" className="flex items-center gap-2">
              <Image src="/assets/images/swiftdash_logo.png" alt="SwiftDash" width={24} height={24} />
              <span className="font-bold text-sm bg-gradient-to-r from-[#1CB8F7] to-[#3B4CCA] bg-clip-text text-transparent">
                SwiftDash
              </span>
            </Link>

            <span className="hidden sm:flex items-center gap-1 text-muted-foreground">
              <span className="text-border text-lg">/</span>
              <span className="text-sm font-medium text-foreground">API Reference</span>
            </span>

            <span className="hidden sm:inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              v1.0
            </span>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/business/settings/api"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Get API Key <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-screen-2xl mx-auto flex">

        {/* ── Mobile sidebar overlay ────────────────────────────────────────── */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div className="absolute inset-0 bg-background/80 backdrop-blur" onClick={() => setMobileNavOpen(false)} />
            <div className="relative w-72 h-full bg-background border-r border-border overflow-y-auto">
              <div className="px-4 pt-4">
                <SidebarNav sections={NAV_SECTIONS} />
              </div>
            </div>
          </div>
        )}

        {/* ── Desktop sidebar ───────────────────────────────────────────────── */}
        <aside className="hidden md:block w-60 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto border-r border-border">
          <SidebarNav sections={NAV_SECTIONS} />
        </aside>

        {/* ── Main content ──────────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0 px-6 md:px-10 lg:px-16 pb-32">

          {/* Hero banner */}
          <div className="pt-10 pb-6 border-b border-border mb-2">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 border border-green-500/30 px-2.5 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                All systems operational
              </span>
            </div>
            <h1 className="text-3xl font-bold mb-2">SwiftDash API Reference</h1>
            <p className="text-muted-foreground max-w-2xl leading-relaxed">
              Integrate SwiftDash delivery management directly into your platform. Book deliveries, track statuses in real-time, and receive webhook events — all via a simple REST API.
            </p>
            <div className="flex flex-wrap gap-3 mt-5">
              {[
                { icon: <Zap className="h-4 w-4" />, label: 'REST API' },
                { icon: <Webhook className="h-4 w-4" />, label: 'Webhooks' },
                { icon: <Shield className="h-4 w-4" />, label: 'HMAC Signatures' },
              ].map(({ icon, label }) => (
                <span key={label} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted border border-border rounded-full px-3 py-1">
                  {icon} {label}
                </span>
              ))}
            </div>
          </div>

          {/* ════════════ GETTING STARTED ════════════ */}

          <Section id="introduction" title="Introduction">
            <P>
              The SwiftDash API lets you programmatically book deliveries, check status, manage webhooks, and pull vehicle pricing — from any language or platform.
            </P>
            <P>
              Every request is scoped to your business account. You authenticate using a static <InlineCode>x-api-key</InlineCode> header. Keys are managed from the <Link href="/business/settings/api" className="text-primary underline underline-offset-4 hover:text-primary/80">API & Webhooks</Link> page in your dashboard.
            </P>
            <div className="grid sm:grid-cols-3 gap-3 mt-2 mb-2">
              {[
                { title: 'Book a Delivery', desc: 'POST to /deliveries with pickup & dropoff details.' },
                { title: 'Get Real-time Status', desc: 'Poll GET /deliveries/:id or subscribe via webhooks.' },
                { title: 'Receive Events', desc: 'Register an HTTPS endpoint and get signed POSTs on status changes.' },
              ].map((c) => (
                <div key={c.title} className="rounded-lg border border-border bg-muted/40 p-4">
                  <p className="font-semibold text-sm mb-1">{c.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{c.desc}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section id="authentication" title="Authentication">
            <P>
              All requests must include your API key in the <InlineCode>x-api-key</InlineCode> header. Keys begin with <InlineCode>sd_live_</InlineCode>.
            </P>
            <CodeBlock
              tabs={[{
                lang: 'cURL',
                code: `curl https://swiftdash.app/api/v1/vehicles \\
  -H 'x-api-key: sd_live_YOUR_KEY_HERE'`,
              }, {
                lang: 'Node.js',
                code: `const res = await fetch('https://swiftdash.app/api/v1/vehicles', {
  headers: {
    'x-api-key': 'sd_live_YOUR_KEY_HERE',
  },
});
const { data } = await res.json();`,
              }, {
                lang: 'Python',
                code: `import requests

res = requests.get(
    'https://swiftdash.app/api/v1/vehicles',
    headers={'x-api-key': 'sd_live_YOUR_KEY_HERE'}
)
print(res.json())`,
              }, {
                lang: 'PHP',
                code: `$ch = curl_init('https://swiftdash.app/api/v1/vehicles');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'x-api-key: sd_live_YOUR_KEY_HERE',
]);
$response = json_decode(curl_exec($ch), true);`,
              }]}
            />
            <Note variant="warn">
              Never expose your API key in client-side code or public repositories. Store it as an environment variable on your server.
            </Note>
            <ParamTable
              title="Request Headers"
              params={[
                { name: 'x-api-key', type: 'string', required: true, description: 'Your SwiftDash API key. Must start with sd_live_.' },
                { name: 'Content-Type', type: 'string', required: false, description: 'Required for POST/PATCH requests. Use application/json.' },
              ]}
            />
          </Section>

          <Section id="base-url" title="Base URL">
            <P>All API endpoints are relative to:</P>
            <div className="flex items-center gap-3 rounded-lg bg-muted/60 border border-border px-4 py-3 font-mono text-sm">
              <span className="text-muted-foreground">Base URL</span>
              <span className="text-foreground">https://swiftdash.app/api/v1</span>
            </div>
            <P>
              Requests over plain HTTP will be rejected. All endpoints require HTTPS.
            </P>
          </Section>

          <Section id="errors" title="Errors">
            <P>
              SwiftDash uses standard HTTP status codes. Error responses always include a JSON body with <InlineCode>error</InlineCode> and <InlineCode>code</InlineCode> fields.
            </P>
            <CodeBlock
              tabs={[{
                lang: 'Node.js',
                code: `// Error response shape
{
  "error": "Missing required fields: pickupAddress, dropoffAddress",
  "code": "MISSING_FIELD"
}`,
              }]}
            />
            <div className="rounded-lg border border-border overflow-hidden mt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground w-16">HTTP</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground w-52">Code</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Meaning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    ['400', 'MISSING_FIELD',            'A required parameter is absent from the request body.'],
                    ['400', 'INVALID_VEHICLE_TYPE',     'The vehicleTypeId does not exist or is inactive.'],
                    ['400', 'INVALID_BODY',             'Request body could not be parsed as JSON.'],
                    ['400', 'INVALID_URL',              'Webhook URL is not a valid HTTPS address.'],
                    ['400', 'INVALID_EVENT',            'An unrecognised webhook event was specified.'],
                    ['401', 'INVALID_API_KEY',          'The x-api-key header is missing, expired, or revoked.'],
                    ['404', 'NOT_FOUND',                'The requested resource does not exist in your account.'],
                    ['409', 'INVALID_STATUS_TRANSITION','Cannot cancel a delivery in its current status.'],
                    ['429', 'RATE_LIMIT_EXCEEDED',      'Too many requests. See Rate Limits section.'],
                    ['500', '—',                        'Internal server error. Contact support if this persists.'],
                  ].map(([code, name, desc]) => (
                    <tr key={name} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{code}</td>
                      <td className="px-4 py-3"><code className="text-xs font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">{name}</code></td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="rate-limits" title="Rate Limits">
            <P>
              Requests are rate-limited per API key. When exceeded, the API returns <InlineCode>429 RATE_LIMIT_EXCEEDED</InlineCode>. Check the response headers to know your current usage.
            </P>
            <div className="rounded-lg border border-border overflow-hidden my-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Plan</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Requests / min</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Requests / hour</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    ['Starter',    '60',        '1,000'],
                    ['Business',   '300',       '10,000'],
                    ['Enterprise', 'Unlimited', 'Unlimited'],
                  ].map(([plan, min, hour]) => (
                    <tr key={plan} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium text-sm">{plan}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground font-mono">{min}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground font-mono">{hour}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ParamTable
              title="Rate Limit Response Headers"
              params={[
                { name: 'X-RateLimit-Limit',     type: 'integer', description: 'Maximum requests allowed in the current window.' },
                { name: 'X-RateLimit-Remaining', type: 'integer', description: 'Requests remaining before you are throttled.' },
                { name: 'X-RateLimit-Reset',     type: 'unix timestamp', description: 'Time when the window resets.' },
              ]}
            />
          </Section>

          {/* ════════════ DELIVERIES ════════════ */}

          <SubSection id="deliveries-list" title="List Deliveries">
            <P>Returns a paginated list of deliveries belonging to your business account.</P>
            <Endpoint method="GET" path="/api/v1/deliveries" />
            <ParamTable
              title="Query Parameters"
              params={[
                { name: 'status',  type: 'string',  description: 'Filter by delivery status (e.g. pending, delivered).' },
                { name: 'from',    type: 'ISO 8601', description: 'Return deliveries created on or after this datetime.' },
                { name: 'to',      type: 'ISO 8601', description: 'Return deliveries created on or before this datetime.' },
                { name: 'limit',   type: 'integer', description: 'Number of results per page. Max 100. Default 20.' },
                { name: 'offset',  type: 'integer', description: 'Number of results to skip for pagination. Default 0.' },
              ]}
            />
            <CodeBlock
              tabs={[{
                lang: 'cURL',
                code: `curl 'https://swiftdash.app/api/v1/deliveries?status=pending&limit=10' \\
  -H 'x-api-key: sd_live_YOUR_KEY_HERE'`,
              }, {
                lang: 'Node.js',
                code: `const res = await fetch(
  'https://swiftdash.app/api/v1/deliveries?status=pending&limit=10',
  { headers: { 'x-api-key': 'sd_live_YOUR_KEY_HERE' } }
);
const { data, count } = await res.json();
console.log(\`\${count} total deliveries\`);`,
              }, {
                lang: 'Python',
                code: `import requests

res = requests.get(
    'https://swiftdash.app/api/v1/deliveries',
    headers={'x-api-key': 'sd_live_YOUR_KEY_HERE'},
    params={'status': 'pending', 'limit': 10}
)
data = res.json()
print(f"{data['count']} total deliveries")`,
              }, {
                lang: 'PHP',
                code: `$ch = curl_init('https://swiftdash.app/api/v1/deliveries?status=pending&limit=10');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['x-api-key: sd_live_YOUR_KEY_HERE']);
$result = json_decode(curl_exec($ch), true);
echo "Total: " . $result['count'];`,
              }]}
            />
            <div className="rounded-lg border border-border bg-muted/30 p-4 mt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Response</p>
              <CodeBlock
                tabs={[{
                  lang: 'Node.js',
                  code: `{
  "data": [
    {
      "id": "del_abc123",
      "status": "in_transit",
      "pickup_address": "123 Rizal Ave, Manila",
      "delivery_address": "456 Ayala Ave, Makati",
      "total_price": 185.50,
      "payment_method": "cash",
      "payment_status": "pending",
      "created_at": "2026-03-18T08:00:00Z",
      "vehicle_types": { "id": "...", "name": "Motorcycle" }
    }
  ],
  "count": 42,
  "limit": 10,
  "offset": 0
}`,
                }]}
              />
            </div>
          </SubSection>

          <SubSection id="deliveries-create" title="Create Delivery">
            <P>Books a new single-stop delivery. Price is automatically calculated using Mapbox routing + 12% VAT.</P>
            <Endpoint method="POST" path="/api/v1/deliveries" />
            <ParamTable
              title="Request Body"
              params={[
                { name: 'vehicleTypeId',       type: 'uuid',    required: true,  description: 'ID of the vehicle type. Get available IDs from GET /vehicles.' },
                { name: 'pickupAddress',        type: 'string',  required: true,  description: 'Full text address of the pickup location.' },
                { name: 'pickupLat',            type: 'number',  required: true,  description: 'Pickup latitude in decimal degrees.' },
                { name: 'pickupLng',            type: 'number',  required: true,  description: 'Pickup longitude in decimal degrees.' },
                { name: 'pickupContactName',    type: 'string',  required: true,  description: 'Name of the person at pickup.' },
                { name: 'pickupContactPhone',   type: 'string',  required: true,  description: 'Phone number in Philippine format (09XXXXXXXXX).' },
                { name: 'dropoffAddress',       type: 'string',  required: true,  description: 'Full text address of the delivery location.' },
                { name: 'dropoffLat',           type: 'number',  required: true,  description: 'Dropoff latitude in decimal degrees.' },
                { name: 'dropoffLng',           type: 'number',  required: true,  description: 'Dropoff longitude in decimal degrees.' },
                { name: 'dropoffContactName',   type: 'string',  required: true,  description: 'Name of the recipient at dropoff.' },
                { name: 'dropoffContactPhone',  type: 'string',  required: true,  description: 'Phone number of the recipient.' },
                { name: 'pickupInstructions',   type: 'string',  description: 'Special instructions for the driver at pickup.' },
                { name: 'dropoffInstructions',  type: 'string',  description: 'Special instructions for the driver at dropoff.' },
                { name: 'packageDescription',   type: 'string',  description: 'What is being delivered.' },
                { name: 'packageWeightKg',      type: 'number',  description: 'Package weight in kilograms.' },
                { name: 'packageValue',         type: 'number',  description: 'Declared value of the package in PHP.' },
                { name: 'distanceKm',           type: 'number',  description: 'Pre-calculated distance. If omitted, Haversine estimation is used.' },
                { name: 'paymentMethod',        type: 'string',  description: 'One of: cash, credit_card, maya_wallet, qr_ph. Defaults to cash.' },
                { name: 'paymentBy',            type: 'string',  description: 'Who pays: sender or recipient. Defaults to sender.' },
                { name: 'paymentStatus',        type: 'string',  description: 'One of: pending, paid. Defaults to pending.' },
              ]}
            />
            <CodeBlock
              tabs={[{
                lang: 'cURL',
                code: `curl -X POST 'https://swiftdash.app/api/v1/deliveries' \\
  -H 'x-api-key: sd_live_YOUR_KEY_HERE' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "vehicleTypeId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "pickupAddress": "123 Rizal Ave, Tondo, Manila",
    "pickupLat": 14.6042,
    "pickupLng": 120.9822,
    "pickupContactName": "Juan Dela Cruz",
    "pickupContactPhone": "09171234567",
    "dropoffAddress": "456 Ayala Ave, Makati City",
    "dropoffLat": 14.5547,
    "dropoffLng": 121.0244,
    "dropoffContactName": "Maria Santos",
    "dropoffContactPhone": "09181234567",
    "packageDescription": "Documents",
    "paymentMethod": "cash",
    "paymentBy": "sender"
  }'`,
              }, {
                lang: 'Node.js',
                code: `const res = await fetch('https://swiftdash.app/api/v1/deliveries', {
  method: 'POST',
  headers: {
    'x-api-key': 'sd_live_YOUR_KEY_HERE',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    vehicleTypeId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    pickupAddress: '123 Rizal Ave, Tondo, Manila',
    pickupLat: 14.6042,
    pickupLng: 120.9822,
    pickupContactName: 'Juan Dela Cruz',
    pickupContactPhone: '09171234567',
    dropoffAddress: '456 Ayala Ave, Makati City',
    dropoffLat: 14.5547,
    dropoffLng: 121.0244,
    dropoffContactName: 'Maria Santos',
    dropoffContactPhone: '09181234567',
    packageDescription: 'Documents',
    paymentMethod: 'cash',
    paymentBy: 'sender',
  }),
});

const { data, pricing } = await res.json();
console.log(\`Delivery \${data.id} created. Total: ₱\${pricing.total}\`);`,
              }, {
                lang: 'Python',
                code: `import requests

payload = {
    "vehicleTypeId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "pickupAddress": "123 Rizal Ave, Tondo, Manila",
    "pickupLat": 14.6042,
    "pickupLng": 120.9822,
    "pickupContactName": "Juan Dela Cruz",
    "pickupContactPhone": "09171234567",
    "dropoffAddress": "456 Ayala Ave, Makati City",
    "dropoffLat": 14.5547,
    "dropoffLng": 121.0244,
    "dropoffContactName": "Maria Santos",
    "dropoffContactPhone": "09181234567",
    "packageDescription": "Documents",
    "paymentMethod": "cash",
    "paymentBy": "sender",
}

res = requests.post(
    "https://swiftdash.app/api/v1/deliveries",
    headers={"x-api-key": "sd_live_YOUR_KEY_HERE"},
    json=payload
)
result = res.json()
print(f"Delivery {result['data']['id']} — Total: ₱{result['pricing']['total']}")`,
              }, {
                lang: 'PHP',
                code: `$data = [
    'vehicleTypeId'       => '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    'pickupAddress'       => '123 Rizal Ave, Tondo, Manila',
    'pickupLat'           => 14.6042,
    'pickupLng'           => 120.9822,
    'pickupContactName'   => 'Juan Dela Cruz',
    'pickupContactPhone'  => '09171234567',
    'dropoffAddress'      => '456 Ayala Ave, Makati City',
    'dropoffLat'          => 14.5547,
    'dropoffLng'          => 121.0244,
    'dropoffContactName'  => 'Maria Santos',
    'dropoffContactPhone' => '09181234567',
    'packageDescription'  => 'Documents',
    'paymentMethod'       => 'cash',
    'paymentBy'           => 'sender',
];

$ch = curl_init('https://swiftdash.app/api/v1/deliveries');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => json_encode($data),
    CURLOPT_HTTPHEADER     => [
        'x-api-key: sd_live_YOUR_KEY_HERE',
        'Content-Type: application/json',
    ],
]);
$result = json_decode(curl_exec($ch), true);
echo "Total: ₱" . $result['pricing']['total'];`,
              }]}
            />
            <div className="rounded-lg border border-border bg-muted/30 p-4 mt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Response — 201 Created</p>
              <CodeBlock
                tabs={[{
                  lang: 'Node.js',
                  code: `{
  "data": {
    "id": "del_abc123",
    "status": "pending",
    "pickup_address": "123 Rizal Ave, Tondo, Manila",
    "delivery_address": "456 Ayala Ave, Makati City",
    "distance_km": 8.2,
    "total_price": 185.50,
    "payment_method": "cash",
    "payment_status": "pending",
    "created_at": "2026-03-18T08:00:00Z"
  },
  "pricing": {
    "base": 49.00,
    "distance": 116.52,
    "subtotal": 115.62,
    "vat": 19.88,
    "total": 185.50
  }
}`,
                }]}
              />
            </div>
            <Note>
              Pricing uses a Haversine straight-line distance estimate by default. Pass <InlineCode>distanceKm</InlineCode> if you have a more accurate road distance from your own routing.
            </Note>

            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Delivery Status Flow</p>
              <div className="flex flex-wrap items-center gap-2">
                {['pending','driver_assigned','pickup_arrived','package_collected','in_transit','delivered'].map((s, i, arr) => (
                  <div key={s} className="flex items-center gap-2">
                    <StatusPill status={s} />
                    {i < arr.length - 1 && <span className="text-muted-foreground text-xs">→</span>}
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <StatusPill status="cancelled" />
                <StatusPill status="failed" />
                <span className="text-xs text-muted-foreground self-center">— terminal states</span>
              </div>
            </div>
          </SubSection>

          <SubSection id="deliveries-get" title="Get Delivery">
            <P>Retrieve full details for a single delivery, including current status and driver assignment.</P>
            <Endpoint method="GET" path="/api/v1/deliveries/:id" />
            <CodeBlock
              tabs={[{
                lang: 'cURL',
                code: `curl 'https://swiftdash.app/api/v1/deliveries/del_abc123' \\
  -H 'x-api-key: sd_live_YOUR_KEY_HERE'`,
              }, {
                lang: 'Node.js',
                code: `const res = await fetch(
  'https://swiftdash.app/api/v1/deliveries/del_abc123',
  { headers: { 'x-api-key': 'sd_live_YOUR_KEY_HERE' } }
);
const { data } = await res.json();
console.log(data.status); // "in_transit"`,
              }, {
                lang: 'Python',
                code: `res = requests.get(
    'https://swiftdash.app/api/v1/deliveries/del_abc123',
    headers={'x-api-key': 'sd_live_YOUR_KEY_HERE'}
)
print(res.json()['data']['status'])`,
              }, {
                lang: 'PHP',
                code: `$ch = curl_init('https://swiftdash.app/api/v1/deliveries/del_abc123');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['x-api-key: sd_live_YOUR_KEY_HERE']);
$result = json_decode(curl_exec($ch), true);
echo $result['data']['status'];`,
              }]}
            />
          </SubSection>

          <SubSection id="deliveries-cancel" title="Cancel Delivery">
            <P>Cancels a delivery. Only deliveries with status <InlineCode>pending</InlineCode> or <InlineCode>driver_assigned</InlineCode> can be cancelled.</P>
            <Endpoint method="DELETE" path="/api/v1/deliveries/:id" />
            <ParamTable
              title="Request Body (optional)"
              params={[
                { name: 'reason', type: 'string', description: 'Human-readable cancellation reason. Defaults to "Cancelled via API".' },
              ]}
            />
            <CodeBlock
              tabs={[{
                lang: 'cURL',
                code: `curl -X DELETE 'https://swiftdash.app/api/v1/deliveries/del_abc123' \\
  -H 'x-api-key: sd_live_YOUR_KEY_HERE' \\
  -H 'Content-Type: application/json' \\
  -d '{ "reason": "Customer changed order" }'`,
              }, {
                lang: 'Node.js',
                code: `const res = await fetch(
  'https://swiftdash.app/api/v1/deliveries/del_abc123',
  {
    method: 'DELETE',
    headers: {
      'x-api-key': 'sd_live_YOUR_KEY_HERE',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason: 'Customer changed order' }),
  }
);
// Returns 200 with updated delivery object`,
              }, {
                lang: 'Python',
                code: `res = requests.delete(
    'https://swiftdash.app/api/v1/deliveries/del_abc123',
    headers={'x-api-key': 'sd_live_YOUR_KEY_HERE'},
    json={'reason': 'Customer changed order'}
)`,
              }, {
                lang: 'PHP',
                code: `$ch = curl_init('https://swiftdash.app/api/v1/deliveries/del_abc123');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CUSTOMREQUEST  => 'DELETE',
    CURLOPT_POSTFIELDS     => json_encode(['reason' => 'Customer changed order']),
    CURLOPT_HTTPHEADER     => [
        'x-api-key: sd_live_YOUR_KEY_HERE',
        'Content-Type: application/json',
    ],
]);
$result = json_decode(curl_exec($ch), true);`,
              }]}
            />
            <Note variant="warn">
              Cancellations for deliveries past the <InlineCode>driver_assigned</InlineCode> stage will return <InlineCode>409 INVALID_STATUS_TRANSITION</InlineCode>. Contact support for overrides.
            </Note>
          </SubSection>

          {/* ════════════ VEHICLES ════════════ */}

          <SubSection id="vehicles-list" title="List Vehicles">
            <P>Returns all active vehicle types with their pricing. Use the returned <InlineCode>id</InlineCode> as <InlineCode>vehicleTypeId</InlineCode> when creating a delivery.</P>
            <Endpoint method="GET" path="/api/v1/vehicles" />
            <CodeBlock
              tabs={[{
                lang: 'cURL',
                code: `curl 'https://swiftdash.app/api/v1/vehicles' \\
  -H 'x-api-key: sd_live_YOUR_KEY_HERE'`,
              }, {
                lang: 'Node.js',
                code: `const res = await fetch('https://swiftdash.app/api/v1/vehicles', {
  headers: { 'x-api-key': 'sd_live_YOUR_KEY_HERE' },
});
const { data } = await res.json();
// data is sorted by base_price ascending`,
              }, {
                lang: 'Python',
                code: `res = requests.get(
    'https://swiftdash.app/api/v1/vehicles',
    headers={'x-api-key': 'sd_live_YOUR_KEY_HERE'}
)
for vehicle in res.json()['data']:
    print(f"{vehicle['name']}: ₱{vehicle['base_price']} base + ₱{vehicle['price_per_km']}/km")`,
              }, {
                lang: 'PHP',
                code: `$ch = curl_init('https://swiftdash.app/api/v1/vehicles');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['x-api-key: sd_live_YOUR_KEY_HERE']);
$result = json_decode(curl_exec($ch), true);
foreach ($result['data'] as $v) {
    echo "{$v['name']}: ₱{$v['base_price']} base\n";
}`,
              }]}
            />
            <div className="rounded-lg border border-border bg-muted/30 p-4 mt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Response</p>
              <CodeBlock
                tabs={[{
                  lang: 'Node.js',
                  code: `{
  "data": [
    {
      "id": "uuid-motorcycle",
      "name": "Motorcycle",
      "description": "Up to 20kg, Size 0.5×0.4×0.5m.",
      "max_weight_kg": 20,
      "base_price": 49.00,
      "price_per_km": 6.00,
      "icon_url": null
    },
    {
      "id": "uuid-sedan",
      "name": "Sedan 200kg",
      "description": "Up to 200kg, Size 1×0.6×0.7m.",
      "max_weight_kg": 200,
      "base_price": 100.00,
      "price_per_km": 18.00,
      "icon_url": null
    }
  ]
}`,
                }]}
              />
            </div>
          </SubSection>

          {/* ════════════ WEBHOOKS ════════════ */}

          <SubSection id="webhooks-register" title="Register Endpoint">
            <P>Register an HTTPS URL to receive real-time delivery events. A signing secret is returned once — store it securely.</P>
            <Endpoint method="POST" path="/api/v1/webhooks" />
            <ParamTable
              title="Request Body"
              params={[
                { name: 'url',         type: 'string',   required: true,  description: 'Your HTTPS endpoint that will receive POST requests.' },
                { name: 'events',      type: 'string[]', description: 'Array of events to subscribe to. Omit to subscribe to all events.' },
                { name: 'description', type: 'string',   description: 'A human-readable label for this endpoint (e.g. "Production").' },
              ]}
            />
            <div className="my-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Available Events</p>
              <div className="flex flex-wrap gap-2">
                {[
                  'delivery.created','delivery.driver_assigned','delivery.pickup_arrived',
                  'delivery.package_collected','delivery.in_transit','delivery.delivered',
                  'delivery.cancelled','delivery.failed',
                ].map((e) => (
                  <code key={e} className="text-xs font-mono bg-muted border border-border px-2 py-1 rounded">{e}</code>
                ))}
              </div>
            </div>
            <CodeBlock
              tabs={[{
                lang: 'cURL',
                code: `curl -X POST 'https://swiftdash.app/api/v1/webhooks' \\
  -H 'x-api-key: sd_live_YOUR_KEY_HERE' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "url": "https://yourapp.com/webhooks/swiftdash",
    "events": ["delivery.created", "delivery.delivered", "delivery.cancelled"],
    "description": "Production"
  }'`,
              }, {
                lang: 'Node.js',
                code: `const res = await fetch('https://swiftdash.app/api/v1/webhooks', {
  method: 'POST',
  headers: {
    'x-api-key': 'sd_live_YOUR_KEY_HERE',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    url: 'https://yourapp.com/webhooks/swiftdash',
    events: ['delivery.created', 'delivery.delivered', 'delivery.cancelled'],
    description: 'Production',
  }),
});

const { data } = await res.json();
// Store data.secret — it is only returned once!
console.log('Webhook secret:', data.secret);`,
              }, {
                lang: 'Python',
                code: `res = requests.post(
    'https://swiftdash.app/api/v1/webhooks',
    headers={'x-api-key': 'sd_live_YOUR_KEY_HERE'},
    json={
        'url': 'https://yourapp.com/webhooks/swiftdash',
        'events': ['delivery.created', 'delivery.delivered'],
        'description': 'Production',
    }
)
data = res.json()['data']
print("Secret (save this!):", data['secret'])`,
              }, {
                lang: 'PHP',
                code: `$ch = curl_init('https://swiftdash.app/api/v1/webhooks');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => json_encode([
        'url'         => 'https://yourapp.com/webhooks/swiftdash',
        'events'      => ['delivery.created', 'delivery.delivered'],
        'description' => 'Production',
    ]),
    CURLOPT_HTTPHEADER => [
        'x-api-key: sd_live_YOUR_KEY_HERE',
        'Content-Type: application/json',
    ],
]);
$result = json_decode(curl_exec($ch), true);
// Save $result['data']['secret'] securely`,
              }]}
            />
          </SubSection>

          <SubSection id="webhooks-list" title="List Endpoints">
            <P>Returns all registered webhook endpoints for your account.</P>
            <Endpoint method="GET" path="/api/v1/webhooks" />
            <CodeBlock
              tabs={[{
                lang: 'cURL',
                code: `curl 'https://swiftdash.app/api/v1/webhooks' \\
  -H 'x-api-key: sd_live_YOUR_KEY_HERE'`,
              }, {
                lang: 'Node.js',
                code: `const { data } = await fetch('https://swiftdash.app/api/v1/webhooks', {
  headers: { 'x-api-key': 'sd_live_YOUR_KEY_HERE' },
}).then(r => r.json());`,
              }, {
                lang: 'Python',
                code: `res = requests.get(
    'https://swiftdash.app/api/v1/webhooks',
    headers={'x-api-key': 'sd_live_YOUR_KEY_HERE'}
)`,
              }, {
                lang: 'PHP',
                code: `$ch = curl_init('https://swiftdash.app/api/v1/webhooks');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['x-api-key: sd_live_YOUR_KEY_HERE']);
$result = json_decode(curl_exec($ch), true);`,
              }]}
            />
          </SubSection>

          <SubSection id="webhooks-update" title="Update Endpoint">
            <P>Update the URL, subscribed events, active status, or description of a webhook.</P>
            <Endpoint method="PATCH" path="/api/v1/webhooks/:id" />
            <ParamTable
              title="Request Body (all optional)"
              params={[
                { name: 'url',         type: 'string',   description: 'New destination URL (must be HTTPS).' },
                { name: 'events',      type: 'string[]', description: 'Replace the subscribed events list.' },
                { name: 'is_active',   type: 'boolean',  description: 'Set to false to pause delivery without deleting.' },
                { name: 'description', type: 'string',   description: 'Update the label.' },
              ]}
            />
            <CodeBlock
              tabs={[{
                lang: 'cURL',
                code: `curl -X PATCH 'https://swiftdash.app/api/v1/webhooks/wh_id' \\
  -H 'x-api-key: sd_live_YOUR_KEY_HERE' \\
  -H 'Content-Type: application/json' \\
  -d '{ "is_active": false }'`,
              }, {
                lang: 'Node.js',
                code: `await fetch('https://swiftdash.app/api/v1/webhooks/wh_id', {
  method: 'PATCH',
  headers: {
    'x-api-key': 'sd_live_YOUR_KEY_HERE',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ is_active: false }),
});`,
              }, {
                lang: 'Python',
                code: `requests.patch(
    'https://swiftdash.app/api/v1/webhooks/wh_id',
    headers={'x-api-key': 'sd_live_YOUR_KEY_HERE'},
    json={'is_active': False}
)`,
              }, {
                lang: 'PHP',
                code: `$ch = curl_init('https://swiftdash.app/api/v1/webhooks/wh_id');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CUSTOMREQUEST  => 'PATCH',
    CURLOPT_POSTFIELDS     => json_encode(['is_active' => false]),
    CURLOPT_HTTPHEADER     => [
        'x-api-key: sd_live_YOUR_KEY_HERE',
        'Content-Type: application/json',
    ],
]);
curl_exec($ch);`,
              }]}
            />
          </SubSection>

          <SubSection id="webhooks-delete" title="Delete Endpoint">
            <P>Permanently removes a webhook endpoint. Returns <InlineCode>204 No Content</InlineCode> on success.</P>
            <Endpoint method="DELETE" path="/api/v1/webhooks/:id" />
            <CodeBlock
              tabs={[{
                lang: 'cURL',
                code: `curl -X DELETE 'https://swiftdash.app/api/v1/webhooks/wh_id' \\
  -H 'x-api-key: sd_live_YOUR_KEY_HERE'`,
              }, {
                lang: 'Node.js',
                code: `await fetch('https://swiftdash.app/api/v1/webhooks/wh_id', {
  method: 'DELETE',
  headers: { 'x-api-key': 'sd_live_YOUR_KEY_HERE' },
}); // 204 No Content`,
              }, {
                lang: 'Python',
                code: `requests.delete(
    'https://swiftdash.app/api/v1/webhooks/wh_id',
    headers={'x-api-key': 'sd_live_YOUR_KEY_HERE'}
)`,
              }, {
                lang: 'PHP',
                code: `$ch = curl_init('https://swiftdash.app/api/v1/webhooks/wh_id');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CUSTOMREQUEST  => 'DELETE',
    CURLOPT_HTTPHEADER     => ['x-api-key: sd_live_YOUR_KEY_HERE'],
]);
curl_exec($ch); // HTTP 204`,
              }]}
            />
          </SubSection>

          <SubSection id="webhooks-verify" title="Verify Signature">
            <P>
              SwiftDash signs every webhook POST with an <InlineCode>HMAC-SHA256</InlineCode> signature using the secret returned when you registered the endpoint.
              Always verify this before processing events.
            </P>
            <ParamTable
              title="Webhook Request Headers"
              params={[
                { name: 'x-swiftdash-signature', type: 'string', description: 'HMAC-SHA256 of the raw request body, prefixed with sha256=.' },
                { name: 'x-swiftdash-event',     type: 'string', description: 'The event name, e.g. delivery.delivered.' },
                { name: 'content-type',           type: 'string', description: 'Always application/json.' },
              ]}
            />
            <div className="rounded-lg border border-border bg-muted/30 p-4 my-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Webhook Payload Shape</p>
              <CodeBlock
                tabs={[{
                  lang: 'Node.js',
                  code: `{
  "event": "delivery.delivered",
  "timestamp": "2026-03-18T14:30:00Z",
  "delivery_id": "del_abc123",
  "data": {
    "id": "del_abc123",
    "status": "delivered",
    "completed_at": "2026-03-18T14:30:00Z",
    "driver_id": "drv_xyz789",
    "total_price": 185.50
  }
}`,
                }]}
              />
            </div>
            <CodeBlock
              tabs={[{
                lang: 'Node.js',
                code: `import { createHmac, timingSafeEqual } from 'crypto';

export function verifySwiftDashSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string
): boolean {
  const expected = 'sha256=' + createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  return timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signatureHeader)
  );
}

// Express.js example
app.post('/webhooks/swiftdash', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['x-swiftdash-signature'];
  const valid = verifySwiftDashSignature(req.body.toString(), sig, process.env.WEBHOOK_SECRET);

  if (!valid) return res.status(401).send('Invalid signature');

  const event = JSON.parse(req.body.toString());
  console.log('Event received:', event.event, event.delivery_id);

  // Process event...
  res.status(200).send('OK');
});`,
              }, {
                lang: 'Python',
                code: `import hmac
import hashlib

def verify_signature(raw_body: bytes, signature_header: str, secret: str) -> bool:
    expected = 'sha256=' + hmac.new(
        secret.encode(),
        raw_body,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature_header)

# Flask example
from flask import Flask, request, abort
import json

app = Flask(__name__)

@app.route('/webhooks/swiftdash', methods=['POST'])
def handle_webhook():
    sig = request.headers.get('x-swiftdash-signature', '')
    if not verify_signature(request.data, sig, WEBHOOK_SECRET):
        abort(401)

    event = request.get_json()
    print(f"Event: {event['event']} — Delivery: {event['delivery_id']}")
    return 'OK', 200`,
              }, {
                lang: 'PHP',
                code: `function verifySignature(string $rawBody, string $signatureHeader, string $secret): bool {
    $expected = 'sha256=' . hash_hmac('sha256', $rawBody, $secret);
    return hash_equals($expected, $signatureHeader);
}

// In your webhook handler:
$rawBody = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_SWIFTDASH_SIGNATURE'] ?? '';

if (!verifySignature($rawBody, $signature, getenv('WEBHOOK_SECRET'))) {
    http_response_code(401);
    exit('Invalid signature');
}

$event = json_decode($rawBody, true);
error_log("Event: {$event['event']} — Delivery: {$event['delivery_id']}");
http_response_code(200);
echo 'OK';`,
              }]}
            />
            <Note variant="warn">
              Always use a <strong>constant-time comparison</strong> (<InlineCode>timingSafeEqual</InlineCode> in Node, <InlineCode>hmac.compare_digest</InlineCode> in Python, <InlineCode>hash_equals</InlineCode> in PHP) to prevent timing-based attacks.
            </Note>
          </SubSection>

          {/* Footer */}
          <div className="pt-16 pb-4 text-center text-xs text-muted-foreground border-t border-border mt-10">
            <p>SwiftDash API Reference · v1.0 · Updated March 2026</p>
            <p className="mt-1">
              Questions?{' '}
              <a href="mailto:api-support@swiftdash.app" className="text-primary hover:underline">
                api-support@swiftdash.app
              </a>
            </p>
          </div>

        </main>
      </div>
    </div>
  );
}
