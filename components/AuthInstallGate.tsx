'use client';

import { useEffect, useState, type ReactNode } from 'react';
import InstallOnboarding from '@/components/InstallOnboarding';
import { STORAGE_PWA_ONBOARDING_DONE } from '@/lib/andinaStorageKeys';
function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    !!(window.navigator as { standalone?: boolean }).standalone ||
    document.referrer.includes('android-app://')
  );
}

export default function AuthInstallGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<'loading' | 'onboarding' | 'done'>('loading');

  useEffect(() => {
    if (isStandaloneMode()) {
      setPhase('done');
      return;
    }
    try {
      const v = localStorage.getItem(STORAGE_PWA_ONBOARDING_DONE);
      setPhase(v ? 'done' : 'onboarding');
    } catch {
      setPhase('onboarding');
    }
  }, []);

  if (phase === 'loading') {
    return (
      <div
        className="fixed inset-0 bg-[#0f0f0f] z-[9980]"
        aria-hidden
      />
    );
  }

  if (phase === 'onboarding') {
    return (
      <InstallOnboarding
        onDone={() => {
          setPhase('done');
        }}
      />
    );
  }

  return <>{children}</>;
}
