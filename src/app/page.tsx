'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { 
  ArrowRight, ChevronRight, Feather, Zap, Map, Clock, Briefcase, Globe, Mail, 
  CheckCircle2, BarChart3, Truck, Shield, Code2, Route, Eye, Box, 
  Building2, Layers, Radio, FileCheck
} from 'lucide-react';
import { Reveal, SlideIn, ScaleIn } from '@/components/animations';
import { ThemeToggle } from '@/components/theme-toggle';
import { HoleBackground } from '@/components/animate-ui/components/backgrounds/hole';
import { useState } from 'react';

const platformCapabilities = [
  {
    icon: <Route className="h-8 w-8 text-primary" />,
    title: 'Route Optimization',
    description: 'AI-powered route planning that reduces delivery time and fuel costs across your entire fleet.',
  },
  {
    icon: <Zap className="h-8 w-8 text-primary" />,
    title: 'Automated Dispatch',
    description: 'Smart driver-order matching that assigns deliveries based on proximity, capacity, and priority.',
  },
  {
    icon: <Eye className="h-8 w-8 text-primary" />,
    title: 'Real-time Visibility',
    description: 'End-to-end tracking with live ETAs, status updates, and branded tracking pages for your customers.',
  },
  {
    icon: <BarChart3 className="h-8 w-8 text-primary" />,
    title: 'Analytics & Reporting',
    description: 'Comprehensive dashboards with delivery KPIs, driver performance, and revenue insights.',
  },
  {
    icon: <FileCheck className="h-8 w-8 text-primary" />,
    title: 'Proof of Delivery',
    description: 'Digital signatures, photo capture, and timestamped confirmations for every drop-off.',
  },
  {
    icon: <Code2 className="h-8 w-8 text-primary" />,
    title: 'API & Integrations',
    description: 'RESTful APIs and webhooks to connect with your e-commerce, ERP, or WMS systems seamlessly.',
  },
];

const stats = [
  { value: '99.2%', label: 'On-time delivery rate' },
  { value: '40%', label: 'Reduction in delivery costs' },
  { value: '10K+', label: 'Deliveries managed daily' },
  { value: '< 30s', label: 'Average dispatch time' },
];

const enterpriseFeatures = [
  { icon: <Shield className="h-5 w-5" />, text: 'SOC 2 Compliant Infrastructure' },
  { icon: <Layers className="h-5 w-5" />, text: 'Multi-tenant Architecture' },
  { icon: <Globe className="h-5 w-5" />, text: 'White-label Tracking Portal' },
  { icon: <Radio className="h-5 w-5" />, text: 'Real-time Webhooks & Events' },
  { icon: <Building2 className="h-5 w-5" />, text: 'Dedicated Account Management' },
  { icon: <Box className="h-5 w-5" />, text: 'Custom SLA & Uptime Guarantees' },
];

export default function Home() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/assets/images/swiftdash_logo.png"
              alt="SwiftDash Logo"
              width={40}
              height={40}
              className="transition-transform duration-300 hover:scale-110"
            />
            <span className="text-2xl font-bold text-foreground">SwiftDash</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <Link href="#platform" className="text-muted-foreground hover:text-foreground transition-colors">
              Platform
            </Link>
            <Link href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
              Features
            </Link>
            <Link href="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </Link>
            <Link href="#contact" className="text-muted-foreground hover:text-foreground transition-colors">
              Contact
            </Link>
            <Link href="/track" className="text-muted-foreground hover:text-foreground transition-colors">
              Track Delivery
            </Link>
            <Link href="/driver-login" className="text-muted-foreground hover:text-foreground transition-colors">
              Driver Portal
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <ThemeToggle />
             <Button asChild variant="ghost" className="hidden md:flex">
                <Link href="/login">
                    Login
                </Link>
            </Button>
            <Button asChild variant="default" className="hidden md:flex group">
              <Link href="/business/signup">
                Start Free Trial
                <ChevronRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <Feather className="h-6 w-6" /> : <Feather className="h-6 w-6" />}
            </Button>
          </div>
        </div>
        {isMenuOpen && (
          <div className="md:hidden bg-background/95 py-4">
            <nav className="container mx-auto px-6 flex flex-col gap-4">
              <Link href="#platform" className="text-muted-foreground hover:text-foreground transition-colors py-2" onClick={() => setIsMenuOpen(false)}>
                Platform
              </Link>
              <Link href="#features" className="text-muted-foreground hover:text-foreground transition-colors py-2" onClick={() => setIsMenuOpen(false)}>
                Features
              </Link>
              <Link href="/pricing" className="text-muted-foreground hover:text-foreground transition-colors py-2" onClick={() => setIsMenuOpen(false)}>
                Pricing
              </Link>
              <Link href="#contact" className="text-muted-foreground hover:text-foreground transition-colors py-2" onClick={() => setIsMenuOpen(false)}>
                Contact
              </Link>
              <Link href="/track" className="text-muted-foreground hover:text-foreground transition-colors py-2" onClick={() => setIsMenuOpen(false)}>
                Track Delivery
              </Link>
              <Link href="/driver-login" className="text-muted-foreground hover:text-foreground transition-colors py-2" onClick={() => setIsMenuOpen(false)}>
                Driver Portal
              </Link>
              <Link href="/login" className="text-muted-foreground hover:text-foreground transition-colors py-2" onClick={() => setIsMenuOpen(false)}>
                Login
              </Link>
              <div className="flex items-center justify-between py-2">
                <span className="text-muted-foreground">Theme</span>
                <ThemeToggle />
              </div>
              <Button asChild variant="default" className="w-full mt-2">
                <Link href="/business/signup">Start Free Trial</Link>
              </Button>
            </nav>
          </div>
        )}
      </header>

      <main className="pt-20">
        {/* Hero Section */}
        <section className="relative h-[calc(100vh-5rem)] flex items-center justify-center text-center overflow-hidden">
          <HoleBackground className="absolute inset-0" />
          <div className="container mx-auto px-6 relative">
            <Reveal>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border bg-background/60 backdrop-blur-sm text-sm text-muted-foreground mb-8">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                Now available in the Philippines
              </div>
            </Reveal>
            <Reveal delay={0.2}>
              <h1 className="text-5xl md:text-7xl font-bold tracking-tighter leading-tight text-foreground">
                Delivery Management
                <br />
                <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
                  Platform for Scale.
                </span>
              </h1>
            </Reveal>
            <Reveal delay={0.4}>
              <p className="mt-6 max-w-2xl mx-auto text-lg md:text-xl text-muted-foreground">
                Orchestrate your entire last-mile delivery operation — from dispatch and route optimization 
                to real-time tracking and proof of delivery — all from one platform.
              </p>
            </Reveal>
            <Reveal delay={0.6}>
              <div className="mt-10 flex flex-col sm:flex-row justify-center items-center gap-4">
                <Button asChild size="lg" className="group text-base px-8">
                  <Link href="/business/signup">
                    Start Free Trial
                    <ArrowRight className="ml-2 h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="text-base px-8">
                  <Link href="#platform">
                    See How It Works
                  </Link>
                </Button>
              </div>
            </Reveal>
            {/* Social proof stats */}
            <Reveal delay={0.8}>
              <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto">
                {stats.map((stat, i) => (
                  <div key={i} className="text-center">
                    <div className="text-2xl md:text-3xl font-bold text-foreground">{stat.value}</div>
                    <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* Platform Capabilities Section */}
        <section id="platform" className="py-24 bg-background relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background" />
            <div className="container mx-auto px-6 relative z-10">
                <div className="text-center mb-20">
                    <Reveal>
                        <h2 className="text-4xl md:text-5xl font-bold tracking-tighter mb-6">
                            One platform, <span className="text-primary">complete control</span>
                        </h2>
                    </Reveal>
                    <Reveal delay={0.2}>
                        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                            From order intake to final delivery, manage every touchpoint of your logistics operation.
                        </p>
                    </Reveal>
                </div>

                <div className="grid md:grid-cols-4 gap-8 relative">
                    {/* Connecting Line (Desktop) */}
                    <div className="hidden md:block absolute top-12 left-[12%] right-[12%] h-0.5 bg-gradient-to-r from-transparent via-border to-transparent border-t-2 border-dashed border-muted-foreground/30" />

                    {[
                        {
                            step: "01",
                            title: "Ingest Orders",
                            desc: "Import orders via API, CSV upload, or manual entry. Integrate with your e-commerce or ERP system.",
                            icon: <Box className="w-7 h-7 text-primary" />
                        },
                        {
                            step: "02",
                            title: "Optimize & Dispatch",
                            desc: "Auto-assign drivers based on proximity, capacity, and delivery windows. Optimize routes in real-time.",
                            icon: <Route className="w-7 h-7 text-primary" />
                        },
                        {
                            step: "03",
                            title: "Track & Manage",
                            desc: "Monitor every delivery with live GPS, ETA updates, and exception management from your command center.",
                            icon: <Eye className="w-7 h-7 text-primary" />
                        },
                        {
                            step: "04",
                            title: "Confirm & Analyze",
                            desc: "Capture proof of delivery, measure performance, and surface insights to continuously improve.",
                            icon: <BarChart3 className="w-7 h-7 text-primary" />
                        }
                    ].map((item, i) => (
                        <ScaleIn key={i} delay={i * 0.15}>
                            <div className="relative flex flex-col items-center text-center group">
                                <div className="w-24 h-24 rounded-3xl bg-background border-2 border-border shadow-lg flex items-center justify-center mb-8 relative z-10 group-hover:border-primary/50 group-hover:shadow-primary/20 transition-all duration-500">
                                    <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                                        {item.step}
                                    </div>
                                    {item.icon}
                                </div>
                                <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                                <p className="text-muted-foreground leading-relaxed text-sm">
                                    {item.desc}
                                </p>
                            </div>
                        </ScaleIn>
                    ))}
                </div>
            </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 sm:py-32 bg-secondary/50">
          <div className="container mx-auto px-6">
            <div className="text-center max-w-3xl mx-auto">
              <Reveal>
                <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-foreground">
                  Everything You Need to Run Last-Mile at Scale
                </h2>
              </Reveal>
              <Reveal delay={0.3}>
                <p className="mt-4 text-lg text-muted-foreground">
                  A comprehensive delivery management suite built for operations teams, logistics providers, and growing businesses.
                </p>
              </Reveal>
            </div>
            <div className="mt-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {platformCapabilities.map((feature, index) => (
                <ScaleIn key={feature.title} delay={0.1 * (index + 1)}>
                  <div className="p-8 bg-background rounded-2xl shadow-sm hover:shadow-lg transition-shadow duration-300 border border-transparent hover:border-primary/20 h-full">
                    <div className="mb-4">{feature.icon}</div>
                    <h3 className="text-xl font-semibold text-foreground">{feature.title}</h3>
                    <p className="mt-2 text-muted-foreground">{feature.description}</p>
                  </div>
                </ScaleIn>
              ))}
            </div>
          </div>
        </section>

        {/* Built for Enterprise Section */}
        <section className="py-24 sm:py-32">
          <div className="container mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div>
                <Reveal>
                  <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-foreground">
                    Built for
                    <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent"> enterprise</span>-grade operations
                  </h2>
                </Reveal>
                <Reveal delay={0.2}>
                  <p className="mt-6 text-lg text-muted-foreground">
                    Whether you're managing 100 or 100,000 deliveries per day, SwiftDash scales with your business. 
                    Our platform is trusted by logistics providers, e-commerce brands, and enterprises across the Philippines.
                  </p>
                </Reveal>
                <Reveal delay={0.4}>
                  <div className="mt-8 flex gap-4">
                    <Button asChild size="lg" className="group">
                      <Link href="/business/signup">
                        Get Started
                        <ArrowRight className="ml-2 h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
                      </Link>
                    </Button>
                    <Button asChild size="lg" variant="outline">
                      <Link href="#contact">
                        Talk to Sales
                      </Link>
                    </Button>
                  </div>
                </Reveal>
              </div>
              <div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {enterpriseFeatures.map((item, i) => (
                    <ScaleIn key={i} delay={0.1 * (i + 1)}>
                      <div className="flex items-start gap-3 p-4 rounded-xl border bg-background hover:border-primary/30 transition-colors">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                          {item.icon}
                        </div>
                        <span className="text-sm font-medium text-foreground leading-snug mt-1.5">{item.text}</span>
                      </div>
                    </ScaleIn>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Banner */}
        <section className="py-24 sm:py-32 bg-secondary/50">
          <div className="container mx-auto px-6">
            <div className="bg-gradient-to-r from-primary to-blue-400 rounded-3xl p-12 md:p-16 text-center">
              <Reveal>
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                  Ready to transform your delivery operations?
                </h2>
              </Reveal>
              <Reveal delay={0.3}>
                <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
                  Join hundreds of businesses already using SwiftDash to optimize routes, 
                  automate dispatch, and delight their customers with real-time tracking.
                </p>
              </Reveal>
              <Reveal delay={0.5}>
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                  <Button asChild size="lg" variant="secondary" className="w-full sm:w-auto">
                    <Link href="/business/signup">
                      Start Free Trial
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="w-full sm:w-auto bg-white/10 border-white/20 text-white hover:bg-white/20">
                    <Link href="/pricing">
                      View Pricing
                    </Link>
                  </Button>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* About and Contact Section */}
        <section id="contact" className="py-24 sm:py-32">
          <div className="container mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-16 items-start">
                <SlideIn>
                    <div>
                        <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-foreground">
                            About SwiftDash
                        </h2>
                        <p className="mt-6 text-lg text-muted-foreground">
                            SwiftDash is a delivery management platform built to help businesses orchestrate, 
                            optimize, and scale their last-mile logistics operations. We empower operations teams 
                            with intelligent dispatch, real-time visibility, and data-driven insights — so they 
                            can deliver more with less.
                        </p>
                        <p className="mt-4 text-lg text-muted-foreground">
                            Headquartered in Makati, Philippines, we serve logistics providers, e-commerce brands, 
                            and enterprise operations teams who need a modern, reliable platform to manage their 
                            delivery fleet.
                        </p>
                    </div>
                </SlideIn>
                <SlideIn delay={0.2}>
                    <div className="p-8 bg-background rounded-2xl shadow-sm border">
                         <h3 className="text-2xl font-semibold text-foreground mb-6">
                            Get in Touch
                        </h3>
                        <p className="text-muted-foreground mb-6">
                          Want a personalized demo or have questions about integrating SwiftDash into your operations? Our team is ready to help.
                        </p>
                        <div className="space-y-4">
                            <div className="flex items-center">
                                <Mail className="h-5 w-5 mr-4 text-muted-foreground" />
                                <a href="mailto:info@swiftdash.ph" className="text-foreground hover:text-primary transition-colors">info@swiftdash.ph</a>
                            </div>
                            <div className="flex items-start">
                                <Globe className="h-5 w-5 mr-4 mt-1 text-muted-foreground flex-shrink-0" />
                                <span className="text-foreground">Level 40, PBCom Tower, Makati</span>
                            </div>
                        </div>
                        <div className="mt-8">
                          <Button asChild className="w-full group">
                            <Link href="mailto:info@swiftdash.ph">
                              Request a Demo
                              <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                            </Link>
                          </Button>
                        </div>
                    </div>
                </SlideIn>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-background border-t">
        <div className="container mx-auto px-6 py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="col-span-2 md:col-span-1">
              <Link href="/" className="flex items-center gap-3 mb-4">
                <Image
                  src="/assets/images/swiftdash_logo.png"
                  alt="SwiftDash Logo"
                  width={32}
                  height={32}
                />
                <span className="text-xl font-bold text-foreground">SwiftDash</span>
              </Link>
              <p className="text-muted-foreground text-sm">
                Delivery management platform for the Philippines.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Platform</h4>
              <ul className="space-y-3">
                <li><Link href="#platform" className="text-muted-foreground hover:text-foreground transition-colors text-sm">How It Works</Link></li>
                <li><Link href="#features" className="text-muted-foreground hover:text-foreground transition-colors text-sm">Features</Link></li>
                <li><Link href="/pricing" className="text-muted-foreground hover:text-foreground transition-colors text-sm">Pricing</Link></li>
                <li><Link href="/track" className="text-muted-foreground hover:text-foreground transition-colors text-sm">Track Delivery</Link></li>
                <li><Link href="/business/signup" className="text-muted-foreground hover:text-foreground transition-colors text-sm">Start Free Trial</Link></li>
                <li><Link href="/driver-login" className="text-muted-foreground hover:text-foreground transition-colors text-sm">Driver Portal</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Company</h4>
              <ul className="space-y-3">
                <li><Link href="#contact" className="text-muted-foreground hover:text-foreground transition-colors text-sm">About Us</Link></li>
                <li><Link href="#contact" className="text-muted-foreground hover:text-foreground transition-colors text-sm">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Legal & Support</h4>
              <ul className="space-y-3">
                <li><Link href="#" className="text-muted-foreground hover:text-foreground transition-colors text-sm">Terms of Service</Link></li>
                <li><Link href="#" className="text-muted-foreground hover:text-foreground transition-colors text-sm">Privacy Policy</Link></li>
                <li><Link href="#" className="text-muted-foreground hover:text-foreground transition-colors text-sm">Support Center</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-16 border-t pt-8 flex flex-col sm:flex-row justify-between items-center">
            <p className="text-muted-foreground text-sm">
              &copy; {new Date().getFullYear()} SwiftDash Philippines Inc. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}