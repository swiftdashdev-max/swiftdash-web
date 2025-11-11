'use client';

import { useEffect } from 'react';
import { initializePerformanceOptimizations } from '@/hooks/use-delivery-performance';

export function PerformanceInitializer() {
  useEffect(() => {
    // Run performance optimizations once when the app loads
    initializePerformanceOptimizations();
  }, []);

  return null;
}