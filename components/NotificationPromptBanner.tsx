'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { Bell, X, Download } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';
import { useNotifications } from '@/lib/useNotifications';
import { getFCMTokenWithRetry } from '@/lib/fcm-client';
import type { NotificationRole } from '@/lib/useNotifications';

const ROLE_MAP: Record<string, NotificationRole> = {
  cliente: 'user',
  central: 'central',
  rider: 'rider',
  local: 'local',
  maestro: 'central',
};

const DISMISS_KEY = 'andina_notif_prompt_dismissed';
const DISMISS_DAYS = 7;

function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isPWA(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches;
}

function shouldShowBanner(dismissedAt: string | null): boolean {
  if (!dismissedAt) return true;
  const t = parseInt(dismissedAt, 10);
  if (Number.isNaN(t)) return true;
  const daysSince = (Date.now() - t) / (24 * 60 * 60 * 1000);
  return daysSince >= DISMISS_DAYS;
}

function getInstallInstructions(): string {
  if (isIOS()) {
    return 'En iPhone: toca Compartir (↑) → "Añadir a pantalla de inicio" y ábrela desde el ícono para recibir notificaciones.';
  }
  return 'Para recibir notificaciones, instala la app: en Chrome toca el ícono ⊕ en la barra de direcciones → "Instalar app", luego ábrela.';
}

export default function NotificationPromptBanner() {
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const role = user ? (ROLE_MAP[user.rol] ?? 'user') : 'user';
  const { permission, requestPermission, loading: notifLoading, isSupported, error: notifError, registerToken } = useNotifications(role);
  const [dismissed, setDismissed] = useState(false);
  const [ready, setReady] = useState(false);
  const [pwa, setPwa] = useState(false);
  const lastRetryAt = useRef(0);
  const RETRY_THROTTLE_MS = 90_000;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let key: string | null = null;
    try {
      key = localStorage.getItem(DISMISS_KEY);
    } catch {
      /* Silencioso en móvil (modo privado, WebView, etc.) */
    }
    if (!shouldShowBanner(key)) {
      setDismissed(true);
    }
    setPwa(isPWA());
    setReady(true);
  }, []);

  // Reintentar registro del token cuando ya hay permiso y usuario logueado (crítico para iOS).
  useEffect(() => {
    if (!user || permission !== 'granted') return;
    const now = Date.now();
    if (now - lastRetryAt.current < RETRY_THROTTLE_MS) return;
    lastRetryAt.current = now;
    let cancelled = false;
    (async () => {
      const token = await getFCMTokenWithRetry();
      if (cancelled) return;
      if (token) {
        await registerToken(token);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, permission, registerToken]);

  const inPanel = pathname?.startsWith('/panel') ?? false;
  const show =
    ready &&
    !authLoading &&
    user &&
    user.rol === 'cliente' &&
    !inPanel &&
    isSupported &&
    permission !== 'granted' &&
    !dismissed;

  const dismiss = () => {
    setDismissed(true);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(DISMISS_KEY, Date.now().toString());
      } catch {
        /* Silencioso en móvil */
      }
    }
  };

  if (!show) return null;

  // Si no es PWA instalada, mostrar banner de instalación (no pedimos permiso aún)
  if (!pwa) {
    return (
      <div className="fixed top-4 left-4 right-4 z-40 max-w-md mx-auto animate-fade-in">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-rojo-andino/10 flex items-center justify-center flex-shrink-0">
            <Download className="w-6 h-6 text-rojo-andino" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-sm">Instala la app para notificaciones</p>
            <p className="text-xs text-gray-500">{getInstallInstructions()}</p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-500 flex-shrink-0"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-4 left-4 right-4 z-40 max-w-md mx-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-rojo-andino/10 flex items-center justify-center flex-shrink-0">
          <Bell className="w-6 h-6 text-rojo-andino" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-sm">Recibe notificaciones</p>
          <p className="text-xs text-gray-500">
            {notifError ?? 'Te avisaremos al instante del estado de tus pedidos.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={requestPermission}
            disabled={notifLoading}
            className="px-4 py-2 rounded-xl bg-rojo-andino text-white font-bold text-sm hover:bg-rojo-andino/90 transition-colors disabled:opacity-70"
          >
            {notifLoading ? '...' : 'Activar'}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
