'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export function LoadingScreen() {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const [progress, setProgress] = useState(0);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initial page load
  useEffect(() => {
    // Animate progress bar
    const intervals = [
      setTimeout(() => setProgress(30), 100),
      setTimeout(() => setProgress(60), 400),
      setTimeout(() => setProgress(85), 800),
      setTimeout(() => setProgress(100), 1100),
      setTimeout(() => setFadeOut(true), 1300),
      setTimeout(() => setVisible(false), 1700),
    ];
    return () => intervals.forEach(clearTimeout);
  }, []);

  // Route change loading
  useEffect(() => {
    setVisible(true);
    setFadeOut(false);
    setProgress(0);

    const intervals = [
      setTimeout(() => setProgress(40), 50),
      setTimeout(() => setProgress(80), 300),
      setTimeout(() => setProgress(100), 600),
      setTimeout(() => setFadeOut(true), 800),
      setTimeout(() => setVisible(false), 1200),
    ];
    return () => intervals.forEach(clearTimeout);
  }, [pathname, searchParams]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)',
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 0.4s ease-out',
        pointerEvents: fadeOut ? 'none' : 'all',
      }}
    >
      {/* Background grid pattern */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(rgba(59,130,246,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.3) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Glow blobs */}
      <div
        className="absolute rounded-full blur-3xl opacity-20"
        style={{
          width: '400px',
          height: '400px',
          background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)',
          top: '20%',
          left: '30%',
          transform: 'translate(-50%, -50%)',
          animation: 'pulse 3s ease-in-out infinite',
        }}
      />
      <div
        className="absolute rounded-full blur-3xl opacity-15"
        style={{
          width: '300px',
          height: '300px',
          background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)',
          bottom: '25%',
          right: '25%',
          animation: 'pulse 3s ease-in-out infinite 1.5s',
        }}
      />

      {/* Logo + Brand */}
      <div className="relative flex flex-col items-center gap-6">
        {/* Animated logo container */}
        <div className="relative flex items-center justify-center">
          {/* Outer ring */}
          <div
            className="absolute rounded-full"
            style={{
              width: '100px',
              height: '100px',
              border: '2px solid rgba(59,130,246,0.4)',
              animation: 'spin 3s linear infinite',
            }}
          />
          {/* Inner ring */}
          <div
            className="absolute rounded-full"
            style={{
              width: '80px',
              height: '80px',
              border: '2px solid rgba(99,102,241,0.3)',
              animation: 'spin 2s linear infinite reverse',
            }}
          />
          {/* Logo icon */}
          <div
            className="relative flex items-center justify-center rounded-2xl"
            style={{
              width: '64px',
              height: '64px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
              boxShadow: '0 0 30px rgba(59,130,246,0.5), 0 0 60px rgba(59,130,246,0.2)',
              animation: 'logoPulse 2s ease-in-out infinite',
            }}
          >
            {/* Swift arrow / delivery icon */}
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M6 16L14 8L22 16"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M14 8V26"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                d="M20 20H26M26 20L23 17M26 20L23 23"
                stroke="rgba(255,255,255,0.7)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* Brand name */}
        <div className="flex flex-col items-center gap-1">
          <h1
            className="text-3xl font-bold tracking-wide"
            style={{
              color: 'white',
              letterSpacing: '0.08em',
              textShadow: '0 0 20px rgba(59,130,246,0.5)',
            }}
          >
            Swift<span style={{ color: '#3b82f6' }}>Dash</span>
          </h1>
          <p
            className="text-sm tracking-widest uppercase"
            style={{ color: 'rgba(148,163,184,0.8)', letterSpacing: '0.2em' }}
          >
            Delivery Platform
          </p>
        </div>

        {/* Progress bar */}
        <div
          className="relative overflow-hidden rounded-full"
          style={{
            width: '200px',
            height: '3px',
            background: 'rgba(255,255,255,0.1)',
          }}
        >
          <div
            className="absolute left-0 top-0 h-full rounded-full"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #3b82f6 0%, #6366f1 100%)',
              transition: 'width 0.3s ease-out',
              boxShadow: '0 0 8px rgba(59,130,246,0.8)',
            }}
          />
          {/* Shimmer effect */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
              animation: 'shimmer 1.5s ease-in-out infinite',
            }}
          />
        </div>

        {/* Dots loader */}
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-full"
              style={{
                width: '6px',
                height: '6px',
                background: '#3b82f6',
                animation: `dotBounce 1.2s ease-in-out infinite ${i * 0.2}s`,
                opacity: 0.7,
              }}
            />
          ))}
        </div>
      </div>

      {/* Keyframes injected inline */}
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes logoPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 30px rgba(59,130,246,0.5), 0 0 60px rgba(59,130,246,0.2); }
          50% { transform: scale(1.05); box-shadow: 0 0 40px rgba(59,130,246,0.7), 0 0 80px rgba(59,130,246,0.3); }
        }
        @keyframes pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.15; }
          50% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.25; }
        }
        @keyframes dotBounce {
          0%, 100% { transform: translateY(0); opacity: 0.5; }
          50% { transform: translateY(-6px); opacity: 1; }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}
