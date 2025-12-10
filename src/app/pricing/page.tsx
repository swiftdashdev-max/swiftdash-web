'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { 
  ArrowRight, 
  CheckCircle2, 
  Mail, 
  Calendar, 
  FileText, 
  ChevronRight, 
  Feather,
  Truck,
  BarChart3,
  ShieldCheck,
  Zap,
  Globe,
  Smartphone
} from 'lucide-react';
import { Reveal, SlideIn, ScaleIn } from '@/components/animations';
import { ThemeToggle } from '@/components/theme-toggle';
import { useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { HoleBackground } from '@/components/animate-ui/components/backgrounds/hole';

export default function PricingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const faqs = [
    {
      question: "Is there a setup fee?",
      answer: "No, we don't charge any setup fees. You can get started with our demo and see if it fits your needs completely free of charge."
    },
    {
      question: "Do you offer volume discounts?",
      answer: "Yes! Our pricing is tailored to your volume. The more deliveries you manage, the better rates we can offer. Contact us for a custom quote."
    },
    {
      question: "Can I integrate SwiftDash with my existing system?",
      answer: "Absolutely. We provide a robust API that allows seamless integration with your existing e-commerce platforms, ERPs, or custom software."
    },
    {
      question: "What kind of support do you provide?",
      answer: "We offer dedicated support for all our business partners, including onboarding assistance, technical integration support, and 24/7 operational support."
    }
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
            <Link href="/pricing" className="text-sm font-medium text-primary transition-colors">
              Pricing
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
              <Link href="/pricing" className="text-primary font-medium py-2" onClick={() => setIsMenuOpen(false)}>
                Pricing
              </Link>
              <Link href="/login" className="text-muted-foreground hover:text-foreground py-2" onClick={() => setIsMenuOpen(false)}>
                Login
              </Link>
            </nav>
          </div>
        )}
      </header>

      <main className="pt-20 relative overflow-hidden">
        {/* Hero Section */}
        <section className="relative py-20 md:py-32 overflow-hidden">
            <HoleBackground className="absolute inset-0 opacity-50 pointer-events-none" />
            <div className="container mx-auto px-6 relative z-10">
                <Reveal>
                    <div className="text-center max-w-4xl mx-auto mb-16">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8 border border-primary/20 backdrop-blur-sm">
                            <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                            </span>
                            Enterprise Solutions
                        </div>
                        <h1 className="text-5xl md:text-7xl font-bold mb-8 tracking-tight leading-tight">
                            Pricing that scales with <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-blue-500 to-purple-600 animate-gradient-x">
                                your ambition
                            </span>
                        </h1>
                        <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                            No rigid tiers. No hidden fees. Just a partnership designed to help your business grow.
                        </p>
                    </div>
                </Reveal>

                <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                    {/* Book Demo Card */}
                    <SlideIn delay={0.1}>
                        <div className="group relative h-full p-10 rounded-[2rem] bg-card/50 backdrop-blur-sm border border-border hover:border-primary/50 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/10 overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                                <div className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">POPULAR</div>
                            </div>
                            
                            <div className="relative z-10 flex flex-col h-full items-center text-center">
                                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500 shadow-inner">
                                    <Calendar className="w-10 h-10 text-primary" />
                                </div>
                                <h3 className="text-3xl font-bold mb-4">Book a Free Demo</h3>
                                <p className="text-muted-foreground mb-10 text-lg flex-grow">
                                    Experience the power of SwiftDash firsthand. Let our experts show you how we can streamline your logistics.
                                </p>
                                <Button asChild size="lg" className="w-full text-lg h-14 rounded-xl shadow-lg shadow-primary/20 group-hover:shadow-primary/40 transition-all duration-300">
                                    <a href="mailto:johnpatino@swiftdash.ph?subject=Book a Free Demo - SwiftDash">
                                        Schedule Walkthrough
                                        <ArrowRight className="ml-2 w-5 h-5" />
                                    </a>
                                </Button>
                                <p className="mt-4 text-sm text-muted-foreground">No credit card required</p>
                            </div>
                        </div>
                    </SlideIn>

                    {/* Get Quote Card */}
                    <SlideIn delay={0.2}>
                        <div className="group relative h-full p-10 rounded-[2rem] bg-card/50 backdrop-blur-sm border border-border hover:border-blue-500/50 transition-all duration-500 hover:shadow-2xl hover:shadow-blue-500/10 overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            
                            <div className="relative z-10 flex flex-col h-full items-center text-center">
                                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500 shadow-inner">
                                    <FileText className="w-10 h-10 text-blue-500" />
                                </div>
                                <h3 className="text-3xl font-bold mb-4">Get a Custom Quote</h3>
                                <p className="text-muted-foreground mb-10 text-lg flex-grow">
                                    High volume deliveries? Complex requirements? We'll build a custom pricing plan that fits your budget.
                                </p>
                                <Button asChild variant="outline" size="lg" className="w-full text-lg h-14 rounded-xl border-2 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all duration-300">
                                    <a href="mailto:johnpatino@swiftdash.ph?subject=Request a Quote - SwiftDash">
                                        Request Custom Quote
                                        <ChevronRight className="ml-2 w-5 h-5" />
                                    </a>
                                </Button>
                                <p className="mt-4 text-sm text-muted-foreground">Response within 24 hours</p>
                            </div>
                        </div>
                    </SlideIn>
                </div>
            </div>
        </section>

        {/* Value Props Grid */}
        <section className="py-24 bg-secondary/30">
            <div className="container mx-auto px-6">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">Why leading businesses choose SwiftDash</h2>
                    <p className="text-muted-foreground text-lg">More than just a delivery service, we're your logistics partner.</p>
                </div>

                <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                    {[
                        {
                            icon: <Truck className="w-6 h-6 text-blue-500" />,
                            title: "Smart Dispatch",
                            desc: "AI-powered matching ensures the nearest and most suitable driver handles your package."
                        },
                        {
                            icon: <Zap className="w-6 h-6 text-yellow-500" />,
                            title: "Real-time Updates",
                            desc: "Live GPS tracking and instant status notifications keep you and your customers in the loop."
                        },
                        {
                            icon: <BarChart3 className="w-6 h-6 text-green-500" />,
                            title: "Advanced Analytics",
                            desc: "Gain insights into delivery times, costs, and performance to optimize your operations."
                        },
                        {
                            icon: <ShieldCheck className="w-6 h-6 text-purple-500" />,
                            title: "Secure Handling",
                            desc: "Verified drivers and secure handling protocols ensure your packages arrive safely."
                        },
                        {
                            icon: <Globe className="w-6 h-6 text-cyan-500" />,
                            title: "Nationwide Coverage",
                            desc: "From metro centers to provincial areas, our network is constantly expanding."
                        },
                        {
                            icon: <Smartphone className="w-6 h-6 text-pink-500" />,
                            title: "Mobile First",
                            desc: "Manage everything from our intuitive mobile app or powerful web dashboard."
                        }
                    ].map((item, i) => (
                        <ScaleIn key={i} delay={i * 0.1}>
                            <div className="bg-background p-8 rounded-2xl border border-border/50 hover:border-primary/30 transition-colors hover:shadow-lg">
                                <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mb-6">
                                    {item.icon}
                                </div>
                                <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                                <p className="text-muted-foreground leading-relaxed">
                                    {item.desc}
                                </p>
                            </div>
                        </ScaleIn>
                    ))}
                </div>
            </div>
        </section>

        {/* FAQ Section */}
        <section className="py-24">
            <div className="container mx-auto px-6 max-w-3xl">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">Frequently Asked Questions</h2>
                    <p className="text-muted-foreground">Everything you need to know about getting started.</p>
                </div>
                
                <Accordion type="single" collapsible className="w-full">
                    {faqs.map((faq, i) => (
                        <AccordionItem key={i} value={`item-${i}`} className="mb-4 border rounded-xl px-6 data-[state=open]:bg-secondary/30 transition-colors">
                            <AccordionTrigger className="text-lg font-medium py-6 hover:no-underline">
                                {faq.question}
                            </AccordionTrigger>
                            <AccordionContent className="text-muted-foreground text-base pb-6 leading-relaxed">
                                {faq.answer}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </div>
        </section>

        {/* CTA Section */}
        <section className="py-24">
            <div className="container mx-auto px-6">
                <div className="bg-gradient-to-r from-primary to-blue-600 rounded-[3rem] p-12 md:p-24 text-center relative overflow-hidden">
                    {/* Decorative circles */}
                    <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
                    <div className="absolute bottom-0 right-0 w-64 h-64 bg-black/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
                    
                    <div className="relative z-10 max-w-3xl mx-auto">
                        <h2 className="text-4xl md:text-5xl font-bold text-white mb-8">
                            Ready to transform your logistics?
                        </h2>
                        <p className="text-xl text-white/90 mb-12 leading-relaxed">
                            Join hundreds of businesses that trust SwiftDash for their daily deliveries. 
                            Get started today with a free consultation.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-6 justify-center">
                            <Button asChild size="lg" variant="secondary" className="text-lg h-14 px-8 rounded-xl shadow-xl hover:scale-105 transition-transform">
                                <a href="mailto:johnpatino@swiftdash.ph">
                                    <Mail className="mr-2 h-5 w-5" />
                                    Contact Sales
                                </a>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </section>
      </main>
    </div>
  );
}
