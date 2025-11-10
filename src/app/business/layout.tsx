'use client';

import BusinessLayoutComponent from '@/components/business-layout';
import { UserProvider } from '@/lib/supabase/user-context';
import { QueryProvider } from '@/lib/react-query/query-provider';
import { usePathname } from 'next/navigation';

export default function BusinessLayout({children}: {children: React.ReactNode}) {
  const pathname = usePathname();
  
  // Pages that should NOT show the navbar/layout
  const noLayoutPages = ['/business/signup', '/business/login', '/business/forgot-password'];
  const shouldShowLayout = !noLayoutPages.includes(pathname);

  if (!shouldShowLayout) {
    return (
      <QueryProvider>
        <UserProvider>{children}</UserProvider>
      </QueryProvider>
    );
  }
  
  return (
    <QueryProvider>
      <UserProvider>
        <BusinessLayoutComponent currentPath={pathname}>
          {children}
        </BusinessLayoutComponent>
      </UserProvider>
    </QueryProvider>
  );
}