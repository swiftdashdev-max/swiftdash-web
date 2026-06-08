'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Globe, Smartphone } from 'lucide-react';

const LAST_UPDATED = 'June 9, 2026';
const COMPANY = 'SwiftDash Philippines Inc.';
const EMAIL = 'legal@swiftdashdms.com';

type Tab = 'business' | 'driver';

export default function TermsOfServicePage() {
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
              <Link href="/privacy">Privacy Policy</Link>
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
            <h1 className="text-4xl font-bold mb-4">Terms of Service</h1>
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
                Please read these Terms of Service ("Terms") carefully before using the SwiftDash platform
                operated by <strong>{COMPANY}</strong> ("SwiftDash", "we", "us", or "our"). By registering
                for, accessing, or using the Service you agree to be bound by these Terms and our{' '}
                <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
              </p>
              <p className="mt-4">
                If you are agreeing on behalf of a company or other legal entity, you represent that you have
                the authority to bind that entity to these Terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">1. Definitions</h2>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li><strong className="text-foreground">"Platform"</strong> — the SwiftDash web application, API, mobile interfaces, and all related services at swiftdashdms.com</li>
                <li><strong className="text-foreground">"Business"</strong> — a company or individual that registers for a SwiftDash business account to create and manage deliveries</li>
                <li><strong className="text-foreground">"Driver"</strong> — a verified independent contractor or fleet driver who accepts and completes deliveries through the Platform</li>
                <li><strong className="text-foreground">"Customer"</strong> — the end recipient or sender of a delivery facilitated through the Platform</li>
                <li><strong className="text-foreground">"Delivery"</strong> — a logistics task created on the Platform, including pickup, transport, and drop-off of a package</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2. Account Registration</h2>
              <p className="text-muted-foreground">To use the Service, you must:</p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-3">
                <li>Provide accurate, complete, and current registration information</li>
                <li>Maintain the security of your password and account credentials</li>
                <li>Promptly notify us of any unauthorized access to your account</li>
                <li>Not share account credentials with unauthorized third parties</li>
              </ul>
              <p className="text-muted-foreground mt-3">
                Business accounts are subject to approval by SwiftDash. We reserve the right to reject, suspend, or
                terminate any account at our discretion. You must be at least 18 years old to register.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">3. Use of the Service</h2>
              <h3 className="text-base font-semibold mt-5 mb-2">3.1 Permitted Use</h3>
              <p className="text-muted-foreground">
                You may use the Service solely for lawful business purposes in connection with managing, dispatching,
                and tracking deliveries within the Philippines.
              </p>

              <h3 className="text-base font-semibold mt-5 mb-2">3.2 Prohibited Use</h3>
              <p className="text-muted-foreground mb-2">You must not use the Service to:</p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Transport illegal, hazardous, counterfeit, or prohibited goods under Philippine law</li>
                <li>Facilitate fraud, money laundering, or any criminal activity</li>
                <li>Reverse engineer, scrape, or attempt to extract source code from the Platform</li>
                <li>Interfere with, disrupt, or overburden the Platform's servers or networks</li>
                <li>Circumvent any security, rate-limiting, or access control measures</li>
                <li>Impersonate any person, business, or entity</li>
                <li>Transmit spam, malware, or other harmful content</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. Deliveries & Driver Relationships</h2>
              <p className="text-muted-foreground">
                SwiftDash is a technology platform that connects businesses with independent delivery drivers.
                We are not a logistics company, freight forwarder, or carrier. Drivers are independent contractors
                and are not employees, agents, or partners of SwiftDash.
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-3">
                <li>Businesses are responsible for the accuracy of pickup and delivery information they provide</li>
                <li>Businesses must ensure packages comply with applicable laws and are properly packaged</li>
                <li>SwiftDash does not guarantee delivery timeframes and is not liable for delays caused by traffic, weather, or force majeure</li>
                <li>Proof-of-delivery photos and signatures are provided as evidence of completion; disputes must be raised within 48 hours of delivery</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Fees & Payment</h2>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Delivery fees are calculated based on distance, vehicle type, and applicable surcharges as displayed at booking</li>
                <li>All fees are in Philippine Peso (PHP) and are inclusive of applicable taxes unless stated otherwise</li>
                <li>Payment is due at the time of booking or as agreed under a business billing arrangement</li>
                <li>SwiftDash charges a platform commission on each completed delivery; the current rate is disclosed in your account dashboard</li>
                <li>We reserve the right to modify pricing with at least 14 days' notice to active businesses</li>
                <li>Refunds for cancelled deliveries are subject to our Cancellation Policy in Section 6</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">6. Cancellation & Refunds</h2>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Deliveries cancelled before a driver is assigned incur no charge</li>
                <li>Deliveries cancelled after driver assignment but before pickup may incur a cancellation fee</li>
                <li>Deliveries cancelled after pickup are charged the full delivery fee</li>
                <li>Refunds, where applicable, are processed to the original payment method within 5–10 business days</li>
                <li>Failed delivery attempts are subject to re-delivery fees</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">7. API Access</h2>
              <p className="text-muted-foreground">
                If you access the Service through our API:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-3">
                <li>You must keep your API keys confidential and not expose them in client-side code or public repositories</li>
                <li>API usage is subject to rate limits; excessive usage that degrades service for other users may result in throttling or suspension</li>
                <li>You are responsible for all activity that occurs under your API keys</li>
                <li>We reserve the right to revoke API access for violations of these Terms</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">8. Intellectual Property</h2>
              <p className="text-muted-foreground">
                The SwiftDash name, logo, platform design, and all associated intellectual property are owned
                exclusively by {COMPANY}. Nothing in these Terms grants you any right to use our trademarks,
                trade names, or branding without prior written consent.
              </p>
              <p className="text-muted-foreground mt-3">
                You retain ownership of your business data. By using the Service, you grant us a limited,
                non-exclusive license to process and display your data solely to provide the Service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">9. Disclaimer of Warranties</h2>
              <p className="text-muted-foreground">
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS
                OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR
                NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE,
                OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">10. Limitation of Liability</h2>
              <p className="text-muted-foreground">
                TO THE MAXIMUM EXTENT PERMITTED BY PHILIPPINE LAW, SWIFTDASH SHALL NOT BE LIABLE FOR ANY
                INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS,
                DATA, OR GOODWILL, ARISING FROM YOUR USE OF OR INABILITY TO USE THE SERVICE.
              </p>
              <p className="text-muted-foreground mt-3">
                OUR TOTAL AGGREGATE LIABILITY TO YOU SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID
                TO SWIFTDASH IN THE 3 MONTHS PRECEDING THE CLAIM, OR (B) PHP 5,000.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">11. Indemnification</h2>
              <p className="text-muted-foreground">
                You agree to indemnify and hold harmless SwiftDash and its officers, directors, employees, and
                agents from any claims, damages, losses, and expenses (including reasonable legal fees) arising
                from your use of the Service, your violation of these Terms, or your violation of any rights of
                a third party.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">12. Termination</h2>
              <p className="text-muted-foreground">
                Either party may terminate the agreement at any time. We may suspend or terminate your access
                immediately without notice if we determine you have violated these Terms, engaged in fraudulent
                activity, or pose a risk to the Platform or its users. Upon termination, your right to use the
                Service ceases immediately. Sections 8, 9, 10, 11, and 13 survive termination.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">13. Governing Law & Disputes</h2>
              <p className="text-muted-foreground">
                These Terms shall be governed by and construed in accordance with the laws of the Republic of the
                Philippines. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction
                of the courts of Makati City, Metro Manila, Philippines.
              </p>
              <p className="text-muted-foreground mt-3">
                Before initiating formal proceedings, the parties agree to attempt in good faith to resolve any
                dispute through negotiation for a period of 30 days.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">14. Changes to These Terms</h2>
              <p className="text-muted-foreground">
                We may update these Terms at any time. We will provide at least 14 days' notice for material
                changes via email to registered users. Your continued use of the Service after changes take
                effect constitutes your acceptance of the revised Terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">15. Contact Us</h2>
              <p className="text-muted-foreground">For legal inquiries regarding these Terms:</p>
              <div className="mt-4 p-5 rounded-xl border border-border bg-muted/40 space-y-1 text-sm">
                <p className="font-semibold text-foreground">{COMPANY}</p>
                <p className="text-muted-foreground">Legal Department</p>
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
                    This is the <strong className="text-foreground">Driver Terms & Conditions</strong> governing your use of the SwiftDash Driver App as an independent service provider.
                    It supplements the general Terms of Service framework of {COMPANY}.
                  </p>
                </div>
                <p className="text-muted-foreground">
                  Please read these Driver Terms carefully before creating a driver account or accepting a delivery on the SwiftDash platform.
                  By registering as a driver, you acknowledge that you have read, understood, and agreed to be bound by these terms,
                  our <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>, and any additional policies referenced herein.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">1. Definitions</h2>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li><strong className="text-foreground">"Driver"</strong> — an individual who has registered and been verified on the SwiftDash platform to accept and complete delivery assignments</li>
                  <li><strong className="text-foreground">"App"</strong> — the SwiftDash Driver mobile application available on iOS and Android</li>
                  <li><strong className="text-foreground">"Delivery"</strong> — a logistics task assigned through the Platform involving the pickup, transport, and drop-off of a package</li>
                  <li><strong className="text-foreground">"Business"</strong> — the company or individual that created and owns the delivery assignment</li>
                  <li><strong className="text-foreground">"Earnings"</strong> — the driver's share of the delivery fee after SwiftDash's platform commission is deducted</li>
                  <li><strong className="text-foreground">"Proof of Delivery (POD)"</strong> — a photo and/or digital confirmation captured at the time of successful delivery</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">2. Independent Contractor Relationship</h2>
                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm text-muted-foreground mb-4">
                  <strong className="text-foreground">You are not an employee of SwiftDash.</strong> You are an independent contractor.
                </div>
                <p className="text-muted-foreground">
                  SwiftDash provides a technology platform that connects businesses with delivery drivers. Nothing in these Terms
                  shall be construed to create an employer-employee, partnership, joint venture, or agency relationship between
                  SwiftDash and any driver.
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-3">
                  <li>You are free to set your own schedule and accept or decline deliveries at your discretion</li>
                  <li>You are responsible for all taxes, contributions to SSS/PhilHealth/Pag-IBIG, and other obligations applicable to self-employed individuals under Philippine law</li>
                  <li>You are responsible for your own vehicle insurance, maintenance, and operating costs</li>
                  <li>SwiftDash does not provide employee benefits, including health insurance, leave, or retirement plans</li>
                  <li>SwiftDash does not control your manner of work — only the end result (delivery completion)</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">3. Eligibility & Requirements</h2>
                <p className="text-muted-foreground mb-3">To register and remain active as a driver, you must:</p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>Be at least <strong className="text-foreground">18 years of age</strong></li>
                  <li>Hold a <strong className="text-foreground">valid Philippine driver's license</strong> appropriate for your vehicle type</li>
                  <li>Own or have lawful use of a registered, roadworthy vehicle with valid OR/CR</li>
                  <li>Have a valid Philippine mobile number capable of receiving SMS and using mobile data</li>
                  <li>Provide a valid bank account or registered e-wallet (GCash or Maya) for earnings payouts</li>
                  <li>Submit to SwiftDash's identity and document verification process and maintain accurate records</li>
                  <li>Not be subject to any court order or legal prohibition that prevents you from operating as a delivery driver</li>
                </ul>
                <p className="text-muted-foreground mt-3">
                  SwiftDash reserves the right to reject, suspend, or revoke driver registration at its sole discretion if these
                  requirements are not met or are found to be falsified.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">4. Onboarding & Verification</h2>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>New drivers must complete the in-app onboarding process, including uploading valid government-issued ID, driver's license, and vehicle OR/CR</li>
                  <li>SwiftDash will review submissions within <strong className="text-foreground">2–5 business days</strong>; you will be notified of approval or rejection via the App and email</li>
                  <li>You must keep your documents current and notify SwiftDash immediately if your license, registration, or vehicle insurance lapses</li>
                  <li>Operating deliveries with expired or invalid documents is strictly prohibited and may result in immediate deactivation</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">5. Accepting & Completing Deliveries</h2>
                <h3 className="text-base font-semibold mt-5 mb-2">5.1 Job Assignment</h3>
                <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                  <li>Deliveries are assigned to available drivers based on proximity, vehicle type, and availability</li>
                  <li>You may accept or decline a job; declining too many assigned jobs may affect your priority in future dispatch queues</li>
                  <li>Once you accept a delivery, you are expected to complete it barring genuine emergency situations</li>
                </ul>

                <h3 className="text-base font-semibold mt-5 mb-2">5.2 Your Responsibilities</h3>
                <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                  <li>Arrive at the pickup location within the estimated time displayed in the App</li>
                  <li>Verify the package details before accepting it at pickup</li>
                  <li>Handle all packages with reasonable care; you are liable for damages resulting from negligence</li>
                  <li>Deliver to the correct address as shown in the App; do not alter the delivery address</li>
                  <li>Update delivery status in the App at each key milestone: accepted, at pickup, picked up, in transit, at destination, delivered</li>
                  <li>Capture a clear Proof-of-Delivery (POD) photo upon successful delivery</li>
                  <li>If the recipient is absent, follow the failed delivery procedure in the App and do not leave the package unattended unless explicitly authorized</li>
                </ul>

                <h3 className="text-base font-semibold mt-5 mb-2">5.3 Cancellation by Driver</h3>
                <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                  <li>Cancelling a delivery after pickup is only permitted in documented emergency situations (e.g., accident, medical emergency)</li>
                  <li>Frequent or unjustified cancellations may result in account suspension</li>
                  <li>If you cannot complete a delivery, contact SwiftDash support immediately for reassignment</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">6. Prohibited Conduct</h2>
                <p className="text-muted-foreground mb-2">You must not:</p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>Open, tamper with, or damage packages in your possession</li>
                  <li>Accept cash-on-delivery payments and fail to remit them to the business</li>
                  <li>Use GPS spoofing or any method to falsify your location data</li>
                  <li>Share your account credentials or allow another person to operate under your account</li>
                  <li>Engage in harassment, threatening behavior, or any unprofessional conduct toward customers, businesses, or SwiftDash staff</li>
                  <li>Transport illegal, prohibited, hazardous, or contraband items</li>
                  <li>Operate the App while impaired by alcohol, drugs, or medication that affects your ability to drive safely</li>
                  <li>Solicit business directly from SwiftDash customers outside of the Platform</li>
                  <li>Misrepresent a failed delivery as completed to fraudulently claim payment</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">7. Earnings & Payments</h2>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>Your earnings per delivery are calculated as the delivery fee minus SwiftDash's platform commission; the commission rate is displayed in your driver dashboard</li>
                  <li>Earnings are accumulated in your in-app wallet and disbursed to your nominated bank account or e-wallet on the scheduled payout cycle (typically weekly)</li>
                  <li>SwiftDash may withhold payment for deliveries under investigation for fraud, tampering, or policy violations</li>
                  <li>You are solely responsible for declaring your income and fulfilling all applicable Philippine tax obligations</li>
                  <li>SwiftDash reserves the right to adjust commission rates with at least <strong className="text-foreground">14 days' notice</strong>; continued use of the App after the notice period constitutes acceptance of the new rate</li>
                  <li>Disputes regarding earnings must be raised within <strong className="text-foreground">7 days</strong> of the payout date via in-app support</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">8. Ratings & Performance</h2>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>After each delivery, the business may rate your service on a 1–5 star scale</li>
                  <li>Your aggregate rating is visible to businesses when reviewing available drivers for dispatch</li>
                  <li>SwiftDash may set minimum rating thresholds; drivers who consistently fall below the threshold may be temporarily suspended or offered improvement guidance</li>
                  <li>You may dispute a rating you believe was made in bad faith by contacting SwiftDash support within 48 hours</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">9. Account Suspension & Deactivation</h2>
                <p className="text-muted-foreground mb-3">SwiftDash may suspend or permanently deactivate your driver account for:</p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>Violation of any provision of these Terms</li>
                  <li>Confirmed fraud, theft, or tampering with packages</li>
                  <li>GPS spoofing or other technological abuse</li>
                  <li>Repeated customer complaints substantiated upon investigation</li>
                  <li>Operating with expired or revoked license/vehicle registration</li>
                  <li>Harassment or threatening behavior toward customers or staff</li>
                  <li>Prolonged inactivity (no deliveries completed in 90 days)</li>
                </ul>
                <p className="text-muted-foreground mt-3">
                  For non-emergency suspensions, we will provide written notice and an opportunity to respond before permanent deactivation.
                  For serious violations (fraud, harassment, criminal conduct), suspension may be immediate and without prior notice.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">10. Liability & Insurance</h2>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>You are responsible for maintaining valid vehicle insurance as required by Philippine law (at minimum, Compulsory Third Party Liability / CTPL)</li>
                  <li>SwiftDash is not liable for accidents, injuries, property damage, or loss of life arising from your operation of a vehicle</li>
                  <li>In the event of package loss or damage due to your negligence, you may be held liable for reimbursement up to the declared package value</li>
                  <li>SwiftDash's aggregate liability to you for any claim under these Terms shall not exceed the earnings disbursed to you in the 30 days preceding the claim</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">11. Intellectual Property</h2>
                <p className="text-muted-foreground">
                  The SwiftDash Driver App, including its design, code, and content, is owned exclusively by {COMPANY}.
                  You are granted a limited, non-exclusive, non-transferable license to install and use the App solely for
                  the purpose of completing deliveries on the Platform. You may not copy, modify, reverse-engineer, or
                  distribute the App or any part of it.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">12. Disclaimer of Warranties</h2>
                <p className="text-muted-foreground">
                  THE APP IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND. SWIFTDASH DOES NOT GUARANTEE THAT THE APP WILL
                  BE ERROR-FREE, UNINTERRUPTED, OR ALWAYS AVAILABLE. GPS ROUTING AND ESTIMATED ARRIVAL TIMES ARE PROVIDED
                  FOR GUIDANCE ONLY AND SHOULD NOT BE THE SOLE BASIS FOR NAVIGATION DECISIONS.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">13. Changes to These Terms</h2>
                <p className="text-muted-foreground">
                  We may update these Driver Terms at any time. Material changes will be communicated via push notification
                  and/or email at least <strong className="text-foreground">14 days</strong> before they take effect.
                  Continued use of the App after changes take effect constitutes your acceptance of the revised Terms.
                  If you do not agree to the changes, you must stop using the App and contact us to close your account.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">14. Governing Law & Disputes</h2>
                <p className="text-muted-foreground">
                  These Driver Terms shall be governed by the laws of the Republic of the Philippines. Any disputes
                  arising from these Terms shall be subject to the exclusive jurisdiction of the courts of Makati City,
                  Metro Manila, Philippines.
                </p>
                <p className="text-muted-foreground mt-3">
                  The parties agree to first attempt to resolve any dispute through good-faith negotiation for a period of
                  30 days before initiating formal legal proceedings.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">15. Contact Us</h2>
                <p className="text-muted-foreground">For questions about these Driver Terms or your account:</p>
                <div className="mt-4 p-5 rounded-xl border border-border bg-muted/40 space-y-1 text-sm">
                  <p className="font-semibold text-foreground">{COMPANY}</p>
                  <p className="text-muted-foreground">Driver Support — Legal Department</p>
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
            <Link href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="text-primary font-medium">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
