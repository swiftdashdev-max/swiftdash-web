import {AppShell} from '@/components/app-shell';
import {adminNavItems} from '@/lib/data';

export default function AdminLayout({children}: {children: React.ReactNode}) {
  return <AppShell navItems={adminNavItems}>{children}</AppShell>;
}
