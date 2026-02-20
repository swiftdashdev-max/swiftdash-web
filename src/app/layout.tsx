import type {Metadata} from 'next';
import {Toaster} from '@/components/ui/toaster';
import { ThemeProvider } from '@/components/theme-provider';
import { PerformanceInitializer } from '@/components/performance-initializer';
import { LoadingScreenProvider } from '@/components/loading-screen-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Swiftdash Deliveries',
  description: 'Manage your deliveries with ease.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* DNS prefetching for performance */}
        <link rel="dns-prefetch" href="https://api.mapbox.com" />
        <link rel="dns-prefetch" href="https://maps.googleapis.com" />
        <link rel="dns-prefetch" href="https://api.tiles.mapbox.com" />
        
        {/* Preconnect to critical services */}
        <link rel="preconnect" href="https://api.mapbox.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://maps.googleapis.com" crossOrigin="anonymous" />
        
        {/* Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased">
        <LoadingScreenProvider />
        <PerformanceInitializer />
        <ThemeProvider
          defaultTheme="light"
          storageKey="swiftdash-theme"
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
