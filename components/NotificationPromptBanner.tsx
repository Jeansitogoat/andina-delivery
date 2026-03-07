'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Bell, X } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';
import { useNotifications } from '@/lib/useNotifications';
import type { NotificationRole } from '@/lib/useNotifications';

const ROLE_MAP: Record<string, NotificationRole> = {
  cliente: 'user',
  central: 'central',
  rider: 'rider',
  local: 'restaurant',
  maestro: 'central',
};

const DISMISS_KEY = 'andina_notif_prompt_dismissed';
const DISMISS_DAYS = 7;

function shouldShowBanner(dismissedAt: string | null): boolean {
  if (!dismissedAt) return true;
  const t = parseInt(dismissedAt, 10);
  if (Number.isNaN(t)) return true;
  const daysSince = (Date.now() - t) / (24 * 60 * 60 * 1000);
  return daysSince >= DISMISS_DAYS;
}

export default function NotificationPromptBanner() {
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const role = user ? (ROLE_MAP[user.rol] ?? 'user') : 'user';
  const { permission, requestPermission, loading: notifLoading, isSupported } = useNotifications(role);
  const [dismissed, setDismissed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = localStorage.getItem(DISMISS_KEY);
    if (!shouldShowBanner(key)) {
      setDismissed(true);
    }
    setReady(true);
  }, []);

  const inPanel = pathname?.startsWith('/panel') ?? false;
  const show =
    ready &&
    !authLoading &&
    user &&
    !inPanel &&
    isSupported &&
    permission !== 'granted' &&
    !dismissed;

  const dismiss = () => {
    setDismissed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem(DISMISS_KEY, Date.now().toString());
    }
  };

  if (!show) return null;

  return (
    <div className="fixed top-4 left-4 right-4 z-40 max-w-md mx-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-rojo-andino/10 flex items-center justify-center flex-shrink-0">
          <Bell className="w-6 h-6 text-rojo-andino" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-sm">Recibe notificaciones</p>
          <p className="text-xs text-gray-500">
            Te avisaremos del estado de tus pedidos
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
