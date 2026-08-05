/**
 * Shared building blocks for the API reference pages.
 *
 * These lived inside the delivery docs page until the emergency reference
 * needed them too. Both references are separate documents with separate
 * audiences, but they are one product and must look like it — so the headings,
 * badges, callouts and pills come from here rather than being copied.
 */

import type { ReactNode } from 'react';

export type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export function MethodBadge({ method }: { method: Method }) {
  const colors: Record<string, string> = {
    GET:    'border-blue-400/40 bg-blue-500/10 text-blue-400',
    POST:   'border-green-400/40 bg-green-500/10 text-green-400',
    PATCH:  'border-yellow-400/40 bg-yellow-500/10 text-yellow-400',
    DELETE: 'border-red-400/40 bg-red-500/10 text-red-400',
  };
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-bold font-mono ${colors[method]}`}>
      {method}
    </span>
  );
}

export function Endpoint({ method, path }: { method: Method; path: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-muted/60 border border-border px-4 py-3 my-4 font-mono text-sm">
      <MethodBadge method={method} />
      <span className="text-foreground break-all">{path}</span>
    </div>
  );
}

export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="pt-12 pb-4 scroll-mt-20 border-b border-border last:border-0">
      <h2 className="text-xl font-bold mb-4 text-foreground">{title}</h2>
      {children}
    </section>
  );
}

export function SubSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="pt-10 pb-2 scroll-mt-20 border-b border-border/50 last:border-0">
      <h3 className="text-lg font-semibold mb-3 text-foreground">{title}</h3>
      {children}
    </section>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground text-sm leading-7 mb-4">{children}</p>;
}

export function InlineCode({ children }: { children: ReactNode }) {
  return (
    <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-foreground border border-border">
      {children}
    </code>
  );
}

export function Note({ children, variant = 'info' }: { children: ReactNode; variant?: 'info' | 'warn' | 'danger' }) {
  const styles: Record<string, string> = {
    info:   'bg-blue-500/8 border-blue-500/30 text-blue-700 dark:text-blue-300',
    warn:   'bg-yellow-500/8 border-yellow-500/30 text-yellow-700 dark:text-yellow-300',
    danger: 'bg-red-500/8 border-red-400/30 text-red-700 dark:text-red-300',
  };
  const icons: Record<string, string> = { info: 'ℹ️', warn: '⚠️', danger: '🚨' };
  return (
    <div className={`flex gap-3 rounded-lg border px-4 py-3 text-sm my-4 ${styles[variant]}`}>
      <span>{icons[variant]}</span>
      <span className="leading-relaxed">{children}</span>
    </div>
  );
}

/**
 * Delivery statuses and incident statuses in one map. They do not collide, and
 * a single pill component keeps the two references visually consistent.
 */
const statusColors: Record<string, string> = {
  // Deliveries
  pending:           'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  driver_assigned:   'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  pickup_arrived:    'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  package_collected: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  in_transit:        'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  delivered:         'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  failed:            'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',

  // Incidents
  submitted:  'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  dispatched: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  en_route:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  on_scene:   'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  resolved:   'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  rejected:   'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',

  // Shared by both
  cancelled:  'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-mono font-medium ${statusColors[status] ?? 'bg-muted text-muted-foreground'}`}>
      {status}
    </span>
  );
}
