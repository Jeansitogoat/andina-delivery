'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { detectIOS } from '@/hooks/useDevicePlatform';
import PWAInstallSuccessWall from '@/components/PWAInstallSuccessWall';

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

type Ctx = {
  deferredPrompt: BeforeInstallPromptEvent | null;
  /** Solo Android/Chromium con evento disponible. */
  promptInstall: () => Promise<{ outcome: 'accepted' | 'dismissed' } | null>;
  clearDeferred: () => void;
  /** true tras `appinstalled` (Android/Desktop Chromium; iOS no dispara este evento). */
  isJustInstalled: boolean;
};

const PWAInstallPromptContext = createContext<Ctx | null>(null);

function isAndroidChromeUA(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android/.test(navigator.userAgent) && /Chrome/.test(navigator.userAgent);
}

export function PWAInstallPromptProvider({ children }: { children: ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isJustInstalled, setIsJustInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleAppInstalled = () => setIsJustInstalled(true);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => window.removeEventListener('appinstalled', handleAppInstalled);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (detectIOS()) return;
    if (!isAndroidChromeUA()) return;

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const clearDeferred = useCallback(() => setDeferredPrompt(null), []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return null;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return { outcome };
  }, [deferredPrompt]);

  const value = useMemo(
    () => ({ deferredPrompt, promptInstall, clearDeferred, isJustInstalled }),
    [deferredPrompt, promptInstall, clearDeferred, isJustInstalled]
  );

  return (
    <PWAInstallPromptContext.Provider value={value}>
      {isJustInstalled ? null : children}
      <PWAInstallSuccessWall open={isJustInstalled} />
    </PWAInstallPromptContext.Provider>
  );
}

export function usePWAInstallPrompt(): Ctx {
  const ctx = useContext(PWAInstallPromptContext);
  if (!ctx) {
    throw new Error('usePWAInstallPrompt debe usarse dentro de PWAInstallPromptProvider');
  }
  return ctx;
}

/** Para componentes que pueden montarse fuera del provider (no debería ocurrir). */
export function usePWAInstallPromptOptional(): Ctx | null {
  return useContext(PWAInstallPromptContext);
}
