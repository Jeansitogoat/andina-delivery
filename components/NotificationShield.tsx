'use client';

import { BellRing, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';
import { useNotifications } from '@/lib/useNotifications';

const OPERATIONAL_ROLES = new Set(['local', 'rider', 'central', 'maestro']);

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

  if (authLoading || !user) return null;
  if (!OPERATIONAL_ROLES.has(user.rol)) return null;
  if (permission === 'granted') return null;

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/95 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-gray-100 text-center">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-rojo-andino/10 flex items-center justify-center mb-4">
          <BellRing className="w-8 h-8 text-rojo-andino" />
        </div>
        <h2 className="text-xl font-black text-gray-900">Activa notificaciones para continuar</h2>
        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
          En roles operativos necesitamos notificaciones push para avisarte pedidos, carreras y cambios en tiempo real.
        </p>

        {!isSupported ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-800 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              Este navegador no soporta notificaciones push para la operación. Usa Chrome/Edge actualizado e instala la PWA.
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={requestPermission}
            disabled={loading}
            className="mt-6 w-full py-3 rounded-2xl bg-rojo-andino text-white font-bold hover:bg-rojo-andino/90 disabled:opacity-70"
          >
            {loading ? 'Activando...' : 'Activar notificaciones'}
          </button>
        )}

        <p className="text-xs text-gray-500 mt-4">
          Si bloqueaste permisos, habilítalos manualmente en configuración del navegador.
        </p>
      </div>
    </div>
  );
}
