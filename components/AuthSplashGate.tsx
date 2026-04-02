'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useAuth } from '@/lib/useAuth';

const MIN_SPLASH_MS = 1200;

export default function AuthSplashGate({ children }: { children: React.ReactNode }) {
  const { loading: authLoading } = useAuth();
  const [showSplash, setShowSplash] = useState(true);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!authLoading) {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, MIN_SPLASH_MS - elapsed);
      const timer = setTimeout(() => setShowSplash(false), remaining);
      return () => clearTimeout(timer);
    }
  }, [authLoading]);

  if (showSplash) {
    return (
      <div
        className="fixed inset-0 z-[10060] flex min-h-screen flex-col items-center justify-center bg-[#c40f0f] overflow-hidden"
        aria-hidden="true"
      >
        <div className="flex flex-col items-center gap-4">
          <Image
            src="/logo-andina.png"
            alt="Andina"
            width={160}
            height={160}
            className="object-contain drop-shadow-lg"
            priority
          />
          <span className="text-white/90 font-black text-2xl tracking-tight">Andina</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
