'use client';

import { BellRing, ShieldAlert } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/useAuth';
import { useNotifications } from '@/lib/useNotifications';

const OPERATIONAL_ROLES = new Set(['local', 'rider', 'central', 'maestro']);
const SESSION_SKIP_KEY = 'andina_notif_shield_skip_session';

/** Escritorio típico: puntero fino + hover (no dedo en pantalla táctil como principal). */
function detectLikelyDesktop(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const fine = window.matchMedia('(pointer: fine)').matches;
    const hover = window.matchMedia('(hover: hover)').matches;
    return fine && hover;
  } catch {
    return window.innerWidth >= 1024;
  }
}

export default function NotificationShield() {
  const { user, loading: authLoading } = useAuth();
  const role =
    user?.rol === 'local'
      ? 'local'
      : user?.rol === 'rider'
        ? 'rider'
        : user?.rol === 'central' || user?.rol === 'maestro'
          ? 'central'
          : 'user';
  const { permission, requestPermission, loading, isSupported } = useNotifications(role);

  const [skipped, setSkipped] = useState(false);
  const [likelyDesktop, setLikelyDesktop] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_SKIP_KEY) === '1') setSkipped(true);
    } catch {
      /* modo privado */
    }
    setLikelyDesktop(detectLikelyDesktop());
  }, []);

  const dismissForSession = useCallback(() => {
    try {
      sessionStorage.setItem(SESSION_SKIP_KEY, '1');
    } catch {
      /* silencioso */
    }
    setSkipped(true);
  }, []);

  if (authLoading || !user) return null;
  if (!OPERATIONAL_ROLES.has(user.rol)) return null;
  if (permission === 'granted') return null;
  if (skipped) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/95 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-gray-100 text-center">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-rojo-andino/10 flex items-center justify-center mb-4">
          <BellRing className="w-8 h-8 text-rojo-andino" />
        </div>
        <h2 className="text-xl font-black text-gray-900">
          {likelyDesktop
            ? 'Te recomendamos activar notificaciones'
            : 'Activa notificaciones para continuar'}
        </h2>
        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
          En roles operativos usamos avisos push para pedidos, carreras y cambios en tiempo real.
          {likelyDesktop ? (
            <>
              {' '}
              En <span className="font-semibold text-gray-700">PC</span> puedes seguir sin ellas; en el móvil o la PWA
              suelen ser más útiles.
            </>
          ) : null}
        </p>

        {!isSupported ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-800 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                Este navegador no soporta notificaciones push para la operación. Usa Chrome/Edge actualizado e instala la PWA.
              </span>
            </div>
            <button
              type="button"
              onClick={dismissForSession}
              className="w-full py-3 rounded-2xl border-2 border-gray-200 bg-white text-gray-800 font-semibold hover:bg-gray-50"
            >
              Entendido, continuar
            </button>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={requestPermission}
              disabled={loading}
              className="w-full py-3 rounded-2xl bg-rojo-andino text-white font-bold hover:bg-rojo-andino/90 disabled:opacity-70"
            >
              {loading ? 'Activando...' : 'Activar notificaciones'}
            </button>
            {likelyDesktop ? (
              <button
                type="button"
                onClick={dismissForSession}
                className="w-full py-3 rounded-2xl border-2 border-gray-200 bg-white text-gray-800 font-semibold hover:bg-gray-50 transition-colors"
              >
                Continuar sin notificaciones
              </button>
            ) : (
              <button
                type="button"
                onClick={dismissForSession}
                className="text-sm font-medium text-gray-500 hover:text-gray-800 py-2"
              >
                Ahora no, gracias
              </button>
            )}
          </div>
        )}

        {isSupported && likelyDesktop ? (
          <p className="text-xs text-gray-500 mt-3">
            Podrás activarlas más tarde desde el perfil o la configuración del panel.
          </p>
        ) : null}

        <p className="text-xs text-gray-500 mt-4">
          Si bloqueaste permisos, habilítalos manualmente en configuración del navegador.
        </p>
      </div>
    </div>
  );
}
