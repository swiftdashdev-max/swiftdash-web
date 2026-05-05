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
  Phone,
} from 'lucide-react';
import { Reveal, SlideIn, ScaleIn } from '@/components/animations';
import { ThemeToggle } from '@/components/theme-toggle';
import { HoleBackground } from '@/components/animate-ui/components/backgrounds/hole';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';

const ROOT_DOMAIN = 'swiftdashdms.com';

interface BusinessBranding {
  id: string;
  business_name: string;
  business_phone: string | null;
  slug: string;
  settings: {
    logo_url?: string;
    primary_color?: string;
    tagline?: string;
    favicon_url?: string;
    logo_bg_transparent?: boolean;
    logo_size?: 'sm' | 'md' | 'lg' | 'xl';
    tracking_headline?: string;
    tracking_subtext?: string;
    hide_powered_by?: boolean;
  };
}

export default function TrackPage() {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [error, setError] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [branding, setBranding] = useState<BusinessBranding | null>(null);
  const [brandingLoaded, setBrandingLoaded] = useState(false);
  const supabase = createClient();

  // Detect subdomain or custom tracking domain and fetch business branding
  useEffect(() => {
    async function detectBranding() {
      try {
        const hostname = window.location.hostname;

        // Check for subdomain (e.g., welinc.swiftdashdms.com or welinc.localhost)
        let slug: string | null = null;
        if (hostname.endsWith(`.${ROOT_DOMAIN}`)) {
          const sub = hostname.replace(`.${ROOT_DOMAIN}`, '');
          if (sub && !['www', 'app', 'api', 'admin', 'staging', 'dev'].includes(sub)) {
            slug = sub;
          }
        } else if (hostname.endsWith('.localhost')) {
          const sub = hostname.replace('.localhost', '');
          if (sub && !['www', 'app', 'api', 'admin'].includes(sub)) {
            slug = sub;
          }
        }

        if (slug) {
          // Fetch by slug
          const { data } = await supabase
            .from('business_accounts')
            .select('id, business_name, business_phone, slug, settings')
            .eq('slug', slug)
            .eq('storefront_enabled', true)
            .single();
          if (data) setBranding(data as BusinessBranding);
        } else if (
          hostname !== 'localhost' &&
          !hostname.endsWith('.localhost') &&
          hostname !== ROOT_DOMAIN &&
          !hostname.endsWith(`.${ROOT_DOMAIN}`) &&
          !hostname.endsWith('.vercel.app') &&
          hostname.includes('.')
        ) {
          // Custom tracking domain — resolve by tracking_domain column
          const { data } = await supabase
            .from('business_accounts')
            .select('id, business_name, business_phone, slug, settings')
            .eq('tracking_domain', hostname)
            .eq('storefront_enabled', true)
            .single();
          if (data) setBranding(data as BusinessBranding);
        }
      } catch {
        // No branding — show default SwiftDash page
      }
      setBrandingLoaded(true);
    }
    detectBranding();
  }, []);

  // Dynamic page title and favicon for branded pages
  useEffect(() => {
    if (!branding) return;
    document.title = `Track Your Delivery | ${branding.business_name}`;
    if (branding.settings?.favicon_url) {
      let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      link.href = branding.settings.favicon_url;
    }
    return () => { document.title = 'Track Delivery | SwiftDash'; };
  }, [branding]);

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

  const handleSubmit = async (e: React.FormEvent) => {
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

    // On branded pages, validate the delivery belongs to this business
    if (branding) {
      try {
        // Parse out parent tracking number (strip stop suffix)
        const stopMatch = normalized.match(/^(.+)-(\d{1,2})$/);
        const parentTracking = stopMatch ? stopMatch[1] : normalized;

        const { data, error: fetchErr } = await supabase
          .from('deliveries')
          .select('business_id')
          .ilike('tracking_number', parentTracking)
          .maybeSingle();

        if (fetchErr || !data) {
          setError('We couldn\'t find a delivery with this tracking number. Please check and try again.');
          setIsSearching(false);
          return;
        }

        if (data.business_id !== branding.id) {
          setError(`This tracking number doesn't belong to ${branding.business_name}. Please check your tracking number.`);
          setIsSearching(false);
          return;
        }
      } catch {
        setError('Something went wrong. Please try again.');
        setIsSearching(false);
        return;
      }
    }

    // Small delay for visual feedback then navigate
    setTimeout(() => {
      router.push(`/track/${encodeURIComponent(normalized)}`);
    }, 300);
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

  const brandColor = branding?.settings?.primary_color || '#3b82f6';

  // Derive a darker shade for the hero gradient
  function hexToRgb(hex: string) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  }
  const rgb = brandColor.startsWith('#') && brandColor.length === 7 ? hexToRgb(brandColor) : { r: 59, g: 130, b: 246 };
  const darkHero = `rgba(${Math.round(rgb.r * 0.35)}, ${Math.round(rgb.g * 0.35)}, ${Math.round(rgb.b * 0.35)}, 1)`;
  const midHero  = `rgba(${Math.round(rgb.r * 0.55)}, ${Math.round(rgb.g * 0.55)}, ${Math.round(rgb.b * 0.55)}, 1)`;

  // ── Branded White-Label Tracking Page ─────────────────────────────────────
  if (branding) {
    const trackingHeadline = branding.settings?.tracking_headline || 'Track Your Delivery';
    const trackingSubtext  = branding.settings?.tracking_subtext  || 'Enter your tracking number to get live updates on your delivery.';
    const hidePoweredBy    = branding.settings?.hide_powered_by === true;
    const logoSizeClass    =
      branding.settings?.logo_size === 'sm' ? 'h-8 max-w-[100px]' :
      branding.settings?.logo_size === 'lg' ? 'h-16 max-w-[200px]' :
      branding.settings?.logo_size === 'xl' ? 'h-20 max-w-[240px]' :
      'h-12 max-w-[160px]'; // md default

    return (
      <div className="min-h-screen flex flex-col font-sans antialiased">

        {/* ── Full-bleed hero (top ~65% of viewport) ── */}
        <div
          className="relative flex flex-col"
          style={{
            background: `linear-gradient(145deg, ${darkHero} 0%, ${midHero} 50%, ${brandColor} 100%)`,
            minHeight: '65vh',
          }}
        >
          {/* Subtle texture overlay */}
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: `radial-gradient(circle at 20% 20%, rgba(255,255,255,0.06) 0%, transparent 60%),
                              radial-gradient(circle at 80% 80%, rgba(255,255,255,0.04) 0%, transparent 50%)`,
          }} />
          {/* Decorative blobs */}
          <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full opacity-[0.07] bg-white pointer-events-none" />
          <div className="absolute -bottom-10 -left-16 w-64 h-64 rounded-full opacity-[0.05] bg-white pointer-events-none" />

          {/* Header — transparent, sits on hero */}
          <header className="relative z-10 px-6 pt-6 pb-4">
            <div className="max-w-3xl mx-auto flex items-center justify-between">
              {/* Logo */}
              <div className="flex items-center gap-3">
                {branding.settings?.logo_url ? (
                  <div className={`flex-shrink-0 ${branding.settings?.logo_bg_transparent ? '' : 'bg-white/10 backdrop-blur rounded-xl p-2'}`}>
                    <img
                      src={branding.settings.logo_url}
                      alt={branding.business_name}
                      className="h-9 w-auto max-w-[140px] object-contain block"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                ) : (
                  <span className="text-white font-bold text-lg">{branding.business_name}</span>
                )}
              </div>
              {/* Phone pill */}
              {branding.business_phone && (
                <a
                  href={`tel:${branding.business_phone}`}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold text-white border border-white/25 bg-white/10 backdrop-blur hover:bg-white/20 transition-all"
                >
                  <Phone className="w-3 h-3" />
                  {branding.business_phone}
                </a>
              )}
            </div>
          </header>

          {/* Hero content */}
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 py-10">
            {/* Big logo in hero */}
            {branding.settings?.logo_url && (
              <div className={`mb-8 ${branding.settings?.logo_bg_transparent ? '' : 'bg-white/10 backdrop-blur-sm rounded-2xl p-4 shadow-xl shadow-black/20'}`}>
                <img
                  src={branding.settings.logo_url}
                  alt={branding.business_name}
                  className={`${logoSizeClass} w-auto object-contain block`}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            )}

            {/* Live badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-6 bg-white/15 backdrop-blur border border-white/20 text-white">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
              </span>
              Real-Time Tracking
            </div>

            {/* Headline */}
            <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight leading-tight mb-4 drop-shadow-sm">
              {trackingHeadline}
            </h1>

            {/* Business name / tagline */}
            <p className="text-white/70 text-base md:text-lg mb-2 font-medium">
              {branding.settings?.tagline || branding.business_name}
            </p>
            <p className="text-white/50 text-sm mb-12 max-w-md">
              {trackingSubtext}
            </p>

            {/* ── Glassmorphism Search Box ── */}
            <form onSubmit={handleSubmit} className="w-full max-w-lg">
              <div className="relative group">
                {/* Glow ring */}
                <div
                  className="absolute -inset-[2px] rounded-2xl opacity-0 group-focus-within:opacity-100 transition-all duration-500 blur-sm"
                  style={{ background: `linear-gradient(90deg, rgba(255,255,255,0.5), rgba(255,255,255,0.2), rgba(255,255,255,0.5))` }}
                />
                <div className="relative flex items-center bg-white/15 backdrop-blur-md border border-white/30 rounded-2xl overflow-hidden shadow-2xl shadow-black/30 focus-within:bg-white/20 transition-all duration-300">
                  <div className="pl-5 text-white/60">
                    <Search className="h-5 w-5" />
                  </div>
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="SD-20250101-XXXXXXXX"
                    value={trackingNumber}
                    onChange={(e) => { setTrackingNumber(e.target.value); setError(''); }}
                    className="flex-1 h-16 text-lg border-0 bg-transparent focus:outline-none focus:ring-0 text-white placeholder:text-white/40 px-4"
                  />
                  <div className="pr-3">
                    <button
                      type="submit"
                      disabled={isSearching}
                      className="h-11 px-6 rounded-xl font-semibold text-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-60 flex items-center gap-2 shadow-lg"
                      style={{
                        background: 'rgba(255,255,255,0.95)',
                        color: brandColor,
                        boxShadow: `0 4px 20px rgba(0,0,0,0.25)`,
                      }}
                    >
                      {isSearching ? (
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                          <Truck className="h-5 w-5" />
                        </motion.div>
                      ) : (
                        <>
                          Track
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Error Message */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="mt-3 px-4 py-2.5 rounded-xl bg-red-500/20 backdrop-blur border border-red-400/30 text-sm text-white text-center"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <p className="text-xs text-white/40 mt-4 text-center">
                Your tracking number was sent via SMS or email when your delivery was booked.
              </p>
            </form>
          </div>

          {/* Wave divider */}
          <div className="relative z-10 w-full overflow-hidden leading-none" style={{ height: 60 }}>
            <svg viewBox="0 0 1440 60" preserveAspectRatio="none" className="absolute bottom-0 w-full h-full">
              <path d="M0,40 C360,70 1080,10 1440,40 L1440,60 L0,60 Z" fill="white" />
            </svg>
          </div>
        </div>

        {/* ── White bottom section ── */}
        <div className="bg-white flex-1 flex flex-col">
          {/* How it works — 3 steps */}
          <div className="max-w-2xl mx-auto px-6 py-10 w-full">
            <div className="grid grid-cols-3 gap-6">
              {[
                { icon: Package,      label: 'Enter Code',      desc: 'Paste your tracking number above' },
                { icon: MapPin,       label: 'Live Location',   desc: 'See your driver on the map' },
                { icon: CheckCircle2, label: 'Track Every Step', desc: 'Follow from pickup to delivery' },
              ].map((step, i) => (
                <div key={i} className="text-center">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 relative"
                    style={{ backgroundColor: `${brandColor}12` }}
                  >
                    <step.icon className="h-5 w-5" style={{ color: brandColor }} />
                    <div
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center shadow"
                      style={{ backgroundColor: brandColor }}
                    >
                      {i + 1}
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-gray-800 mb-1">{step.label}</p>
                  <p className="text-xs text-gray-400 leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Footer */}
          {!hidePoweredBy && (
            <footer className="py-5 text-center text-xs text-gray-300 border-t border-gray-100">
              Powered by{' '}
              <Link href="https://swiftdashdms.com" className="font-semibold text-gray-400 hover:text-gray-600 transition-colors" target="_blank" rel="noopener noreferrer">
                SwiftDash
              </Link>
            </footer>
          )}
        </div>
      </div>
    );
  }


  // ── Default SwiftDash-branded Tracking Page ───────────────────────────────

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
