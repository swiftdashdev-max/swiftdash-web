'use client';

import BusinessLayoutComponent from '@/components/business-layout';
import { usePathname } from 'next/navigation';

export default function BusinessLayout({children}: {children: React.ReactNode}) {
  const pathname = usePathname();
  
  return (
    <BusinessLayoutComponent currentPath={pathname}>
      {children}
    </BusinessLayoutComponent>
  );
}