'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import GlobalLocationPrompt from '@/components/GlobalLocationPrompt';

const MIN_SPLASH_MS = 1200;

function readVisitado(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return !!localStorage.getItem('andina_visitado');
  } catch {
    return true;
  }
}

/**
 * Splash inicial + orden de navegación: en la primera visita (sin login previo)
 * se redirige a /auth sin mostrar antes el listado de locales (evita flash visual).
 */
export default function AuthSplashGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading: authLoading, user } = useAuth();
  const [visitado] = useState(readVisitado);
  const [showSplash, setShowSplash] = useState(true);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (authLoading) return;
    if (!user && !visitado && pathname === '/') {
      router.replace('/auth');
    }
  }, [authLoading, user, visitado, pathname, router]);

  useEffect(() => {
    if (authLoading) return;

    // Login primero: primera visita → ya en /auth, quitar splash sin esperar MIN_SPLASH
    if (!user && !visitado && pathname.startsWith('/auth')) {
      setShowSplash(false);
      return;
    }

    // Primera visita aún en '/' mientras Next aplica el replace → mantener splash
    if (!user && !visitado && pathname === '/') {
      return;
    }

    // Home como invitado recurrente, o con sesión, u otras rutas: splash mínimo como antes
    const elapsed = Date.now() - startTimeRef.current;
    const remaining = Math.max(0, MIN_SPLASH_MS - elapsed);
    const timer = setTimeout(() => setShowSplash(false), remaining);
    return () => clearTimeout(timer);
  }, [authLoading, user, visitado, pathname]);

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

  return (
    <>
      {children}
      <Suspense fallback={null}>
        <GlobalLocationPrompt />
      </Suspense>
    </>
  );
}
