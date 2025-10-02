'use client';

import * as React from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import Image from 'next/image';
import * as LucideIcons from 'lucide-react';
import {
  Bell,
  ChevronDown,
  ChevronRight,
  Home,
  LogOut,
  Search,
  Settings,
  User,
} from 'lucide-react';

import {cn} from '@/lib/utils';
import type {NavItem} from '@/lib/types';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {Input} from '@/components/ui/input';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';
import {Avatar, AvatarFallback, AvatarImage} from './ui/avatar';
import {Button} from './ui/button';
import {SwiftdashLogo} from './icons';
import {mockUser} from '@/lib/data';
import {PlaceHolderImages} from '@/lib/placeholder-images';

interface AppShellProps {
  navItems: NavItem[];
  children: React.ReactNode;
}

const DynamicIcon = ({name}: {name: string}) => {
  const Icon = (LucideIcons as any)[name];
  if (!Icon) {
    return null;
  }
  return <Icon />;
};

export function AppShell({navItems, children}: AppShellProps) {
  const pathname = usePathname();
  const userAvatar = PlaceHolderImages.find(img => img.id === mockUser.avatar);

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="p-4">
          <div
            data-sidebar="header-content"
            className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center"
          >
            <SwiftdashLogo className="size-7 text-sidebar-primary" />
            <span className="text-lg font-bold text-sidebar-foreground group-data-[collapsible=icon]:hidden">
              Swiftdash
            </span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navItems.map(item => (
              <SidebarMenuItem key={item.label}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === item.href}
                  tooltip={item.label}
                >
                  <Link href={item.href}>
                    <DynamicIcon name={item.icon} />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div
                role="button"
                className="flex w-full cursor-pointer items-center gap-2 rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center"
              >
                <Avatar className="size-8">
                  {userAvatar && <AvatarImage src={userAvatar.imageUrl} alt={mockUser.name} />}
                  <AvatarFallback>{mockUser.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 truncate group-data-[collapsible=icon]:hidden">
                  <p className="font-medium text-sidebar-foreground">{mockUser.name}</p>
                  <p className="text-xs text-sidebar-foreground/70">{mockUser.email}</p>
                </div>
                <ChevronDown className="size-4 text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4 sm:px-6">
          <SidebarTrigger className="md:hidden" />
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search..."
              className="w-full rounded-lg bg-secondary pl-8 md:w-[280px] lg:w-[320px]"
            />
          </div>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Bell className="h-5 w-5" />
            <span className="sr-only">Toggle notifications</span>
          </Button>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
