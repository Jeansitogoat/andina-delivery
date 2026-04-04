'use client';

import { BellRing, MapPin, Navigation } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { useNotifications, isWebPushEnvironment } from '@/lib/useNotifications';
import { effectiveNotificationRole } from '@/lib/fcmEffectiveRole';
import { loadPermWizard, savePermWizardPatch } from '@/lib/permWizardStorage';
import { useGeolocationPermission } from '@/lib/useGeolocationPermission';
import { isIOS } from '@/lib/fcm-client';

const OPERATIONAL = new Set(['local', 'rider', 'central', 'maestro']);

type NotifStep = 'intro' | 'browser';

function requestGeolocation(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('no geolocation'));
      return;
    }
    navigator.geolocation.getCurrentPosition(() => resolve(), () => reject(new Error('denied')), {
      timeout: 20000,
      maximumAge: 0,
    });
  });
}

/**
 * Tras iniciar sesión: pantalla completa para notificaciones (cliente) y ubicación (todos).
 * Operativos: NotificationShield cubre notificaciones; este wizard muestra ubicación después.
 * Estado persistido: `andina_perm_wizard_v1_${uid}` (geo atendida). Notificaciones: solo «completado» con permiso granted.
 */
export default function PostLoginPermissionsWizard() {
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const isOp = user ? OPERATIONAL.has(user.rol) : false;
  const role = user ? effectiveNotificationRole(user) : 'user';
  const { permission: notifPerm, requestPermission, loading: notifLoading, isSupported: notifSupported } =
    useNotifications(role);

  const [notifStep, setNotifStep] = useState<NotifStep>('intro');
  const [geoLoading, setGeoLoading] = useState(false);
  const geoState = useGeolocationPermission();

  useEffect(() => {
    if (notifPerm === 'default') setNotifStep('intro');
  }, [notifPerm]);

  const markGeoDone = useCallback(() => {
    if (!user?.uid) return;
    savePermWizardPatch(user.uid, { geoHandled: true });
  }, [user?.uid]);

  useEffect(() => {
    if (authLoading || !user) return;
    if (pathname?.startsWith('/auth')) return;
    const persist = loadPermWizard(user.uid);
    if (persist.geoHandled) return;
    if (geoState === 'loading') return;
    const need =
      geoState !== 'granted' &&
      geoState !== 'unsupported' &&
      (geoState === 'prompt' || geoState === 'denied');
    if (!need) {
      markGeoDone();
    }
  }, [authLoading, user, pathname, geoState, markGeoDone]);

  if (authLoading || !user) return null;
  if (pathname?.startsWith('/auth')) return null;

  const persist = loadPermWizard(user.uid);

  const shell =
    'fixed inset-0 z-[90] bg-slate-950/95 backdrop-blur-sm flex items-center justify-center p-6 pointer-events-auto';

  const showClienteNotifWizard =
    !isOp && notifSupported && isWebPushEnvironment() && notifPerm === 'default';

  const opWaitingOnShield = isOp && notifPerm !== 'granted';
  if (opWaitingOnShield) {
    return null;
  }

  const needGeo =
    geoState !== 'loading' &&
    geoState !== 'granted' &&
    geoState !== 'unsupported' &&
    (geoState === 'prompt' || geoState === 'denied');

  if (showClienteNotifWizard) {
    return (
      <div className={shell}>
        <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-gray-100 text-center max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-xs font-bold text-rojo-andino uppercase tracking-wide">Paso 1 de 2</span>
          </div>
          <div className="mx-auto w-16 h-16 rounded-2xl bg-rojo-andino/10 flex items-center justify-center mb-4">
            <BellRing className="w-8 h-8 text-rojo-andino" />
          </div>
          <h2 className="text-xl font-black text-gray-900">Activa las notificaciones</h2>
          {notifStep === 'intro' ? (
            <>
              <p className="text-sm text-gray-600 mt-3 leading-relaxed text-left">
                Te avisaremos del estado de tus pedidos, repartidor y tiempos. Es la forma más fiable de enterarte al
                instante.
              </p>
              <button
                type="button"
                onClick={() => setNotifStep('browser')}
                className="mt-6 w-full py-3 rounded-2xl bg-rojo-andino text-white font-bold hover:bg-rojo-andino/90"
              >
                Siguiente
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600 mt-3">
                El navegador pedirá permiso. Elige <strong>Permitir</strong> para recibir avisos.
              </p>
              <button
                type="button"
                onClick={() => void requestPermission()}
                disabled={notifLoading}
                className="mt-6 w-full py-3 rounded-2xl bg-rojo-andino text-white font-bold hover:bg-rojo-andino/90 disabled:opacity-70"
              >
                {notifLoading ? 'Abriendo…' : 'Permitir notificaciones'}
              </button>
              <button
                type="button"
                onClick={() => setNotifStep('intro')}
                className="mt-3 w-full py-2 text-xs text-gray-400 hover:text-gray-600"
              >
                Volver
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (geoState === 'loading') return null;

  if (!needGeo) {
    return null;
  }

  const clienteCanProceedToGeo =
    notifPerm === 'granted' ||
    notifPerm === 'denied' ||
    !isWebPushEnvironment() ||
    !notifSupported;
  if (!isOp && !clienteCanProceedToGeo) {
    return null;
  }

  if (persist.geoHandled) {
    return null;
  }

  return (
    <div className={shell}>
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-gray-100 text-center max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-xs font-bold text-rojo-andino uppercase tracking-wide">
            {isOp ? 'Ubicación' : 'Paso 2 de 2'}
          </span>
        </div>
        <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mb-4">
          <MapPin className="w-8 h-8 text-emerald-800" />
        </div>
        <h2 className="text-xl font-black text-gray-900">Activa tu ubicación</h2>
        <p className="text-sm text-gray-600 mt-3 leading-relaxed text-left">
          La usamos para mostrar <strong>distancias</strong>, <strong>tiempos estimados</strong> y mejorar la entrega.
        </p>
        {geoState === 'denied' && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mt-3 text-left">
            {isIOS()
              ? 'En iPhone: Ajustes → Privacidad → Localización → Safari o la app Andina → Permitir.'
              : 'En Chrome: ícono del candado → Configuración del sitio → Ubicación → Permitir. Luego recarga o pulsa Reintentar.'}
          </p>
        )}
        <button
          type="button"
          disabled={geoLoading}
          onClick={() => {
            setGeoLoading(true);
            requestGeolocation()
              .then(() => markGeoDone())
              .catch(() => {})
              .finally(() => setGeoLoading(false));
          }}
          className="mt-6 w-full py-3 rounded-2xl bg-rojo-andino text-white font-bold hover:bg-rojo-andino/90 disabled:opacity-70 flex items-center justify-center gap-2"
        >
          {geoLoading ? (
            'Solicitando…'
          ) : (
            <>
              <Navigation className="w-5 h-5" />
              Permitir ubicación
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => markGeoDone()}
          className="mt-3 w-full py-2 text-sm font-medium text-gray-500 hover:text-gray-800"
        >
          {isOp ? 'Continuar sin ubicación (menos preciso)' : 'Más tarde'}
        </button>
      </div>
    </div>
  );
}
