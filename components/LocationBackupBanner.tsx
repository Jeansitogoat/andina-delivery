'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { MapPin, X } from 'lucide-react';
import { useLaunchCount, isBackupLaunchEligible } from '@/lib/launchCount';
import { useAuth } from '@/lib/useAuth';
import { useGeolocationPermission } from '@/lib/useGeolocationPermission';
import { isPostLoginWizardClearForBanners } from '@/lib/permWizardBanner';
import type { NotificationPermission } from '@/lib/useNotifications';

/**
 * Plan de respaldo: sugerir ubicación a partir de la 2.ª apertura si el permiso no está concedido.
 */
export default function LocationBackupBanner() {
  const pathname = usePathname();
  const { user } = useAuth();
  const launchCount = useLaunchCount();
  const geoState = useGeolocationPermission();
  const [dismissed, setDismissed] = useState(false);
  const [permWizardDone, setPermWizardDone] = useState(false);

  const runBannerGate = useCallback(() => {
    const np =
      typeof window !== 'undefined' && 'Notification' in window
        ? (Notification.permission as NotificationPermission)
        : ('default' as NotificationPermission);
    setPermWizardDone(isPostLoginWizardClearForBanners(user?.uid ?? null, geoState, np, user?.rol));
  }, [user?.uid, user?.rol, geoState]);

  useEffect(() => {
    runBannerGate();
    window.addEventListener('andina-perm-wizard-done', runBannerGate);
    const onVis = () => runBannerGate();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('andina-perm-wizard-done', runBannerGate);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [runBannerGate]);

  if (pathname?.startsWith('/auth')) return null;
  if (!permWizardDone) return null;
  if (!isBackupLaunchEligible(launchCount)) return null;
  if (dismissed) return null;
  if (geoState === 'loading') return null;
  if (geoState === 'unsupported') return null;
  if (geoState === 'granted') return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 max-w-md mx-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-rojo-andino/10 flex items-center justify-center flex-shrink-0">
          <MapPin className="w-6 h-6 text-rojo-andino" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-sm">Ubicación para distancias</p>
          <p className="text-xs text-gray-500">
            {geoState === 'denied'
              ? 'Activa la ubicación en Ajustes del navegador para ver tiempos y distancias más precisos.'
              : 'Permite el acceso a tu ubicación cuando el navegador lo solicite.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="p-2 rounded-full hover:bg-gray-100 text-gray-500 flex-shrink-0"
          aria-label="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
