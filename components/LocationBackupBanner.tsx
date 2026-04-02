'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MapPin, X } from 'lucide-react';
import { useLaunchCount, isBackupLaunchEligible } from '@/lib/launchCount';

/**
 * Plan de respaldo: sugerir ubicación a partir de la 2.ª apertura si el permiso no está concedido.
 */
export default function LocationBackupBanner() {
  const pathname = usePathname();
  const launchCount = useLaunchCount();
  const [geoPerm, setGeoPerm] = useState<'loading' | PermissionState | 'unsupported'>('loading');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
      setGeoPerm('unsupported');
      return;
    }
    let cancelled = false;
    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((r) => {
        if (cancelled) return;
        setGeoPerm(r.state);
        r.addEventListener('change', () => {
          if (!cancelled) setGeoPerm(r.state);
        });
      })
      .catch(() => {
        if (!cancelled) setGeoPerm('unsupported');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (pathname?.startsWith('/auth')) return null;
  if (!isBackupLaunchEligible(launchCount)) return null;
  if (dismissed) return null;
  if (geoPerm === 'loading') return null;
  if (geoPerm === 'granted') return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 max-w-md mx-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-rojo-andino/10 flex items-center justify-center flex-shrink-0">
          <MapPin className="w-6 h-6 text-rojo-andino" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-sm">Ubicación para distancias</p>
          <p className="text-xs text-gray-500">
            {geoPerm === 'denied'
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
