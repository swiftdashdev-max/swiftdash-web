'use client';

/**
 * Emergency Response API reference.
 *
 * A separate document from the delivery reference on purpose. The audiences do
 * not overlap — one is a courier integrator, the other is a city building a
 * citizen emergency app — and interleaving them would make both worse. Shared
 * components keep the two looking like one product.
 *
 * Scope is the citizen-app surface only: the three key-authenticated calls and
 * the public tracking link. Dispatcher console actions are session
 * authenticated and internal, and are deliberately not documented here.
 */

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { Menu, X, ArrowLeft, Siren, ShieldAlert, Radio } from 'lucide-react';
import { SidebarNav, type NavSection } from '@/components/docs/SidebarNav';
import { CodeBlock } from '@/components/docs/CodeBlock';
import { ParamTable } from '@/components/docs/ParamTable';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  Endpoint, InlineCode, Note, P, Section, StatusPill, SubSection,
} from '@/components/docs/primitives';

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Getting Started',
    items: [
      { id: 'introduction',   label: 'Introduction' },
      { id: 'authentication', label: 'Authentication' },
      { id: 'base-url',       label: 'Base URL' },
      { id: 'errors',         label: 'Errors' },
    ],
  },
  {
    label: 'Reporting',
    items: [
      { id: 'report-create', label: 'File a Report' },
      { id: 'report-status', label: 'Get Status' },
      { id: 'report-cancel', label: 'Cancel a Report' },
    ],
  },
  {
    label: 'Tracking',
    items: [
      { id: 'tracking-link', label: 'Tracking Link' },
      { id: 'tracking-api',  label: 'Tracking Endpoint' },
    ],
  },
  {
    label: 'Reference',
    items: [
      { id: 'ref-statuses', label: 'Incident Statuses' },
      { id: 'ref-types',    label: 'Types & Agencies' },
      { id: 'ref-flags',    label: 'Review Flags' },
    ],
  },
];

const HOST = 'https://swiftdashdms.com';
const BASE = `${HOST}/api/v1`;

/** A worked example used consistently throughout, so the ids line up. */
const EXAMPLE_TOKEN = '9f3c1ab24e7d40f8b6a15c8e2d094fb7c3e58a1d6b2f47c09e83a15d7b6c024f';

export default function EmergencyDocsPage() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground font-body">

      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex h-14 items-center justify-between px-4 max-w-screen-2xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-1 rounded-md text-muted-foreground hover:text-foreground"
              onClick={() => setMobileNavOpen((v) => !v)}
              aria-label="Toggle navigation"
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
              <span className="text-sm font-medium text-foreground">Emergency Response API</span>
            </span>

            {/* Red, where the delivery reference is blue. Two documents that
                should never be mistaken for one another at a glance. */}
            <span className="hidden sm:inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
              v1.0
            </span>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/docs"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Delivery API
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-screen-2xl mx-auto flex">

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

        <aside className="hidden md:block w-60 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto border-r border-border">
          <SidebarNav sections={NAV_SECTIONS} />
        </aside>

        <main className="flex-1 min-w-0 px-6 md:px-10 lg:px-16 pb-32">

          {/* ── Hero ──────────────────────────────────────────────────────── */}
          <div className="pt-10 pb-6 border-b border-border mb-2">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 border border-red-500/30 px-2.5 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
                <Siren className="h-3 w-3" />
                Emergency Response
              </span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-3">Emergency Response API</h1>
            <p className="text-muted-foreground text-base leading-relaxed max-w-2xl">
              File emergencies from a citizen app into a command center&rsquo;s dispatch console,
              follow the response as it happens, and call it off if help is no longer needed.
            </p>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-2xl mt-3">
              This is a separate API from{' '}
              <Link href="/docs" className="text-primary underline underline-offset-2">
                SwiftDash Deliveries
              </Link>
              . It shares authentication and error conventions with it and nothing else &mdash;
              different endpoints, different objects, different statuses.
            </p>
          </div>

          {/* ── Introduction ──────────────────────────────────────────────── */}
          <Section id="introduction" title="Introduction">
            <P>
              The API is built around one guiding rule: <strong>a real emergency must never be
              rejected by a machine.</strong> A person reporting a fire is frightened, possibly
              typing one-handed, possibly wrong about the details. Refusing them because a field
              looked suspicious would be the worst failure this system could have.
            </P>
            <P>
              So there are exactly two hard rejections: a malformed request, and a location outside
              the area the command center covers. Everything else that looks unusual &mdash; a
              missing GPS fix, a pin far from the reporter, a device that has reported repeatedly
              &mdash; is <strong>flagged for a human dispatcher to judge</strong>, and the report
              still lands on the board. Even the geofence check fails open: if it errors, the report
              is accepted.
            </P>

            <div className="grid sm:grid-cols-3 gap-3 my-6">
              {[
                { icon: Siren, title: '1. File a report', desc: 'POST the emergency type and location. You get a reference number and a tracking token back.' },
                { icon: Radio, title: '2. Follow it', desc: 'Poll the status endpoint while the incident is active, or open the tracking link.' },
                { icon: ShieldAlert, title: '3. Cancel if needed', desc: 'False alarm, or help arrived another way. Only the reporting device may do this.' },
              ].map((s) => (
                <div key={s.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <s.icon className="h-4 w-4 text-red-500 mb-2" />
                  <p className="font-semibold text-sm mb-1">{s.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>

            <Note variant="info">
              Reports arrive on the dispatch console the moment they are written &mdash; the console
              subscribes to the incident table directly, so there is no queue or notification step
              between your request returning <InlineCode>201</InlineCode> and a dispatcher seeing
              the call.
            </Note>
          </Section>

          {/* ── Authentication ────────────────────────────────────────────── */}
          <Section id="authentication" title="Authentication">
            <P>
              Every request carries an API key in the <InlineCode>x-api-key</InlineCode> header.
              Keys begin with <InlineCode>sd_live_</InlineCode> and are issued from the command
              center&rsquo;s dashboard under Settings &rarr; API &amp; Webhooks.
            </P>

            <CodeBlock tabs={[{ lang: 'cURL', code: `curl ${BASE}/emergency/status/TOKEN \\
  -H "x-api-key: sd_live_your_key_here"` }]} />

            <P>
              The key identifies <strong>which command center receives the report</strong>. It does
              not identify the citizen &mdash; there is no user login in this API, by design.
              A key belonging to a delivery business is rejected with{' '}
              <InlineCode>NOT_AUTHORIZED</InlineCode>, so a courier account can never inject
              incidents into a city&rsquo;s dispatch queue.
            </P>

            <Note variant="warn">
              A key compiled into a published mobile app can be extracted from the binary by
              anyone. Because this key can file emergencies into a live dispatch queue, prefer
              routing calls through your own backend, or delivering the key to the app at runtime
              after your own authentication, rather than shipping it inside the APK or IPA.
            </Note>
          </Section>

          {/* ── Base URL ──────────────────────────────────────────────────── */}
          <Section id="base-url" title="Base URL">
            <Endpoint method="POST" path={`${BASE}/emergency/...`} />
            <P>
              All emergency endpoints run in the <InlineCode>sin1</InlineCode> (Singapore) region
              rather than SwiftDash&rsquo;s default US East, because they serve Philippine cities and
              the round trip is the dominant cost. A report typically completes in 0.3&ndash;0.6s
              end to end. Every response carries an <InlineCode>x-response-time</InlineCode> header
              measuring the server&rsquo;s own share of that.
            </P>
            <P>
              Requests and responses are JSON. Status responses are sent{' '}
              <InlineCode>Cache-Control: no-store</InlineCode> &mdash; a cached &ldquo;submitted&rdquo;
              while a responder is already on scene would be worse than an extra round trip.
            </P>
          </Section>

          {/* ── Errors ────────────────────────────────────────────────────── */}
          <Section id="errors" title="Errors">
            <P>
              Errors return a non-2xx status and a JSON body with a human-readable{' '}
              <InlineCode>error</InlineCode> and a stable <InlineCode>code</InlineCode>. Branch on
              the code; the message is written to be shown to a person and may be reworded.
            </P>

            <CodeBlock tabs={[{ lang: 'cURL', code: `{
  "error": "This location is outside the area this command center covers. Please call your local emergency hotline directly.",
  "code": "OUTSIDE_SERVICE_AREA"
}` }]} />

            <ParamTable
              title="Codes used across all emergency endpoints"
              params={[
                { name: 'INVALID_API_KEY',      type: '401', description: 'Missing key, malformed key, or a key that has been revoked.' },
                { name: 'NOT_AUTHORIZED',       type: '403', description: 'The key is valid but its account is not an emergency command center.' },
                { name: 'INVALID_BODY',         type: '400', description: 'The request body was not valid JSON.' },
                { name: 'VALIDATION_ERROR',     type: '400', description: 'A field failed validation. See the details array for which one and why.' },
                { name: 'NOT_FOUND',            type: '404', description: 'No report matches that tracking token for this command center.' },
                { name: 'OUTSIDE_SERVICE_AREA', type: '422', description: 'The incident location falls outside the command center’s coverage area.' },
                { name: 'REPORT_FAILED',        type: '500', description: 'The report could not be written. Tell the user to call their hotline directly.' },
              ]}
            />

            <P>
              Validation failures list every offending field at once rather than the first, so an
              app can correct a form in one pass:
            </P>

            <CodeBlock tabs={[{ lang: 'cURL', code: `{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "field": "incidentType",
      "message": "Must be one of: medical, fire, crime",
      "code": "INVALID_VALUE"
    },
    {
      "field": "incidentLat",
      "message": "Must be a number between -90 and 90",
      "code": "INVALID_RANGE"
    }
  ]
}` }]} />

            <P>
              Each entry carries a <InlineCode>code</InlineCode> from a fixed set &mdash;{' '}
              <InlineCode>REQUIRED</InlineCode>, <InlineCode>INVALID_TYPE</InlineCode>,{' '}
              <InlineCode>INVALID_RANGE</InlineCode>, <InlineCode>INVALID_FORMAT</InlineCode>,{' '}
              <InlineCode>INVALID_VALUE</InlineCode>, <InlineCode>TOO_LONG</InlineCode>,{' '}
              <InlineCode>TOO_SHORT</InlineCode> &mdash; so a form can be mapped to field errors
              without parsing the message text.
            </P>

            <Note variant="danger">
              On a <InlineCode>500</InlineCode>, or on a network failure, do not silently retry
              forever. Show the caller the local emergency hotline. An app that spins while
              someone waits for an ambulance is worse than one that admits it failed.
            </Note>
          </Section>

          {/* ── File a report ─────────────────────────────────────────────── */}
          <Section id="report-create" title="File a Report">
            <Endpoint method="POST" path="/api/v1/emergency/report" />
            <P>
              Files an emergency into the command center&rsquo;s dispatch queue. Returns the
              reference number the caller can quote on the phone, and the tracking token every
              later call is keyed on.
            </P>

            <ParamTable
              title="Body parameters"
              params={[
                { name: 'incidentType',  type: 'string',  required: true,  description: 'One of medical, fire, or crime. Determines which agency the incident is routed to.' },
                { name: 'incidentLat',   type: 'number',  required: true,  description: 'Latitude of the emergency itself — where help should go. Not necessarily where the reporter is.' },
                { name: 'incidentLng',   type: 'number',  required: true,  description: 'Longitude of the emergency.' },
                { name: 'deviceId',      type: 'string',  required: true,  description: 'A stable identifier for the reporting device (1–200 chars). Keep it: cancelling later requires the same value.' },
                { name: 'deviceLat',     type: 'number',  required: false, description: 'The device’s own GPS fix. Supplying it lets a dispatcher see whether the pin matches where the reporter actually is.' },
                { name: 'deviceLng',     type: 'number',  required: false, description: 'Longitude of the device’s GPS fix.' },
                { name: 'description',   type: 'string',  required: false, description: 'What is happening, in the reporter’s words. Up to 2000 characters. Shown to the dispatcher, never on the public tracking page.' },
                { name: 'address',       type: 'string',  required: false, description: 'Street address, if the app resolved one. Up to 500 characters.' },
                { name: 'landmark',      type: 'string',  required: false, description: 'A nearby landmark. Up to 500 characters. Often more useful to a responder than a street address.' },
                { name: 'reporterName',  type: 'string',  required: false, description: 'Name of the person reporting. Up to 200 characters. Discarded if isAnonymous is true.' },
                { name: 'reporterPhone', type: 'string',  required: false, description: 'Callback number, 7–20 characters. The single most useful optional field — it lets a dispatcher ring back for detail.' },
                { name: 'isAnonymous',   type: 'boolean', required: false, description: 'When true, name and phone are never stored — not merely hidden. The report still reaches the console.' },
              ]}
            />

            <CodeBlock
              tabs={[
                {
                  lang: 'cURL',
                  code: `curl -X POST ${BASE}/emergency/report \\
  -H "x-api-key: sd_live_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "incidentType": "medical",
    "incidentLat": 11.5853,
    "incidentLng": 122.7511,
    "deviceLat": 11.5851,
    "deviceLng": 122.7509,
    "deviceId": "a7f3c9e1-device-install-id",
    "description": "Elderly man collapsed near the plaza, breathing but unresponsive",
    "address": "Roxas City Plaza, Capiz",
    "landmark": "In front of the cathedral",
    "reporterName": "Maria Santos",
    "reporterPhone": "+639171234567",
    "isAnonymous": false
  }'`,
                },
                {
                  lang: 'Node.js',
                  code: `const res = await fetch('${BASE}/emergency/report', {
  method: 'POST',
  headers: {
    'x-api-key': process.env.SWIFTDASH_API_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    incidentType: 'medical',
    incidentLat: 11.5853,
    incidentLng: 122.7511,
    deviceLat: position.coords.latitude,
    deviceLng: position.coords.longitude,
    deviceId: await getInstallId(),
    description: 'Elderly man collapsed near the plaza',
    landmark: 'In front of the cathedral',
    reporterPhone: '+639171234567',
  }),
});

if (!res.ok) {
  const { code } = await res.json();
  // Fall back to the local hotline rather than retrying indefinitely.
  return showHotline(code);
}

const report = await res.json();
// Store report.trackingToken — status polling and cancelling both need it.`,
                },
              ]}
            />

            <P><strong>Response</strong> &mdash; <InlineCode>201 Created</InlineCode></P>
            <CodeBlock tabs={[{ lang: 'cURL', code: `{
  "reportId": "3f2a1b8c-9d4e-4a7f-b1c2-8e5d6a9f0b3c",
  "referenceNumber": "MR-A3F91C",
  "status": "submitted",
  "agency": "CDRRMO_AMBULANCE",
  "trackingToken": "${EXAMPLE_TOKEN}",
  "trackingUrl": "${HOST}/track/emergency/${EXAMPLE_TOKEN}"
}` }]} />

            <ParamTable
              title="Response fields"
              params={[
                { name: 'reportId',        type: 'string', description: 'Internal incident id. Useful for your own logs; not needed by any other call here.' },
                { name: 'referenceNumber', type: 'string', description: 'Short human reference, formatted MR- plus six characters. This is what a caller reads down the phone.' },
                { name: 'status',          type: 'string', description: 'Always "submitted" on creation — a dispatcher has not yet acted on it.' },
                { name: 'agency',          type: 'string', description: 'The agency the incident was routed to, derived from incidentType.' },
                { name: 'trackingToken',   type: 'string', description: '64 hex characters. Required by the status and cancel calls. Store it.' },
                { name: 'trackingUrl',     type: 'string', description: 'A public page the reporter can open or forward. No login required.' },
              ]}
            />

            <Note variant="info">
              A flagged report is <em>not</em> a rejected one and the response does not differ. The
              flag and its reason are attached to the incident for the dispatcher, who decides.
              See <Link href="#ref-flags" className="underline underline-offset-2">Review Flags</Link>.
            </Note>

            <Note variant="warn">
              <InlineCode>isAnonymous: true</InlineCode> discards the reporter&rsquo;s name and phone
              at the point of writing &mdash; they are never stored, so they cannot be recovered
              afterwards, and a dispatcher cannot call back. Only send it when the reporter has
              actually chosen anonymity.
            </Note>
          </Section>

          {/* ── Get status ────────────────────────────────────────────────── */}
          <Section id="report-status" title="Get Status">
            <Endpoint method="GET" path="/api/v1/emergency/status/{trackingToken}" />
            <P>
              Returns the current state of one incident. Designed to be polled every 15&ndash;30
              seconds while the incident is active &mdash; polling rather than push, so your app
              needs no backend, no webhook endpoint and no signature verification. A dropped
              response simply retries on the next tick.
            </P>

            <CodeBlock
              tabs={[
                {
                  lang: 'cURL',
                  code: `curl ${BASE}/emergency/status/${EXAMPLE_TOKEN} \\
  -H "x-api-key: sd_live_your_key_here"`,
                },
                {
                  lang: 'Node.js',
                  code: `async function poll(trackingToken) {
  const res = await fetch(
    \`${BASE}/emergency/status/\${trackingToken}\`,
    { headers: { 'x-api-key': process.env.SWIFTDASH_API_KEY } }
  );
  if (!res.ok) return;

  const status = await res.json();
  render(status);

  // Stop when the incident is finished — nothing more will change.
  if (status.isActive) setTimeout(() => poll(trackingToken), 20_000);
}`,
                },
              ]}
            />

            <P><strong>Response</strong> &mdash; <InlineCode>200 OK</InlineCode></P>
            <CodeBlock tabs={[{ lang: 'cURL', code: `{
  "referenceNumber": "MR-A3F91C",
  "status": "en_route",
  "isActive": true,
  "agency": "CDRRMO_AMBULANCE",
  "units": [
    {
      "callsign": "AMB-01",
      "agency": "CDRRMO_AMBULANCE",
      "status": "en_route",
      "etaMinutes": 6
    }
  ],
  "etaMinutes": 6,
  "closureReason": null,
  "timestamps": {
    "dispatched": "2026-08-05T09:12:04.881Z",
    "accepted": "2026-08-05T09:12:41.002Z",
    "onScene": null,
    "resolved": null
  },
  "trackingUrl": "${HOST}/track/emergency/${EXAMPLE_TOKEN}",
  "updatedAt": "2026-08-05T09:13:10.447Z"
}` }]} />

            <ParamTable
              title="Response fields"
              params={[
                { name: 'status',        type: 'string',  description: 'Current incident status. See Incident Statuses.' },
                { name: 'isActive',      type: 'boolean', description: 'False once the incident is resolved, cancelled or rejected. Stop polling when this turns false.' },
                { name: 'units',         type: 'array',   description: 'Units currently dispatched, en route, or on scene. Units that declined or were stood down are omitted — that is internal churn the reporter should not see.' },
                { name: 'etaMinutes',    type: 'number',  description: 'Soonest arrival across all responding units, or null. This is the number to show a waiting person.' },
                { name: 'closureReason', type: 'string',  description: 'Why the incident was closed, when it has been. Null while active.' },
                { name: 'timestamps',    type: 'object',  description: 'ISO timestamps for dispatched, accepted, onScene and resolved. Null until each happens.' },
                { name: 'updatedAt',     type: 'string',  description: 'When the incident last changed. Useful for deciding whether to re-render.' },
              ]}
            />

            <Note variant="info">
              An unknown token and a token belonging to a different command center both return the
              same <InlineCode>404 NOT_FOUND</InlineCode>. Distinguishing them would let a caller
              probe for valid tokens.
            </Note>
          </Section>

          {/* ── Cancel ────────────────────────────────────────────────────── */}
          <Section id="report-cancel" title="Cancel a Report">
            <Endpoint method="POST" path="/api/v1/emergency/cancel" />
            <P>
              Calls off a report the reporter no longer needs &mdash; a false alarm, a fire they put
              out themselves, a patient a neighbour already drove to hospital. Units still
              travelling are stood down, and the incident closes as{' '}
              <StatusPill status="cancelled" />.
            </P>

            <ParamTable
              title="Body parameters"
              params={[
                { name: 'trackingToken', type: 'string', required: true,  description: 'The token returned when the report was filed.' },
                { name: 'deviceId',      type: 'string', required: true,  description: 'The same deviceId the report was filed with. Must match exactly.' },
                { name: 'reason',        type: 'string', required: false, description: 'Why it is being cancelled, in the reporter’s words. Recorded on the incident and shown to the dispatcher. Defaults to "Cancelled by the reporter".' },
              ]}
            />

            <Note variant="warn">
              <strong>Only the reporting device may cancel.</strong> A tracking link is meant to be
              forwarded &mdash; to family, into group chats &mdash; so holding the link cannot be
              enough to call off someone else&rsquo;s ambulance. The matching{' '}
              <InlineCode>deviceId</InlineCode> is what proves the caller is the original reporter.
            </Note>

            <CodeBlock
              tabs={[
                {
                  lang: 'cURL',
                  code: `curl -X POST ${BASE}/emergency/cancel \\
  -H "x-api-key: sd_live_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "trackingToken": "${EXAMPLE_TOKEN}",
    "deviceId": "a7f3c9e1-device-install-id",
    "reason": "False alarm — he is awake and talking now"
  }'`,
                },
                {
                  lang: 'Node.js',
                  code: `const res = await fetch('${BASE}/emergency/cancel', {
  method: 'POST',
  headers: {
    'x-api-key': process.env.SWIFTDASH_API_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    trackingToken,
    deviceId: await getInstallId(),
    reason: 'False alarm',
  }),
});

if (res.status === 409) {
  const { code } = await res.json();
  // UNIT_ON_SCENE — a responder is already there. Tell the user to speak to them.
}`,
                },
              ]}
            />

            <P><strong>Response</strong> &mdash; <InlineCode>200 OK</InlineCode></P>
            <CodeBlock tabs={[{ lang: 'cURL', code: `{
  "referenceNumber": "MR-A3F91C",
  "status": "cancelled",
  "unitsStoodDown": 1
}` }]} />

            <ParamTable
              title="Failure codes specific to this call"
              params={[
                { name: 'NOT_REPORTER',  type: '403', description: 'The deviceId does not match the one the report was filed with. Someone holding a forwarded link cannot cancel.' },
                { name: 'ALREADY_CLOSED', type: '409', description: 'The incident is already resolved, cancelled or rejected. The body includes the current status.' },
                { name: 'UNIT_ON_SCENE',  type: '409', description: 'A responder has already arrived. Cancelling through an app is the wrong tool at that point — the dispatcher closes it out after speaking to them.' },
                { name: 'CANCEL_FAILED',  type: '500', description: 'The cancellation could not be written. Tell the user to call and say help is no longer needed.' },
              ]}
            />

            <Note variant="info">
              Units that were still travelling are recorded as <em>stood down</em>, not resolved.
              They did not do the work, and keeping that distinction is what stops cancelled calls
              from flattering the city&rsquo;s response statistics.
            </Note>
          </Section>

          {/* ── Tracking link ─────────────────────────────────────────────── */}
          <Section id="tracking-link" title="Tracking Link">
            <P>
              Every report comes back with a <InlineCode>trackingUrl</InlineCode>. It opens a public
              page that needs no account and no app &mdash; the reporter can open it, or send it to
              a relative who is not near the phone that reported.
            </P>

            <Endpoint method="GET" path={`${HOST}/track/emergency/{trackingToken}`} />

            <P>
              The page shows the stage the response has reached, the estimated arrival, the
              responding unit&rsquo;s callsign, a live map of the unit as it travels, and a button to
              call the command center. It updates itself; there is nothing to refresh.
            </P>
            <P>
              It carries the command center&rsquo;s own branding &mdash; logo, colours, tagline and
              per-stage wording, all configured under Settings &rarr; Branding in the dashboard.
              Nothing about the page needs to be built or hosted by you.
            </P>

            <Note variant="warn">
              The tracking token is a bearer secret: whoever holds the link can view the incident.
              It is 64 random hex characters and cannot be guessed, but it can be forwarded. That
              is why the page deliberately omits the reporter&rsquo;s name, their phone number and the
              free-text description &mdash; on a crime report especially, that is narrative detail a
              forwarded link has no business carrying.
            </Note>
          </Section>

          {/* ── Tracking endpoint ─────────────────────────────────────────── */}
          <Section id="tracking-api" title="Tracking Endpoint">
            <Endpoint method="GET" path="/api/track/emergency/{trackingToken}" />
            <P>
              The data behind that page, should you want to build your own view of it in the app
              instead of opening a browser. Note the path: this one sits outside{' '}
              <InlineCode>/v1</InlineCode> and takes <strong>no API key</strong>. The tracking token
              is the credential, which is what lets it work in a browser nobody has logged into.
            </P>

            <CodeBlock tabs={[{ lang: 'cURL', code: `curl ${HOST}/api/track/emergency/${EXAMPLE_TOKEN}` }]} />

            <P><strong>Response</strong> &mdash; <InlineCode>200 OK</InlineCode>, abridged</P>
            <CodeBlock tabs={[{ lang: 'cURL', code: `{
  "referenceNumber": "MR-A3F91C",
  "status": "en_route",
  "isActive": true,
  "incidentType": "medical",
  "address": "Roxas City Plaza, Capiz",
  "landmark": "In front of the cathedral",
  "location": { "lat": 11.5853, "lng": 122.7511 },
  "units": [
    { "callsign": "AMB-01", "agency": "CDRRMO_AMBULANCE", "status": "en_route", "etaMinutes": 6 }
  ],
  "etaMinutes": 6,
  "positions": [
    { "callsign": "AMB-01", "lat": 11.5893, "lng": 122.7551 }
  ],
  "commandCenter": { "name": "RCERT", "phone": "+639673871221" },
  "channel": "tracking:3f2a1b8c-9d4e-4a7f-b1c2-8e5d6a9f0b3c",
  "timestamps": { "reported": "2026-08-05T09:11:20.114Z", "dispatched": "..." },
  "branding": { "logoUrl": "...", "statusLabels": {} },
  "updatedAt": "2026-08-05T09:13:10.447Z"
}` }]} />

            <ParamTable
              title="Fields that differ from the key-authenticated status call"
              params={[
                { name: 'location',    type: 'object', description: 'Where the emergency is. Included here because this response has to draw a map.' },
                { name: 'positions',   type: 'array',  description: 'Last known position of each responding unit. A fix older than five minutes is omitted rather than drawn somewhere the unit has long since left.' },
                { name: 'incidentType', type: 'string', description: 'medical, fire or crime — used to colour the page.' },
                { name: 'commandCenter', type: 'object', description: 'Name and callback number of the command center handling the incident.' },
                { name: 'branding',    type: 'object', description: 'The command center’s presentation settings. Colours are preferences, not instructions — check them for contrast before applying them to your own surface.' },
                { name: 'channel',     type: 'string', description: 'Realtime channel carrying live unit positions, for clients that want movement between polls rather than at poll rate.' },
              ]}
            />

            <Note variant="info">
              This endpoint deliberately omits the reporter&rsquo;s name, phone and description for
              the same reason the page does. If your app needs those, it already has them &mdash; it
              sent them.
            </Note>
          </Section>

          {/* ── Reference: statuses ───────────────────────────────────────── */}
          <Section id="ref-statuses" title="Incident Statuses">
            <P>
              An incident&rsquo;s status is derived from its units, not set directly. Assigning the
              first unit moves it to <StatusPill status="dispatched" />; that unit accepting moves
              it to <StatusPill status="en_route" />, and so on.
            </P>

            <div className="rounded-lg border border-border overflow-hidden my-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground w-40">Status</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground w-24">Active</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Meaning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    ['submitted',  'Yes', 'Filed and waiting on the dispatch board. No unit assigned yet.'],
                    ['dispatched', 'Yes', 'A dispatcher has assigned at least one unit, which has not yet set off.'],
                    ['en_route',   'Yes', 'A unit has accepted and is travelling to the scene.'],
                    ['on_scene',   'Yes', 'A unit has arrived. From this point the report can no longer be cancelled from the app.'],
                    ['resolved',   'No',  'Responders have finished. Reassigning a unit reopens the incident — fires reignite.'],
                    ['cancelled',  'No',  'Called off, either by the reporter or by a dispatcher.'],
                    ['rejected',   'No',  'A dispatcher reviewed it and sent no unit.'],
                  ].map(([status, active, meaning]) => (
                    <tr key={status} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3"><StatusPill status={status} /></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{active}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground leading-relaxed">{meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <P>
              Treat this list as open. Branch on <InlineCode>isActive</InlineCode> rather than
              enumerating terminal statuses, so a status added later does not leave your app polling
              a finished incident forever.
            </P>
          </Section>

          {/* ── Reference: types ──────────────────────────────────────────── */}
          <SubSection id="ref-types" title="Types &amp; Agencies">
            <P>
              <InlineCode>incidentType</InlineCode> determines routing. The mapping is fixed; you do
              not choose the agency.
            </P>
            <ParamTable
              params={[
                { name: 'medical', type: 'CDRRMO_AMBULANCE', description: 'Injury, collapse, difficulty breathing, anything needing an ambulance.' },
                { name: 'fire',    type: 'BFP',              description: 'Fire, smoke, or a fire risk. Routed to the Bureau of Fire Protection.' },
                { name: 'crime',   type: 'PNP',              description: 'Assault, theft in progress, threat to a person. Routed to the Philippine National Police.' },
              ]}
            />
          </SubSection>

          {/* ── Reference: flags ──────────────────────────────────────────── */}
          <SubSection id="ref-flags" title="Review Flags">
            <P>
              A report is flagged when something about it deserves a dispatcher&rsquo;s attention. A
              flag <strong>never blocks</strong> the report and is not visible in the API response
              &mdash; it is a note attached to the incident, with its reason, for the person deciding
              whether to commit a unit.
            </P>
            <ParamTable
              params={[
                { name: 'No GPS fix',      type: 'flag', description: 'deviceLat and deviceLng were not supplied, so the pinned location could not be corroborated. Sending them is the easiest way to avoid this.' },
                { name: 'Pin far from GPS', type: 'flag', description: 'The reported location is more than 200 metres from the device’s own fix. Legitimate when reporting something seen at a distance — which is exactly why a human judges it.' },
                { name: 'Repeat device',   type: 'flag', description: 'Three or more reports from the same deviceId within 24 hours. The count is recorded on the incident.' },
                { name: 'Repeat phone',    type: 'flag', description: 'Three or more reports carrying the same reporterPhone within 24 hours, counted across devices. Numbers are normalised first, so +639171234567, 09171234567 and 639171234567 are one number. Not applied to anonymous reports, whose phone is never stored.' },
              ]}
            />
            <Note variant="warn">
              The phone rule flags; it never blocks. Because the number is not verified, anyone can
              type anyone else&rsquo;s &mdash; so a limit that refused reports would let one abuser
              silence a stranger&rsquo;s real emergency. It becomes a far stronger signal once the
              number is verified with an OTP at the app&rsquo;s end, which is worth doing: a verified
              phone survives reinstalls and handset changes, which <InlineCode>deviceId</InlineCode>
              does not.
            </Note>
            <Note variant="info">
              None of these are rate limits. There is no request throttle on emergency reporting,
              deliberately &mdash; the same person reporting three times in an hour may be describing
              a situation that keeps getting worse.
            </Note>
          </SubSection>

          {/* ── Footer ────────────────────────────────────────────────────── */}
          <div className="pt-14 mt-6 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Looking for parcels, couriers and fleet endpoints? Those live in the{' '}
              <Link href="/docs" className="text-primary underline underline-offset-2">
                SwiftDash Delivery API reference
              </Link>
              .
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
