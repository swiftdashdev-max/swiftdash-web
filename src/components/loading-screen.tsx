'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export function LoadingScreen() {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initial page load
  useEffect(() => {
    const intervals = [
      setTimeout(() => setFadeOut(true), 600),
      setTimeout(() => setVisible(false), 1000),
    ];
    return () => intervals.forEach(clearTimeout);
  }, []);

  // Route change loading
  useEffect(() => {
    setVisible(true);
    setFadeOut(false);

    const intervals = [
      setTimeout(() => setFadeOut(true), 400),
      setTimeout(() => setVisible(false), 800),
    ];
    return () => intervals.forEach(clearTimeout);
  }, [pathname, searchParams]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-md"
      style={{
        background: 'rgba(255, 255, 255, 0.15)',
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 0.4s ease-out',
        pointerEvents: fadeOut ? 'none' : 'all',
      }}
    >
      <div className="flex flex-col items-center gap-4">
        {/* Spinner */}
        <div
          className="rounded-full"
          style={{
            width: '44px',
            height: '44px',
            border: '3px solid rgba(0, 0, 0, 0.08)',
            borderTopColor: '#3b82f6',
            animation: 'spin 0.75s linear infinite',
          }}
        />
      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}