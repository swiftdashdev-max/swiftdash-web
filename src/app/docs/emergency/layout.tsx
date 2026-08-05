import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'SwiftDash Emergency Response API',
  description:
    'API reference for filing emergency reports into a command center dispatch console, following the response, and cancelling a report.',
};

export default function EmergencyDocsLayout({ children }: { children: ReactNode }) {
  return children;
}
