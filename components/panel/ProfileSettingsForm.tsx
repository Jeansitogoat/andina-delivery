'use client';

import { useState, useEffect, useCallback } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import { Lock, Loader2, User as UserIcon, Phone } from 'lucide-react';
import PasswordInput from '@/components/PasswordInput';
import { getIdToken } from '@/lib/authToken';
import { getFirebaseAuth } from '@/lib/firebase/client';
import { useAuth } from '@/lib/useAuth';
import {
  hasEmailPasswordProvider,
  validatePasswordChangeFields,
  mapFirebasePasswordError,
} from '@/lib/passwordChangeHelpers';
import { LoadingButton } from '@/components/LoadingButton';
import { useNotifications, isFCMPWA } from '@/lib/useNotifications';
import { getFCMTokenWithRetry } from '@/lib/fcm-client';

const GOOGLE_LINK_MESSAGE =
  'Tu cuenta está vinculada a Google. Puedes gestionar tu seguridad directamente desde tu perfil de Google.';

type ProfileSettingsFormProps = {
  /** Tono visual del panel */
  variant?: 'rider' | 'central' | 'default';
  className?: string;
  notificationRole?: 'rider' | 'central' | 'user';
};

const variantTitle: Record<NonNullable<ProfileSettingsFormProps['variant']>, string> = {
  rider: 'Tu perfil',
  central: 'Tu perfil',
  default: 'Tu perfil',
};

export default function ProfileSettingsForm({
  variant = 'default',
  className = '',
  notificationRole = 'user',
}: ProfileSettingsFormProps) {
  const { user: andinaUser, refreshUser } = useAuth();
  const {
    permission,
    requestPermission,
    reintentarRegistro,
    resincronizarNotificaciones,
    loading: notifLoading,
    error: notifError,
    pendingRegister: notifPendingRegister,
    resyncing: notifResyncing,
    isSupported,
  } = useNotifications(notificationRole);
  const [displayName, setDisplayName] = useState('');
  const [telefono, setTelefono] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ tipo: 'ok' | 'error'; text: string } | null>(null);

  const [passwordActual, setPasswordActual] = useState('');
  const [passwordNueva, setPasswordNueva] = useState('');
  const [passwordNuevaConfirm, setPasswordNuevaConfirm] = useState('');
  const [cambiandoPassword, setCambiandoPassword] = useState(false);
  const [mensajePassword, setMensajePassword] = useState<{ tipo: 'ok' | 'error'; text: string } | null>(null);
  const [fbUserState, setFbUserState] = useState<FirebaseUser | null>(null);
  const [tokenActivo, setTokenActivo] = useState<boolean | null>(null);
  const [syncingDevice, setSyncingDevice] = useState(false);

  useEffect(() => {
    const auth = getFirebaseAuth();
    setFbUserState(auth.currentUser);
    return auth.onAuthStateChanged((u) => setFbUserState(u));
  }, []);

  useEffect(() => {
    if (!andinaUser) return;
    setDisplayName(andinaUser.displayName?.trim() ?? '');
    setTelefono(andinaUser.telefono?.trim() ?? '');
  }, [andinaUser]);

  useEffect(() => {
    if (notificationRole === 'user' || permission !== 'granted') {
      setTokenActivo(null);
      return;
    }
    let cancelled = false;
    const loadStatus = async () => {
      const tok = await getIdToken();
      if (!tok || cancelled) return;
      const stored =
        typeof window !== 'undefined'
          ? localStorage.getItem(`andina_fcm_token_${notificationRole}`) ?? ''
          : '';
      const res = await fetch(`/api/fcm/status?role=${notificationRole}`, {
        headers: {
          Authorization: `Bearer ${tok}`,
          ...(stored ? { 'x-fcm-token': stored } : {}),
        },
      }).catch(() => null);
      if (!res || !res.ok || cancelled) {
        if (!cancelled) setTokenActivo(false);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { hasCurrentToken?: boolean };
      if (!cancelled) {
        setTokenActivo(Boolean(data.hasCurrentToken));
      }
    };
    loadStatus();
    return () => {
      cancelled = true;
    };
  }, [notificationRole, permission, notifLoading]);

  const saveProfile = useCallback(async () => {
    setProfileMessage(null);
    const tok = await getIdToken();
    if (!tok) {
      setProfileMessage({ tipo: 'error', text: 'Sesión no válida. Vuelve a iniciar sesión.' });
      return;
    }
    setSavingProfile(true);
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tok}`,
        },
        body: JSON.stringify({
          displayName: displayName.trim() || undefined,
          telefono: telefono.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProfileMessage({
          tipo: 'error',
          text: typeof data?.error === 'string' ? data.error : 'No se pudo guardar.',
        });
        return;
      }
      await refreshUser();
      setProfileMessage({ tipo: 'ok', text: 'Perfil actualizado.' });
    } catch {
      setProfileMessage({ tipo: 'error', text: 'Error de conexión.' });
    } finally {
      setSavingProfile(false);
    }
  }, [displayName, telefono, refreshUser]);

  async function handleCambiarPassword(e: React.FormEvent) {
    e.preventDefault();
    setMensajePassword(null);
    const v = validatePasswordChangeFields({
      passwordActual,
      passwordNueva,
      passwordNuevaConfirm,
    });
    if (!v.ok) {
      setMensajePassword({ tipo: 'error', text: v.message });
      return;
    }
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (!user?.email) {
      setMensajePassword({
        tipo: 'error',
        text: 'Solo puedes cambiar la contraseña si iniciaste sesión con correo.',
      });
      return;
    }
    setCambiandoPassword(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, passwordActual);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, passwordNueva);
      setMensajePassword({ tipo: 'ok', text: 'Contraseña actualizada.' });
      setPasswordActual('');
      setPasswordNueva('');
      setPasswordNuevaConfirm('');
    } catch (err: unknown) {
      setMensajePassword({ tipo: 'error', text: mapFirebasePasswordError(err) });
    } finally {
      setCambiandoPassword(false);
    }
  }

  const showPasswordForm = hasEmailPasswordProvider(fbUserState);
  const showGoogleMessage = fbUserState && !showPasswordForm;

  const syncCurrentDevice = useCallback(async () => {
    setSyncingDevice(true);
    try {
      if (permission !== 'granted') {
        await requestPermission();
      } else {
        await reintentarRegistro();
      }
      const token = await getFCMTokenWithRetry({ maxAttempts: 3, delayMs: 1500 });
      if (token && typeof window !== 'undefined') {
        localStorage.setItem(`andina_fcm_token_${notificationRole}`, token);
      }
      const tok = await getIdToken();
      if (tok) {
        const res = await fetch(`/api/fcm/status?role=${notificationRole}`, {
          headers: {
            Authorization: `Bearer ${tok}`,
            ...(token ? { 'x-fcm-token': token } : {}),
          },
        }).catch(() => null);
        const data = res && res.ok ? ((await res.json().catch(() => ({}))) as { hasCurrentToken?: boolean }) : null;
        setTokenActivo(Boolean(data?.hasCurrentToken));
      }
    } finally {
      setSyncingDevice(false);
    }
  }, [notificationRole, permission, requestPermission, reintentarRegistro]);

  const ring =
    variant === 'rider'
      ? 'border-rider-200 focus:ring-rider-500/30'
      : variant === 'central'
        ? 'border-gray-200 focus:ring-rojo-andino/30'
        : 'border-gray-200 focus:ring-rojo-andino/30';

  return (
    <div className={`space-y-6 ${className}`}>
      <section className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 p-4 pb-2">
          <UserIcon className="w-4 h-4 text-rojo-andino" />
          <span className="font-semibold text-gray-900">{variantTitle[variant]}</span>
        </div>
        <p className="text-xs text-gray-500 px-4 pb-3">Nombre y teléfono visibles para la operación (Andina).</p>
        <div className="px-4 pb-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nombre</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 ${ring}`}
              autoComplete="name"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Phone className="w-3.5 h-3.5" />
              Teléfono
            </label>
            <input
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="+593 ..."
              className={`w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 ${ring}`}
              autoComplete="tel"
            />
          </div>
          {profileMessage && (
            <p
              className={`text-sm font-medium ${
                profileMessage.tipo === 'ok' ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {profileMessage.text}
            </p>
          )}
          <LoadingButton
            type="button"
            onClick={() => void saveProfile()}
            loading={savingProfile}
            className="w-full py-2.5 rounded-xl bg-rojo-andino text-white text-sm font-semibold hover:bg-rojo-andino/90 disabled:opacity-70"
          >
            Guardar perfil
          </LoadingButton>
        </div>
      </section>

      {notificationRole !== 'user' && (
        <section className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 p-4 pb-2">
            <Phone className="w-4 h-4 text-rojo-andino" />
            <span className="font-semibold text-gray-900">Estado del dispositivo</span>
          </div>
          <div className="px-4 pb-4 space-y-3">
            <p className="text-sm text-gray-600">
              Permiso: <strong>{permission === 'granted' ? 'Activo' : permission === 'denied' ? 'Bloqueado' : 'Pendiente'}</strong>
            </p>
            <p className="text-sm text-gray-600">
              Token actual: <strong>{permission !== 'granted' ? 'Sin permiso' : tokenActivo ? 'Activo' : 'No sincronizado'}</strong>
            </p>
            {(notifError || notifPendingRegister) && (
              <p className="text-sm text-red-600 font-medium">{notifError ?? 'Sincronización pendiente con el servidor.'}</p>
            )}
            {!isSupported && (
              <p className="text-sm text-amber-700">Este navegador no soporta notificaciones push.</p>
            )}
            <button
              type="button"
              disabled={syncingDevice || notifLoading}
              onClick={() => void syncCurrentDevice()}
              className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-70"
            >
              {syncingDevice ? 'Sincronizando...' : 'Sincronizar dispositivo'}
            </button>
            {(notifError || notifPendingRegister) && isFCMPWA() && (
              <button
                type="button"
                disabled={notifResyncing || notifLoading || syncingDevice}
                onClick={() => void resincronizarNotificaciones()}
                className="w-full py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 disabled:opacity-60 shadow-sm"
              >
                {notifResyncing ? 'Re-sincronizando…' : 'Re-sincronizar notificaciones'}
              </button>
            )}
          </div>
        </section>
      )}

      <section className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 p-4 pb-2">
          <Lock className="w-4 h-4 text-rojo-andino" />
          <span className="font-semibold text-gray-900">Seguridad</span>
        </div>

        {fbUserState === null && (
          <div className="mx-4 mb-4 h-20 rounded-xl bg-gray-100 animate-pulse" aria-hidden />
        )}
        {fbUserState !== null && showGoogleMessage && (
          <p className="text-sm text-gray-600 px-4 pb-4 leading-relaxed">{GOOGLE_LINK_MESSAGE}</p>
        )}

        {fbUserState !== null && showPasswordForm && (
          <>
            <p className="text-xs text-gray-500 px-4 pb-3">
              Por seguridad, ingresa tu contraseña actual antes de cambiarla.
            </p>
            <form onSubmit={handleCambiarPassword} className="px-4 pb-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Contraseña actual</label>
                <PasswordInput
                  value={passwordActual}
                  onChange={(e) => setPasswordActual(e.target.value)}
                  placeholder="••••••••"
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rojo-andino/30"
                  autoComplete="current-password"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nueva contraseña (mín. 6)</label>
                <PasswordInput
                  value={passwordNueva}
                  onChange={(e) => setPasswordNueva(e.target.value)}
                  placeholder="••••••••"
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rojo-andino/30"
                  autoComplete="new-password"
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Confirmar nueva contraseña</label>
                <PasswordInput
                  value={passwordNuevaConfirm}
                  onChange={(e) => setPasswordNuevaConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-rojo-andino/30"
                  autoComplete="new-password"
                  minLength={6}
                />
              </div>
              {mensajePassword && (
                <p
                  className={`text-sm font-medium ${
                    mensajePassword.tipo === 'ok' ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {mensajePassword.text}
                </p>
              )}
              <button
                type="submit"
                disabled={cambiandoPassword}
                className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-70 inline-flex items-center justify-center gap-2"
              >
                {cambiandoPassword ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Cambiando...
                  </>
                ) : (
                  'Cambiar contraseña'
                )}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
