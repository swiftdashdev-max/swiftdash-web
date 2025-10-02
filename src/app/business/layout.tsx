import {AppShell} from '@/components/app-shell';
import {businessNavItems} from '@/lib/data';

export default function BusinessLayout({children}: {children: React.ReactNode}) {
  return <AppShell navItems={businessNavItems}>{children}</AppShell>;
}
