'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ArrowRight, ChevronRight, Feather, Zap, Map, Clock, Briefcase, Globe, Mail } from 'lucide-react';
import { Reveal, SlideIn, ScaleIn } from '@/components/animations';
import { ThemeToggle } from '@/components/theme-toggle';
import { HoleBackground } from '@/components/animate-ui/components/backgrounds/hole';
import { useState } from 'react';

const features = [
  {
    icon: <Map className="h-8 w-8 text-primary" />,
    title: 'Real-time Tracking',
    description: 'Monitor your deliveries with live GPS tracking from start to finish.',
  },
  {
    icon: <Zap className="h-8 w-8 text-primary" />,
    title: 'Multi-stop Delivery',
    description: 'Optimize your logistics by booking multiple drop-offs in a single order.',
  },
  {
    icon: <Clock className="h-8 w-8 text-primary" />,
    title: 'Scheduled Booking',
    description: 'Plan ahead and schedule your deliveries for a specific date and time.',
  },
  {
    icon: <Briefcase className="h-8 w-8 text-primary" />,
    title: 'Business Fleet Management',
    description: 'Manage your entire fleet, drivers, and operations from one powerful dashboard.',
  },
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
            <Link href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
              Features
            </Link>
            <Link href="#map" className="text-muted-foreground hover:text-foreground transition-colors">
              Coverage
            </Link>
            <Link href="#contact" className="text-muted-foreground hover:text-foreground transition-colors">
              Contact
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
                Get Started
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
              <Link href="#features" className="text-muted-foreground hover:text-foreground transition-colors py-2" onClick={() => setIsMenuOpen(false)}>
                Features
              </Link>
              <Link href="#map" className="text-muted-foreground hover:text-foreground transition-colors py-2" onClick={() => setIsMenuOpen(false)}>
                Coverage
              </Link>
              <Link href="#contact" className="text-muted-foreground hover:text-foreground transition-colors py-2" onClick={() => setIsMenuOpen(false)}>
                Contact
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
                <Link href="/business/signup">Get Started</Link>
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
              <h1 className="text-5xl md:text-7xl font-bold tracking-tighter leading-tight text-foreground">
                On-Demand Delivery
                <br />
                <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
                  for the Philippines.
                </span>
              </h1>
            </Reveal>
            <Reveal delay={0.4}>
              <p className="mt-6 max-w-2xl mx-auto text-lg md:text-xl text-muted-foreground">
                Your reliable partner for fast, secure, and affordable deliveries nationwide.
                Download the app and get started today.
              </p>
            </Reveal>
            <Reveal delay={0.6}>
              <div className="mt-10 flex flex-col sm:flex-row justify-center items-center gap-4">
                <Link href="#" className="inline-block transition-transform hover:scale-105">
                  <Image 
                    src="/assets/images/app-store.svg" 
                    alt="Download on the App Store" 
                    width={160} 
                    height={54} 
                    className="h-14 w-auto"
                  />
                </Link>
                <Link href="#" className="inline-block transition-transform hover:scale-105">
                  <Image 
                    src="/assets/images/play-store.svg" 
                    alt="Get it on Google Play" 
                    width={180} 
                    height={54} 
                    className="h-14 w-auto"
                  />
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        {/* App Mockup Section */}
        <section id="mockups" className="py-24 sm:py-32 bg-gradient-to-b from-background to-secondary/20">
            <div className="container mx-auto px-6">
                <div className="text-center mb-16">
                    <Reveal>
                        <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-foreground">
                            Experience SwiftDash
                        </h2>
                    </Reveal>
                    <Reveal delay={0.3}>
                        <p className="mt-4 text-lg text-muted-foreground">
                            Seamless delivery management at your fingertips
                        </p>
                    </Reveal>
                </div>
                <div className="flex justify-center items-center gap-6 lg:gap-8 max-w-5xl mx-auto">
                    {/* Left - Home Screen */}
                    <ScaleIn delay={0.2}>
                        <div className="relative w-[780px] lg:w-[750px]">
                            <Image 
                                src="/assets/images/app-home.png" 
                                alt="SwiftDash Home Screen - Track Live, Quick Actions including Request Delivery, Track Order, My Addresses, and Order History" 
                                width={1000}
                                height={2000}
                                className="w-full h-auto drop-shadow-2xl"
                                priority
                            />
                        </div>
                    </ScaleIn>

                    {/* Right - Tracking Screen */}
                    <ScaleIn delay={0.4}>
                        <div className="relative w-[780px] lg:w-[750px]">
                            <Image 
                                src="/assets/images/app-order.png" 
                                alt="SwiftDash Order Summary - Detailed view of Light Truck delivery with pickup/delivery locations and price breakdown (₱806.40)" 
                                width={1000}
                                height={2000}
                                className="w-full h-auto drop-shadow-2xl"
                                priority
                            />
                        </div>
                    </ScaleIn>
                </div>
            </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 sm:py-32 bg-secondary/50">
          <div className="container mx-auto px-6">
            <div className="text-center max-w-3xl mx-auto">
              <Reveal>
                <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-foreground">
                  Everything You Need for Seamless Deliveries
                </h2>
              </Reveal>
              <Reveal delay={0.3}>
                <p className="mt-4 text-lg text-muted-foreground">
                  A powerful suite of tools designed for individuals and businesses.
                </p>
              </Reveal>
            </div>
            <div className="mt-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {features.map((feature, index) => (
                <ScaleIn key={feature.title} delay={0.2 * (index + 1)}>
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

        {/* Driver CTA Section */}
        <section className="py-24 sm:py-32">
          <div className="container mx-auto px-6">
            <div className="bg-gradient-to-r from-primary to-blue-400 rounded-3xl p-12 md:p-16 text-center">
              <Reveal>
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                  Already a SwiftDash Driver?
                </h2>
              </Reveal>
              <Reveal delay={0.3}>
                <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
                  Complete your verification process and upload your required documents to start earning with SwiftDash
                </p>
              </Reveal>
              <Reveal delay={0.5}>
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                  <Button asChild size="lg" variant="secondary" className="w-full sm:w-auto">
                    <Link href="/driver-login">
                      Complete Verification
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="w-full sm:w-auto bg-white/10 border-white/20 text-white hover:bg-white/20">
                    <Link href="/driver-login">
                      Driver Login
                    </Link>
                  </Button>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Service Coverage Map Section */}
        <section id="map" className="py-24 sm:py-32">
            <div className="container mx-auto px-6">
                <div className="text-center max-w-3xl mx-auto">
                    <Reveal>
                        <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-foreground">
                        Serving You Nationwide
                        </h2>
                    </Reveal>
                    <Reveal delay={0.3}>
                        <p className="mt-4 text-lg text-muted-foreground">
                        Our network is rapidly expanding. Check out our service coverage across the Philippines.
                        </p>
                    </Reveal>
                </div>
                <div className="mt-16 relative h-96 lg:h-[600px] rounded-2xl bg-secondary/50 flex items-center justify-center">
                    <p className="text-muted-foreground">Service Coverage Map Placeholder</p>
                    <Globe className="h-32 w-32 text-primary/20 absolute" />
                </div>
            </div>
        </section>

        {/* About and Contact Section */}
        <section id="contact" className="py-24 sm:py-32 bg-secondary/50">
          <div className="container mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-16 items-start">
                <SlideIn>
                    <div>
                        <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-foreground">
                            About SwiftDash
                        </h2>
                        <p className="mt-6 text-lg text-muted-foreground">
                            SwiftDash was born from a simple idea: to make deliveries in the Philippines faster, safer, and more efficient for everyone. We are a team of passionate innovators dedicated to solving logistical challenges with technology. Our mission is to empower businesses and connect communities, one delivery at a time.
                        </p>
                    </div>
                </SlideIn>
                <SlideIn delay={0.2}>
                    <div className="p-8 bg-background rounded-2xl shadow-sm border">
                         <h3 className="text-2xl font-semibold text-foreground mb-6">
                            Get in Touch
                        </h3>
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
                On-demand delivery for the Philippines.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Product</h4>
              <ul className="space-y-3">
                <li><Link href="#features" className="text-muted-foreground hover:text-foreground transition-colors text-sm">Features</Link></li>
                <li><Link href="#map" className="text-muted-foreground hover:text-foreground transition-colors text-sm">Coverage</Link></li>
                <li><Link href="/business/signup" className="text-muted-foreground hover:text-foreground transition-colors text-sm">For Business</Link></li>
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
            {/* Social links can go here */}
          </div>
        </div>
      </footer>
    </div>
  );
}