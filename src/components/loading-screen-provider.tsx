'use client';

import { Suspense } from 'react';
import { LoadingScreen } from './loading-screen';

export function LoadingScreenProvider() {
  return (
    <Suspense fallback={null}>
      <LoadingScreen />
    </Suspense>
  );
}
