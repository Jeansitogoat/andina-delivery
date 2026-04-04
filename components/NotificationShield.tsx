'use client';

import { BellRing, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth, type AndinaUser } from '@/lib/useAuth';
import { useNotifications, isWebPushEnvironment } from '@/lib/useNotifications';
import { isIOS } from '@/lib/fcm-client';
import { effectiveNotificationRole } from '@/lib/fcmEffectiveRole';

const OPERATIONAL_ROLES = new Set(['local', 'rider', 'central', 'maestro']);

type ShieldStep = 'intro' | 'browser';

function DeniedHelpPanels({ ios }: { ios: boolean }) {
  if (ios) {
    return (
      <div className="mt-4 space-y-3 text-left text-sm text-gray-700">
        <p className="font-bold text-gray-900">Safari / iPhone (PWA)</p>
        <ol className="list-decimal pl-5 space-y-2 leading-relaxed">
          <li>Abre <strong>Ajustes</strong> en tu iPhone.</li>
          <li>
            Busca <strong>Andina</strong> en la lista de apps, o entra en <strong>Notificaciones</strong> y localiza la app.
          </li>
          <li>Activa <strong>Permitir notificaciones</strong>.</li>
          <li>
            Si usas la PWA: en Ajustes → <strong>Pantalla de inicio</strong> → toca el ícono de Andina → Notificaciones.
          </li>
        </ol>
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          Tras cambiar el permiso, vuelve aquí y pulsa <strong>Reintentar</strong> o recarga la página.
        </p>
      </div>
    );
  }
  return (
    <div className="mt-4 space-y-3 text-left text-sm text-gray-700">
      <p className="font-bold text-gray-900">Chrome / Edge (Android o escritorio)</p>
      <ol className="list-decimal pl-5 space-y-2 leading-relaxed">
        <li>
          Toca el ícono de <strong>candado</strong> o <strong>información</strong> a la izquierda de la barra de direcciones.
        </li>
        <li>
          Abre <strong>Configuración del sitio</strong> o <strong>Permisos del sitio</strong>.
        </li>
        <li>
          Pon <strong>Notificaciones</strong> en <strong>Permitir</strong> (no «Preguntar» ni «Bloquear»).
        </li>
        <li>Recarga esta página o pulsa <strong>Reintentar</strong>.</li>
      </ol>
      <p className="text-xs text-gray-500">
        En Android: también puedes ir a Ajustes del sistema → Apps → Chrome → Notificaciones y permitir el canal del sitio.
      </p>
    </div>
  );
}

function NotificationShieldWithHooks({ user }: { user: AndinaUser }) {
  const role = effectiveNotificationRole(user);
  const { permission, requestPermission, loading, isSupported } = useNotifications(role);
  const [step, setStep] = useState<ShieldStep>('intro');

  useEffect(() => {
    if (permission === 'default') setStep('intro');
  }, [permission]);

  if (permission === 'granted') return null;

  const shellClass =
    'fixed inset-0 z-[80] bg-slate-950/95 backdrop-blur-sm flex items-center justify-center p-6';

  if (!isSupported) {
    return (
      <div className={shellClass}>
        <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-gray-100 text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mb-4">
            <ShieldAlert className="w-8 h-8 text-amber-700" />
          </div>
          <h2 className="text-xl font-black text-gray-900">Navegador no compatible</h2>
          <p className="text-sm text-gray-600 mt-2 leading-relaxed">
            La operación requiere notificaciones push. Usa <strong>Chrome</strong> o <strong>Edge</strong> actualizado, o instala la{' '}
            <strong>PWA</strong> en iPhone desde Compartir → Añadir a pantalla de inicio.
          </p>
          <p className="text-xs text-gray-500 mt-4">Sin un entorno compatible no es posible usar el panel operativo.</p>
        </div>
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div className={shellClass}>
        <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-gray-100 text-center max-h-[90vh] overflow-y-auto">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-rojo-andino/10 flex items-center justify-center mb-4">
            <ShieldAlert className="w-8 h-8 text-rojo-andino" />
          </div>
          <h2 className="text-xl font-black text-gray-900">Notificaciones bloqueadas</h2>
          <p className="text-sm text-gray-800 mt-2 font-semibold">
            Activación necesaria: sin notificaciones no podrás recibir órdenes. Debes permitirlas en el navegador o en el sistema.
          </p>
          <DeniedHelpPanels ios={isIOS()} />
          <button
            type="button"
            onClick={() => void requestPermission()}
            className="mt-6 w-full py-3 rounded-2xl bg-rojo-andino text-white font-bold hover:bg-rojo-andino/90"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!isWebPushEnvironment()) {
    return (
      <div className={shellClass}>
        <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-gray-100 text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mb-4">
            <ShieldAlert className="w-8 h-8 text-amber-700" />
          </div>
          <h2 className="text-xl font-black text-gray-900">Entorno restringido</h2>
          <p className="text-sm text-gray-600 mt-2 leading-relaxed">
            Hace falta <strong>HTTPS</strong> (o localhost), permisos del navegador y, en iPhone, abrir la app desde el ícono de{' '}
            <strong>pantalla de inicio</strong> (PWA).
          </p>
          <p className="text-xs text-gray-500 mt-4">Sin estas condiciones no se pueden activar las alertas obligatorias.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-gray-100 text-center">
        <div className="mb-4 px-3 py-2 rounded-xl bg-amber-100 border border-amber-300">
          <p className="text-xs font-bold text-amber-800 uppercase">Panel operativo</p>
        </div>
        <div className="mx-auto w-16 h-16 rounded-2xl bg-rojo-andino/10 flex items-center justify-center mb-4">
          <BellRing className="w-8 h-8 text-rojo-andino" />
        </div>
        <h2 className="text-xl font-black text-gray-900">Activación necesaria</h2>
        <p className="text-sm font-semibold text-gray-900 mt-2 leading-relaxed">
          Sin notificaciones no podrás recibir órdenes.
        </p>
        {step === 'intro' ? (
          <>
            <p className="text-sm text-gray-600 mt-3 leading-relaxed text-left">
              Las alertas push son el canal oficial para pedidos en tiempo real, asignación de carreras y avisos críticos. Actívalas
              para poder trabajar con la Central y los clientes.
            </p>
            <button
              type="button"
              onClick={() => setStep('browser')}
              className="mt-6 w-full py-3 rounded-2xl bg-rojo-andino text-white font-bold hover:bg-rojo-andino/90"
            >
              Siguiente
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600 mt-3 leading-relaxed">
              A continuación el navegador mostrará un cuadro de permiso. Debes elegir <strong>Permitir</strong> para registrar este
              dispositivo y recibir órdenes.
            </p>
            <button
              type="button"
              onClick={() => void requestPermission()}
              disabled={loading}
              className="mt-6 w-full py-3 rounded-2xl bg-rojo-andino text-white font-bold hover:bg-rojo-andino/90 disabled:opacity-70"
            >
              {loading ? 'Activando…' : 'Permitir notificaciones'}
            </button>
            <button
              type="button"
              onClick={() => setStep('intro')}
              className="mt-3 w-full py-2 text-sm font-medium text-gray-500 hover:text-gray-800"
            >
              Volver
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function NotificationShield() {
  const { user, loading: authLoading } = useAuth();

  if (authLoading || !user) return null;
  if (!OPERATIONAL_ROLES.has(user.rol)) return null;
  if (user.rol === 'rider' && user.riderStatus !== 'approved') return null;

  return <NotificationShieldWithHooks user={user} />;
}
