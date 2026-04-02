'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  SESSION_LAUNCH_INCREMENTED,
  STORAGE_LAUNCH_COUNT,
} from '@/lib/andinaStorageKeys';

function readCount(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(STORAGE_LAUNCH_COUNT);
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isNaN(n) ? 0 : n;
  } catch {
    return 0;
  }
}

const LaunchCountContext = createContext(0);

/**
 * Incrementa `andina_launch_count` una vez por sesión de navegador (pestaña).
 * Expone el valor actual para banners de respaldo (≥2).
 */
export function LaunchCountProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(readCount);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_LAUNCH_INCREMENTED) === '1') {
        setCount(readCount());
        return;
      }
      sessionStorage.setItem(SESSION_LAUNCH_INCREMENTED, '1');
      const prev = readCount();
      const next = prev + 1;
      localStorage.setItem(STORAGE_LAUNCH_COUNT, String(next));
      setCount(next);
      // TODO: analytics — logEvent('app_launch', { launch_count: next, pwa_standalone: ... })
    } catch {
      setCount(readCount());
    }
  }, []);

  const value = useMemo(() => count, [count]);
  return (
    <LaunchCountContext.Provider value={value}>{children}</LaunchCountContext.Provider>
  );
}

export function useLaunchCount(): number {
  return useContext(LaunchCountContext);
}

export function isBackupLaunchEligible(launchCount: number): boolean {
  return launchCount >= 2;
}
