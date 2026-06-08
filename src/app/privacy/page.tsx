'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Globe, Smartphone } from 'lucide-react';

const LAST_UPDATED = 'June 9, 2026';
const COMPANY = 'SwiftDash Philippines Inc.';
const EMAIL = 'privacy@swiftdashdms.com';

type Tab = 'business' | 'driver';

export default function PrivacyPolicyPage() {
  const [tab, setTab] = useState<Tab>('business');

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/assets/images/swiftdash_logo.png" alt="SwiftDash Logo" width={32} height={32} />
            <span className="text-xl font-bold tracking-tight">SwiftDash</span>
          </Link>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Button asChild variant="ghost" size="sm">
              <Link href="/terms">Terms of Service</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/business/signup">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="pt-24 pb-20">
        <div className="max-w-3xl mx-auto px-6">
          {/* Title */}
          <div className="mb-8">
            <p className="text-sm font-medium text-primary mb-2 uppercase tracking-wide">Legal</p>
            <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
            <p className="text-muted-foreground">Last updated: {LAST_UPDATED}</p>
          </div>

          {/* Tab Selector */}
          <div className="flex gap-2 mb-10 p-1 bg-muted rounded-xl w-fit">
            <button
              onClick={() => setTab('business')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                tab === 'business'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Globe className="w-4 h-4" />
              Business Platform
            </button>
            <button
              onClick={() => setTab('driver')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                tab === 'driver'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              Driver App
            </button>
          </div>

          {/* ─── BUSINESS PLATFORM TAB ─── */}
          {tab === 'business' && (
            <div className="prose prose-neutral dark:prose-invert max-w-none space-y-10 text-[15px] leading-relaxed">

              <section>
                <p>
                  {COMPANY} ("SwiftDash", "we", "us", or "our") operates the SwiftDash delivery management platform
                  available at <strong>swiftdashdms.com</strong> and its subdomains (the "Service"). This Privacy Policy
                  describes how we collect, use, disclose, and protect personal information when you use our Service.
                </p>
                <p className="mt-4">
                  By accessing or using the Service, you agree to the collection and use of information in accordance
                  with this policy. If you do not agree, please do not use the Service.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">1. Information We Collect</h2>
                <h3 className="text-base font-semibold mt-5 mb-2">1.1 Business Account Holders</h3>
                <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                  <li>Full name, email address, and phone number of the account owner and team members</li>
                  <li>Business name, address, registration number, and tax identification number</li>
                  <li>Payment information (processed by third-party payment providers; we do not store raw card data)</li>
                  <li>API keys and webhook configurations</li>
                  <li>Usage data including deliveries created, dispatch activity, and dashboard interactions</li>
                </ul>

                <h3 className="text-base font-semibold mt-5 mb-2">1.2 Drivers (via Business Platform)</h3>
                <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                  <li>Full name, phone number, government-issued ID, and driver's license details</li>
                  <li>Vehicle information including make, model, plate number, and registration documents</li>
                  <li>Real-time GPS location while a delivery is active and the driver is online</li>
                  <li>Earnings, delivery history, and performance data</li>
                  <li>Bank account or e-wallet details for payouts</li>
                </ul>

                <h3 className="text-base font-semibold mt-5 mb-2">1.3 Delivery Recipients & Senders</h3>
                <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                  <li>Name, phone number, and email address provided at booking</li>
                  <li>Pickup and delivery addresses</li>
                  <li>Package description and declared value</li>
                  <li>Proof-of-delivery photos and recipient signatures</li>
                </ul>

                <h3 className="text-base font-semibold mt-5 mb-2">1.4 Automatically Collected Information</h3>
                <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                  <li>IP address, browser type, and device identifiers</li>
                  <li>Pages visited, features used, and timestamps</li>
                  <li>Cookies and similar tracking technologies (see Section 7)</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">2. How We Use Your Information</h2>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>To provide, operate, and improve the Service</li>
                  <li>To match deliveries with available drivers and track progress in real time</li>
                  <li>To send transactional communications including booking confirmations, tracking updates, and receipts</li>
                  <li>To process payments and driver payouts</li>
                  <li>To verify driver identities and comply with regulatory requirements</li>
                  <li>To detect and prevent fraud, abuse, and security incidents</li>
                  <li>To generate aggregated analytics and improve platform performance</li>
                  <li>To comply with applicable laws, including the Philippine Data Privacy Act of 2012 (Republic Act 10173)</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">3. Legal Basis for Processing</h2>
                <p className="text-muted-foreground">
                  We process personal data on the following grounds under the Data Privacy Act of 2012 and its
                  Implementing Rules and Regulations:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-3">
                  <li><strong className="text-foreground">Contract performance</strong> — processing necessary to fulfill our service agreement with you</li>
                  <li><strong className="text-foreground">Legitimate interests</strong> — fraud prevention, security, and platform analytics</li>
                  <li><strong className="text-foreground">Legal obligation</strong> — compliance with Philippine laws and regulations</li>
                  <li><strong className="text-foreground">Consent</strong> — where we have obtained your explicit consent, such as for marketing communications</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">4. Sharing of Information</h2>
                <p className="text-muted-foreground mb-3">We do not sell your personal information. We may share it with:</p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li><strong className="text-foreground">Business customers</strong> — businesses using SwiftDash receive contact and delivery details for orders they create</li>
                  <li><strong className="text-foreground">Drivers</strong> — assigned drivers receive the pickup/delivery address and contact number for their active delivery</li>
                  <li><strong className="text-foreground">Service providers</strong> — cloud hosting (Supabase), mapping (Mapbox), messaging (Semaphore), email (Resend), real-time communications (Ably), and payment processors</li>
                  <li><strong className="text-foreground">Law enforcement</strong> — when required by law, court order, or to protect rights and safety</li>
                  <li><strong className="text-foreground">Successors</strong> — in the event of a merger, acquisition, or sale of assets, with prior notice to users</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">5. Driver Location Data</h2>
                <p className="text-muted-foreground">
                  When a driver is active on a delivery, their real-time GPS coordinates are:
                </p>
                <ul className="list-disc pl-6 space-y-1 text-muted-foreground mt-3">
                  <li>Transmitted via encrypted channels to the delivery recipient's tracking page for that specific delivery only</li>
                  <li>Visible to the business that owns the delivery in their dispatch dashboard</li>
                  <li>Retained for a limited period for analytics, dispute resolution, and service improvement</li>
                  <li>Not shared with third parties for advertising purposes</li>
                </ul>
                <p className="text-muted-foreground mt-3">
                  Location broadcasting stops automatically when the driver marks a delivery as complete or goes offline.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">6. Data Retention</h2>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>Delivery records are retained for a minimum of 3 years for legal and audit purposes</li>
                  <li>Driver verification documents are retained for the duration of the driver's active status plus 1 year</li>
                  <li>Real-time location data is not permanently stored; only key events are logged</li>
                  <li>Account data is retained until the account is deleted, after which it is anonymized or deleted within 30 days</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">7. Cookies</h2>
                <p className="text-muted-foreground">
                  We use strictly necessary cookies to maintain your session and authentication state. We do not use
                  third-party advertising cookies. You may disable cookies in your browser settings, but this may
                  affect your ability to use certain features of the Service.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">8. Security</h2>
                <p className="text-muted-foreground">
                  We implement industry-standard security measures including encryption in transit (TLS), encryption at
                  rest, row-level access controls, and regular security reviews. However, no method of electronic
                  transmission or storage is 100% secure, and we cannot guarantee absolute security.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">9. Your Rights</h2>
                <p className="text-muted-foreground mb-3">
                  Under the Philippine Data Privacy Act of 2012, you have the right to:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li><strong className="text-foreground">Access</strong> — request a copy of personal information we hold about you</li>
                  <li><strong className="text-foreground">Correction</strong> — request correction of inaccurate or incomplete information</li>
                  <li><strong className="text-foreground">Erasure</strong> — request deletion of your data, subject to legal retention requirements</li>
                  <li><strong className="text-foreground">Object</strong> — object to certain types of processing, including direct marketing</li>
                  <li><strong className="text-foreground">Data portability</strong> — receive your data in a structured, machine-readable format</li>
                  <li><strong className="text-foreground">Withdraw consent</strong> — where processing is based on consent, withdraw it at any time</li>
                </ul>
                <p className="text-muted-foreground mt-3">
                  To exercise these rights, contact us at <strong>{EMAIL}</strong>. We will respond within 15 business days.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">10. Children's Privacy</h2>
                <p className="text-muted-foreground">
                  The Service is not directed to individuals under 18 years of age. We do not knowingly collect
                  personal information from minors. If you believe a minor has provided us with personal information,
                  please contact us immediately.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">11. Changes to This Policy</h2>
                <p className="text-muted-foreground">
                  We may update this Privacy Policy from time to time. We will notify registered users by email and
                  post the updated policy on this page with a revised "Last updated" date. Continued use of the
                  Service after changes take effect constitutes acceptance of the revised policy.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">12. Contact Us</h2>
                <p className="text-muted-foreground">
                  If you have questions about this Privacy Policy or wish to exercise your rights, please contact our
                  Data Protection Officer:
                </p>
                <div className="mt-4 p-5 rounded-xl border border-border bg-muted/40 space-y-1 text-sm">
                  <p className="font-semibold text-foreground">{COMPANY}</p>
                  <p className="text-muted-foreground">Data Protection Officer</p>
                  <p className="text-muted-foreground">Philippines</p>
                  <p>
                    <a href={`mailto:${EMAIL}`} className="text-primary hover:underline">{EMAIL}</a>
                  </p>
                </div>
              </section>

            </div>
          )}

          {/* ─── DRIVER APP TAB ─── */}
          {tab === 'driver' && (
            <div className="prose prose-neutral dark:prose-invert max-w-none space-y-10 text-[15px] leading-relaxed">

              <section>
                <div className="flex items-center gap-3 mb-4 p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <Smartphone className="w-5 h-5 text-primary flex-shrink-0" />
                  <p className="text-sm text-muted-foreground m-0">
                    This section applies specifically to the <strong className="text-foreground">SwiftDash Driver App</strong> (mobile application for delivery drivers).
                    The full privacy framework of {COMPANY} and the Data Privacy Act of 2012 (RA 10173) applies to all sections.
                  </p>
                </div>
                <p className="text-muted-foreground">
                  {COMPANY} ("SwiftDash", "we", "us", or "our") operates the SwiftDash Driver App (the "App"), a
                  mobile application that enables delivery drivers to receive job assignments, navigate to destinations,
                  and report delivery status. This policy describes what data the App collects, why it collects it, and
                  how it is used and protected.
                </p>
                <p className="mt-4 text-muted-foreground">
                  By installing and using the App, you agree to this Privacy Policy. If you do not agree, please
                  uninstall the App and contact us to request deletion of your account.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">1. Information We Collect</h2>

                <h3 className="text-base font-semibold mt-5 mb-2">1.1 Account & Identity Information</h3>
                <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                  <li>Full legal name, mobile number, and email address</li>
                  <li>Government-issued ID (e.g., driver's license, SSS, PhilSys ID) — submitted for verification only</li>
                  <li>Driver's license number, expiry date, and license category</li>
                  <li>Profile photo</li>
                  <li>Bank account number or GCash/Maya e-wallet number for earnings payouts</li>
                </ul>

                <h3 className="text-base font-semibold mt-5 mb-2">1.2 Vehicle Information</h3>
                <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                  <li>Vehicle make, model, year, and color</li>
                  <li>Plate number and OR/CR (Official Receipt / Certificate of Registration)</li>
                  <li>Vehicle type (motorcycle, car, van, truck)</li>
                </ul>

                <h3 className="text-base font-semibold mt-5 mb-2">1.3 Location Data</h3>
                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm text-muted-foreground mb-3">
                  <strong className="text-foreground">Important:</strong> The App requests access to your device's GPS location. Below is a clear breakdown of when and how it is used.
                </div>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>
                    <strong className="text-foreground">Foreground location</strong> — collected when the App is open and you are on an active delivery. Used to display your position on the dispatch map and provide real-time tracking to the delivery recipient.
                  </li>
                  <li>
                    <strong className="text-foreground">Background location</strong> — collected when the App is running in the background and you have an active delivery in progress. This allows the tracking page to remain live even if you temporarily switch apps. Background location is <em>not</em> collected when you are offline or have no active delivery.
                  </li>
                  <li>
                    <strong className="text-foreground">Location stops</strong> when you mark a delivery as complete, go offline, or close the App entirely.
                  </li>
                  <li>GPS coordinates are transmitted in real time via an encrypted channel to our servers and are visible only to the assigned business and the delivery recipient for that specific delivery.</li>
                  <li>We do not sell or share location data with advertisers.</li>
                </ul>

                <h3 className="text-base font-semibold mt-5 mb-2">1.4 Camera & Photos</h3>
                <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                  <li>The App requests camera access to capture <strong className="text-foreground">proof-of-delivery photos</strong> (e.g., package at doorstep, recipient signature) and vehicle/document uploads during onboarding.</li>
                  <li>Photos are uploaded to secure cloud storage and are accessible only to the business that owns the delivery.</li>
                  <li>The App does not access your camera roll or media library without explicit permission.</li>
                </ul>

                <h3 className="text-base font-semibold mt-5 mb-2">1.5 Push Notification Token</h3>
                <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                  <li>When you allow notifications, the App registers a device token with Firebase Cloud Messaging (FCM) or Apple Push Notification Service (APNs).</li>
                  <li>This token is stored against your driver profile and used exclusively to deliver job alerts, dispatch assignments, and account notifications.</li>
                  <li>You can revoke notification permissions at any time in your device settings.</li>
                </ul>

                <h3 className="text-base font-semibold mt-5 mb-2">1.6 Device & App Usage Data</h3>
                <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                  <li>Device model, operating system version, and app version</li>
                  <li>Crash reports and error logs (anonymized) used for debugging</li>
                  <li>Feature usage events (e.g., job accepted, status updated) for performance analytics</li>
                  <li>Network type (Wi-Fi / mobile data) — used for connectivity diagnostics only</li>
                </ul>

                <h3 className="text-base font-semibold mt-5 mb-2">1.7 Delivery Activity Data</h3>
                <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                  <li>Job history: deliveries accepted, completed, cancelled, or failed</li>
                  <li>Timestamps for each delivery status change (e.g., picked up, in transit, delivered)</li>
                  <li>Customer ratings and feedback left after a completed delivery</li>
                  <li>Reported incidents or exceptions (e.g., recipient absent, wrong address)</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">2. How We Use Your Information</h2>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>To verify your identity and eligibility to operate as a driver on the platform</li>
                  <li>To match and assign deliveries to available drivers based on proximity and vehicle type</li>
                  <li>To provide real-time GPS tracking to the delivery recipient and dispatching business</li>
                  <li>To process earnings calculations and initiate payouts to your nominated account</li>
                  <li>To send push notifications for job assignments, updates, and account communications</li>
                  <li>To store proof-of-delivery evidence for dispute resolution and business record-keeping</li>
                  <li>To improve App performance, routing accuracy, and overall service quality</li>
                  <li>To detect and prevent fraudulent activity, fake GPS spoofing, or account misuse</li>
                  <li>To comply with the Philippine Data Privacy Act of 2012 (RA 10173) and other applicable laws</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">3. Legal Basis for Processing</h2>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li><strong className="text-foreground">Contract performance</strong> — processing your location, delivery activity, and payment details is necessary to provide the services you signed up for</li>
                  <li><strong className="text-foreground">Consent</strong> — location access, camera access, and push notifications are granted by you through device permission prompts; you may withdraw consent at any time in device settings</li>
                  <li><strong className="text-foreground">Legitimate interests</strong> — fraud detection, GPS spoofing prevention, and App analytics</li>
                  <li><strong className="text-foreground">Legal obligation</strong> — identity verification and compliance with applicable Philippine regulations</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">4. Sharing of Information</h2>
                <p className="text-muted-foreground mb-3">We do not sell your personal information. We share driver data only as follows:</p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li><strong className="text-foreground">Businesses (per delivery)</strong> — the dispatching business sees your name, photo, vehicle details, real-time location, and delivery status for jobs assigned to you</li>
                  <li><strong className="text-foreground">Delivery recipients</strong> — the recipient's tracking page shows your first name, vehicle type, and live location for their specific delivery only</li>
                  <li><strong className="text-foreground">Cloud infrastructure</strong> — Supabase (database & authentication), Firebase (push notifications), Mapbox (navigation)</li>
                  <li><strong className="text-foreground">Payment processors</strong> — your bank/e-wallet details are shared only with the payment provider to process your earnings</li>
                  <li><strong className="text-foreground">Law enforcement</strong> — when required by a valid court order or legal process</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">5. Data Retention</h2>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li><strong className="text-foreground">Active driver accounts</strong> — data retained for the duration of your account plus 1 year after deactivation</li>
                  <li><strong className="text-foreground">Delivery records & proof photos</strong> — retained for a minimum of 3 years for audit and dispute resolution</li>
                  <li><strong className="text-foreground">Real-time location stream</strong> — not stored permanently; only status-change events (e.g., picked up at 2:30 PM) are logged</li>
                  <li><strong className="text-foreground">Verification documents</strong> (ID, license, OR/CR) — retained while your account is active; deleted within 90 days of account closure</li>
                  <li><strong className="text-foreground">Push notification token</strong> — refreshed automatically; stale tokens are removed when the App is uninstalled or permissions revoked</li>
                  <li><strong className="text-foreground">Crash logs</strong> — retained for up to 90 days for debugging purposes, then automatically purged</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">6. Permissions Summary</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 pr-4 font-semibold text-foreground">Permission</th>
                        <th className="text-left py-2 pr-4 font-semibold text-foreground">Required?</th>
                        <th className="text-left py-2 font-semibold text-foreground">Purpose</th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground divide-y divide-border/50">
                      <tr><td className="py-2 pr-4 font-medium text-foreground">Location (foreground)</td><td className="py-2 pr-4">Required</td><td className="py-2">Real-time delivery tracking and navigation</td></tr>
                      <tr><td className="py-2 pr-4 font-medium text-foreground">Location (background)</td><td className="py-2 pr-4">Required for active delivery</td><td className="py-2">Keep tracking live when App is backgrounded</td></tr>
                      <tr><td className="py-2 pr-4 font-medium text-foreground">Camera</td><td className="py-2 pr-4">Required for POD</td><td className="py-2">Proof-of-delivery photos and document uploads</td></tr>
                      <tr><td className="py-2 pr-4 font-medium text-foreground">Push notifications</td><td className="py-2 pr-4">Recommended</td><td className="py-2">Job assignments and delivery alerts</td></tr>
                      <tr><td className="py-2 pr-4 font-medium text-foreground">Internet access</td><td className="py-2 pr-4">Required</td><td className="py-2">All App functionality</td></tr>
                      <tr><td className="py-2 pr-4 font-medium text-foreground">Phone state</td><td className="py-2 pr-4">Optional</td><td className="py-2">Crash diagnostics only</td></tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">7. Security</h2>
                <p className="text-muted-foreground">
                  All data transmitted between the App and our servers is encrypted using TLS 1.2 or higher.
                  Driver credentials are stored using industry-standard hashing. Location data is transmitted
                  over secure real-time channels. Verification documents are stored in access-controlled cloud
                  storage with no public URLs. We conduct regular security audits and penetration tests.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">8. Your Rights as a Driver</h2>
                <p className="text-muted-foreground mb-3">
                  Under the Philippine Data Privacy Act of 2012 (RA 10173), you have the right to:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li><strong className="text-foreground">Access</strong> — request a copy of all personal data we hold about you, including delivery history and verification documents</li>
                  <li><strong className="text-foreground">Correction</strong> — update inaccurate information directly in the App (name, vehicle details, payout account) or by contacting us</li>
                  <li><strong className="text-foreground">Erasure</strong> — request deletion of your account and associated data, subject to our minimum retention obligations</li>
                  <li><strong className="text-foreground">Object</strong> — object to processing for purposes beyond what is strictly necessary to operate the App</li>
                  <li><strong className="text-foreground">Data portability</strong> — receive your delivery history and earnings data in a portable format</li>
                  <li><strong className="text-foreground">Withdraw location consent</strong> — revoke location access at any time via device settings (note: this will prevent you from accepting deliveries)</li>
                  <li><strong className="text-foreground">Withdraw notification consent</strong> — disable push notifications in device settings at any time</li>
                </ul>
                <p className="text-muted-foreground mt-3">
                  To submit a data request, email <strong>{EMAIL}</strong> from your registered email address. We will respond within 15 business days.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">9. Children's Privacy</h2>
                <p className="text-muted-foreground">
                  The Driver App is strictly for adults aged 18 and above who hold a valid driver's license.
                  We do not knowingly collect data from minors. Driver accounts require identity verification
                  which confirms the applicant meets this requirement.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">10. Changes to This Policy</h2>
                <p className="text-muted-foreground">
                  We will notify you of material changes via push notification and/or email at least 14 days
                  before they take effect. Continued use of the App after changes take effect constitutes
                  acceptance of the revised policy. The "Last updated" date at the top of this page reflects
                  the most recent revision.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">11. Contact Us</h2>
                <p className="text-muted-foreground">
                  For privacy-related questions about the Driver App, contact our Data Protection Officer:
                </p>
                <div className="mt-4 p-5 rounded-xl border border-border bg-muted/40 space-y-1 text-sm">
                  <p className="font-semibold text-foreground">{COMPANY}</p>
                  <p className="text-muted-foreground">Data Protection Officer — Driver App</p>
                  <p className="text-muted-foreground">Philippines</p>
                  <p>
                    <a href={`mailto:${EMAIL}`} className="text-primary hover:underline">{EMAIL}</a>
                  </p>
                </div>
              </section>

            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8">
        <div className="container mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} {COMPANY}. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-sm">
            <Link href="/privacy" className="text-primary font-medium">Privacy Policy</Link>
            <Link href="/terms" className="text-muted-foreground hover:text-foreground transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
