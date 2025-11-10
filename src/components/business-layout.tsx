'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  Package, 
  MapPin, 
  Truck, 
  Users, 
  DollarSign,
  BarChart3, 
  Settings, 
  Menu, 
  X,
  LogOut,
  Bell,
  Search,
  User,
  Clock,
  UserCheck,
  Navigation,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { ThemeToggle } from '@/components/theme-toggle';
import { useUserContext } from '@/lib/supabase/user-context';

const navigation = [
  { name: 'Dashboard', href: '/business/dashboard', icon: LayoutDashboard },
  { name: 'Orders', href: '/business/orders', icon: Package },
  { name: 'Dispatch', href: '/business/dispatch', icon: MapPin },
  { name: 'Tracking', href: '/business/tracking', icon: Navigation },
  { name: 'Fleet', href: '/business/fleet', icon: Truck },
  { name: 'Reports', href: '/business/reports', icon: BarChart3 },
];

interface BusinessLayoutProps {
  children: React.ReactNode;
  currentPath?: string;
}

export default function BusinessLayout({ children, currentPath }: BusinessLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, loading } = useUserContext();
  const router = useRouter();
  const supabase = createClient();

  const getInitials = () => {
    if (!user) return 'BZ';
    const profile = user.user_metadata;
    if (profile?.business_name) {
      return profile.business_name.substring(0, 2).toUpperCase();
    }
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
    }
    return user.email?.substring(0, 2).toUpperCase() || 'BZ';
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/business/login');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 max-w-screen-2xl items-center justify-between px-4 md:px-6">
          {/* Left Side: Logo & Mobile Menu */}
          <div className="flex items-center gap-2 md:gap-4">
            <Link href="/business/dashboard" className="flex items-center space-x-2 shrink-0">
              <Image
                src="/assets/images/swiftdash_logo.png"
                alt="SwiftDash"
                width={28}
                height={28}
                className="shrink-0"
              />
              <span className="hidden sm:inline-block font-bold text-sm md:text-base bg-gradient-to-r from-[#1CB8F7] to-[#3B4CCA] bg-clip-text text-transparent whitespace-nowrap">
                SwiftDash Business
              </span>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden shrink-0"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>

          {/* Centered Desktop Navigation */}
          <div className="hidden md:flex flex-1 justify-center max-w-3xl mx-4">
            <nav className="flex items-center gap-4 lg:gap-6 text-sm font-medium overflow-x-auto">
              {navigation.map((item) => {
                const isActive = currentPath === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`relative flex items-center space-x-1.5 whitespace-nowrap transition-colors hover:text-primary ${
                      isActive ? 'text-primary font-semibold' : 'text-muted-foreground'
                    }`}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="hidden lg:inline">{item.name}</span>
                    {isActive && (
                      <motion.div 
                        className="absolute -bottom-2 left-0 right-0 h-0.5 bg-primary"
                        layoutId="underline"
                      />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-1 md:gap-2 shrink-0">
            {/* Search - Hidden on small screens */}
            <div className="relative hidden lg:block">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search orders..."
                className="pl-8 w-[180px] xl:w-[250px]"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-1">
              <ThemeToggle />
              
              {/* Notifications */}
              <Button variant="ghost" size="icon" className="relative h-9 w-9 shrink-0">
                <Bell className="h-4 w-4" />
                <Badge className="absolute top-1 right-1 h-4 w-4 flex items-center justify-center rounded-full p-0 text-xs">
                  5
                </Badge>
              </Button>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full shrink-0">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src="/avatars/business.png" alt={user?.user_metadata?.business_name || 'Business'} />
                      <AvatarFallback>{getInitials()}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {user?.user_metadata?.business_name || user?.user_metadata?.full_name || 'Business Account'}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user?.email || 'Loading...'}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/business/profile" className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/business/settings" className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 md:hidden"
          >
            <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed left-0 top-0 h-full w-80 bg-background border-r border-border shadow-lg"
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center space-x-2">
                  <Image
                    src="/assets/images/swiftdash_logo.png"
                    alt="SwiftDash"
                    width={24}
                    height={24}
                  />
                  <span className="font-bold bg-gradient-to-r from-[#1CB8F7] to-[#3B4CCA] bg-clip-text text-transparent">
                    SwiftDash Business
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <nav className="p-4">
                <div className="space-y-2">
                  {navigation.map((item) => {
                    const isActive = currentPath === item.href;
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'text-foreground/60 hover:text-foreground hover:bg-accent'
                        }`}
                      >
                        <item.icon className="h-5 w-5" />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </nav>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className={
        currentPath === '/business/orders' || currentPath === '/business/tracking'
          ? '' // Full width, no padding for orders and tracking pages
          : 'container mx-auto px-4 py-6 max-w-screen-2xl'
      }>
        {children}
      </main>
    </div>
  );
}
