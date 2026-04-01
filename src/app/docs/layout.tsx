import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'SwiftDash API Reference',
  description: 'Complete API reference for integrating SwiftDash delivery management into your platform.',
};

export default function DocsLayout({ children }: { children: ReactNode }) {
  return children;
}
