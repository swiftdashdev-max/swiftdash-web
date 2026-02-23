'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ChevronRight,
  Feather,
  Search,
  Package,
  MapPin,
  Clock,
  ArrowRight,
  CheckCircle2,
  Truck,
} from 'lucide-react';
import { Reveal, SlideIn, ScaleIn } from '@/components/animations';
import { ThemeToggle } from '@/components/theme-toggle';
import { HoleBackground } from '@/components/animate-ui/components/backgrounds/hole';
import { motion, AnimatePresence } from 'framer-motion';

export default function TrackPage() {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [error, setError] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input on mount
  useEffect(() => {
    const timeout = setTimeout(() => {
      inputRef.current?.focus();
    }, 800); // Delay to let animations play
    return () => clearTimeout(timeout);
  }, []);

  // Normalize tracking number: handle missing dashes, case, spaces
  const normalizeTrackingNumber = (raw: string): string | null => {
    // Remove all spaces and convert to uppercase for pattern matching
    let cleaned = raw.replace(/\s+/g, '').trim();
    
    // If they forgot the "SD" prefix entirely — e.g. "20260223-d11e1498"
    if (/^\d{8}[-]?[a-f0-9]{6,}$/i.test(cleaned)) {
      cleaned = 'SD-' + cleaned;
    }

    // If they typed "SD" without dashes — e.g. "SD20260223d11e1498"
    const noDashMatch = cleaned.match(/^SD(\d{8})([a-f0-9]{6,})(-(\d{1,2}))?$/i);
    if (noDashMatch) {
      const base = `SD-${noDashMatch[1]}-${noDashMatch[2]}`;
      const stopSuffix = noDashMatch[3] || '';
      return base.toLowerCase().replace(/^sd-/, 'SD-') + stopSuffix;
    }

    // If they typed partial dashes — e.g. "SD-20260223d11e1498" or "SD20260223-d11e1498"
    const partialDash = cleaned.match(/^SD-?(\d{8})-?([a-f0-9]{6,})(-(\d{1,2}))?$/i);
    if (partialDash) {
      const base = `SD-${partialDash[1]}-${partialDash[2]}`;
      const stopSuffix = partialDash[3] || '';
      // Keep SD- uppercase, rest lowercase to match DB format
      return base.toLowerCase().replace(/^sd-/, 'SD-') + stopSuffix;
    }

    // Already properly formatted — normalize case (SD- uppercase, hash lowercase)
    const properMatch = cleaned.match(/^SD-(\d{8})-([a-f0-9]{6,})(-(\d{1,2}))?$/i);
    if (properMatch) {
      const base = `SD-${properMatch[1]}-${properMatch[2].toLowerCase()}`;
      const stopSuffix = properMatch[3] || '';
      return base + stopSuffix;
    }

    return null; // Could not parse
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const value = trackingNumber.trim();

    if (!value) {
      setError('Please enter a tracking number.');
      return;
    }

    // Check if it starts with SD (with or without dash)
    if (!/^SD/i.test(value.replace(/\s+/g, ''))) {
      setError('Tracking numbers start with "SD-". Please check and try again.');
      return;
    }

    // Try to normalize
    const normalized = normalizeTrackingNumber(value);
    if (!normalized) {
      setError('Invalid tracking number format. Expected: SD-YYYYMMDD-XXXXXXXX');
      return;
    }

    setIsSearching(true);
    // Small delay for visual feedback
    setTimeout(() => {
      router.push(`/track/${encodeURIComponent(normalized)}`);
    }, 400);
  };

  const trackingSteps = [
    {
      icon: Package,
      title: 'Enter Your Code',
      description: 'Type or paste your SwiftDash tracking number',
    },
    {
      icon: MapPin,
      title: 'See Live Location',
      description: 'View your driver\'s real-time position on the map',
    },
    {
      icon: Clock,
      title: 'Track Every Step',
      description: 'Follow the full journey from pickup to delivery',
    },
  ];

  return (
    <div className="min-h-screen bg-background font-sans antialiased selection:bg-primary/20">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <Image
                src="/assets/images/swiftdash_logo.png"
                alt="SwiftDash Logo"
                width={40}
                height={40}
                className="relative transition-transform duration-300 group-hover:scale-110"
              />
            </div>
            <span className="text-2xl font-bold text-foreground tracking-tight">SwiftDash</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <Link href="/#features" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Features
            </Link>
            <Link href="/#map" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Coverage
            </Link>
            <Link href="/pricing" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Pricing
            </Link>
            <Link href="/track" className="text-sm font-medium text-primary transition-colors">
              Track Delivery
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Button asChild variant="ghost" className="hidden md:flex font-medium">
              <Link href="/login">Login</Link>
            </Button>
            <Button asChild className="hidden md:flex shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all duration-300">
              <Link href="/business/signup">
                Get Started
                <ChevronRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <Feather className="h-6 w-6" />
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-background/95 backdrop-blur-xl border-b border-border/40 py-4 animate-in slide-in-from-top-5">
            <nav className="container mx-auto px-6 flex flex-col gap-4">
              <Link href="/#features" className="text-muted-foreground hover:text-foreground py-2" onClick={() => setIsMenuOpen(false)}>
                Features
              </Link>
              <Link href="/pricing" className="text-muted-foreground hover:text-foreground py-2" onClick={() => setIsMenuOpen(false)}>
                Pricing
              </Link>
              <Link href="/track" className="text-primary font-medium py-2" onClick={() => setIsMenuOpen(false)}>
                Track Delivery
              </Link>
              <Link href="/login" className="text-muted-foreground hover:text-foreground py-2" onClick={() => setIsMenuOpen(false)}>
                Login
              </Link>
            </nav>
          </div>
        )}
      </header>

      <main className="pt-20 relative overflow-hidden">
        {/* Hero / Search Section */}
        <section className="relative min-h-[calc(100vh-5rem)] flex items-center justify-center overflow-hidden">
          <HoleBackground className="absolute inset-0 opacity-50 pointer-events-none" />

          <div className="container mx-auto px-6 relative z-10 py-20">
            <div className="max-w-2xl mx-auto text-center">
              <Reveal>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8 border border-primary/20 backdrop-blur-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                  Real-Time Tracking
                </div>
              </Reveal>

              <Reveal>
                <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight leading-tight">
                  Track Your{' '}
                  <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
                    Delivery
                  </span>
                </h1>
              </Reveal>

              <Reveal>
                <p className="text-lg md:text-xl text-muted-foreground mb-12 leading-relaxed">
                  Enter your tracking number to see your delivery&apos;s live location, status updates, and estimated arrival time.
                </p>
              </Reveal>

              {/* Search Form */}
              <Reveal>
                <form onSubmit={handleSubmit} className="relative max-w-xl mx-auto">
                  <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary/30 via-blue-400/30 to-primary/30 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-500" />
                    <div className="relative flex items-center bg-background border border-border/60 rounded-xl shadow-xl shadow-black/5 dark:shadow-black/20 overflow-hidden focus-within:border-primary/50 transition-colors duration-300">
                      <div className="pl-5 text-muted-foreground">
                        <Search className="h-5 w-5" />
                      </div>
                      <Input
                        ref={inputRef}
                        type="text"
                        placeholder="SD-20250101-XXXXXXXX"
                        value={trackingNumber}
                        onChange={(e) => {
                          setTrackingNumber(e.target.value);
                          setError('');
                        }}
                        className="flex-1 h-16 text-lg border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/40 px-4"
                      />
                      <div className="pr-3">
                        <Button
                          type="submit"
                          disabled={isSearching}
                          className="h-11 px-6 rounded-lg shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all duration-300 font-medium"
                        >
                          {isSearching ? (
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            >
                              <Truck className="h-5 w-5" />
                            </motion.div>
                          ) : (
                            <>
                              Track
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Error Message */}
                  <AnimatePresence>
                    {error && (
                      <motion.p
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="text-sm text-red-500 mt-3 text-center"
                      >
                        {error}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <p className="text-xs text-muted-foreground/60 mt-4">
                    Your tracking number was sent to you via SMS or email when your delivery was booked.
                  </p>
                </form>
              </Reveal>
            </div>
          </div>
        </section>

        {/* How Tracking Works */}
        <section className="py-24 sm:py-32 relative">
          <div className="container mx-auto px-6">
            <Reveal>
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                  How It Works
                </h2>
                <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                  Stay informed every step of the way with real-time delivery tracking.
                </p>
              </div>
            </Reveal>

            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto relative">
              {/* Connecting line */}
              <div className="hidden md:block absolute top-16 left-[20%] right-[20%] h-px bg-gradient-to-r from-transparent via-border to-transparent" />

              {trackingSteps.map((step, i) => (
                <ScaleIn key={i}>
                  <div className="relative text-center group">
                    <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors duration-300 relative">
                      <step.icon className="h-7 w-7 text-primary" />
                      <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shadow-lg shadow-primary/30">
                        {i + 1}
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                  </div>
                </ScaleIn>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24 sm:py-32 bg-muted/30 relative">
          <div className="container mx-auto px-6">
            <Reveal>
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                  What You&apos;ll See
                </h2>
                <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                  Our tracking page gives you full visibility into your delivery.
                </p>
              </div>
            </Reveal>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
              {[
                {
                  icon: MapPin,
                  title: 'Live Map',
                  description: 'See your driver\'s exact location on an interactive map in real time.',
                },
                {
                  icon: Clock,
                  title: 'Status Timeline',
                  description: 'Follow each milestone — from pickup to in-transit to delivered.',
                },
                {
                  icon: Truck,
                  title: 'Multi-Stop Progress',
                  description: 'Track multiple drop-offs with per-stop status and completion badges.',
                },
                {
                  icon: CheckCircle2,
                  title: 'Delivery Confirmation',
                  description: 'Get instant confirmation with proof of delivery when it arrives.',
                },
              ].map((feature, i) => (
                <ScaleIn key={i}>
                  <div className="bg-background rounded-2xl p-6 shadow-sm hover:shadow-lg border border-transparent hover:border-primary/20 transition-all duration-300 h-full">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                  </div>
                </ScaleIn>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 sm:py-32 relative">
          <div className="container mx-auto px-6">
            <Reveal>
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-blue-400 p-12 md:p-16 text-center">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent)] pointer-events-none" />
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 relative">
                  Need to Send a Delivery?
                </h2>
                <p className="text-white/80 text-lg mb-8 max-w-xl mx-auto relative">
                  SwiftDash makes it easy for businesses to manage, dispatch, and track deliveries — all in one platform.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center relative">
                  <Button asChild size="lg" variant="secondary" className="font-semibold shadow-xl">
                    <Link href="/pricing">
                      View Pricing
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="font-semibold bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white">
                    <Link href="/business/signup">
                      Get Started Free
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-background border-t border-border/40 py-16">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
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
              <p className="text-sm text-muted-foreground leading-relaxed">
                On-demand delivery platform for the Philippines. Fast, reliable, trackable.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">Product</h4>
              <ul className="space-y-3">
                <li><Link href="/#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</Link></li>
                <li><Link href="/#map" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Coverage</Link></li>
                <li><Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</Link></li>
                <li><Link href="/track" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Track Delivery</Link></li>
                <li><Link href="/business/signup" className="text-sm text-muted-foreground hover:text-foreground transition-colors">For Business</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">Company</h4>
              <ul className="space-y-3">
                <li><Link href="/#about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">About</Link></li>
                <li><Link href="/#contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">Legal & Support</h4>
              <ul className="space-y-3">
                <li><Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Terms of Service</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border/40 mt-12 pt-8 text-center text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} SwiftDash. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
