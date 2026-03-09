'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { getFCMToken, getFCMTokenWithRetry, setupFCMForegroundListener } from '@/lib/fcm-client';
import { getIdToken } from '@/lib/authToken';

export type NotificationRole = 'central' | 'rider' | 'restaurant' | 'user';

export type NotificationPermission = 'granted' | 'denied' | 'default';

const OPTED_OUT_KEY = 'andina_notifications_opted_out';

function getOptedOut(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(OPTED_OUT_KEY) === '1';
  } catch {
    return false;
  }
}

export function useNotifications(role: NotificationRole, options?: { localId?: string }) {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optedOut, setOptedOut] = useState(false);
  const lastRegisteredTokenRef = useRef<string | null>(null);

  useEffect(() => {
    setOptedOut(getOptedOut());
  }, []);

  const registerToken = useCallback(async (fcmToken: string | null, silent = false, extraPayloadOverride?: Record<string, string>): Promise<boolean> => {
    if (!fcmToken) return false;
    try {
      const idToken = await getIdToken();
      if (!idToken) {
        if (typeof window !== 'undefined') console.warn('[FCM] registerToken: sin sesión (getIdToken null)');
        if (!silent) setError('Sesión expirada. Recargá la página e intentá de nuevo.');
        return false;
      }
      const body: Record<string, string> = { token: fcmToken, role };
      const extra = extraPayloadOverride ?? (options?.localId ? { localId: options.localId } : undefined);
      if (extra) Object.assign(body, extra);
      const res = await fetch('/api/fcm/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        lastRegisteredTokenRef.current = fcmToken;
        setError(null);
        if (typeof window !== 'undefined') console.log('[FCM] Token enviado al servidor');
        return true;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      const errMsg = data?.error ?? 'No se pudo registrar. Intentá de nuevo.';
      if (!silent) setError(errMsg);
      if (typeof errMsg === 'string' && /unregistered|invalid|token|inválido/.test(errMsg.toLowerCase())) {
        lastRegisteredTokenRef.current = null;
      }
      return false;
    } catch {
      if (!silent) setError('No se pudo registrar. Intentá de nuevo.');
      return false;
    }
  }, [role, options?.localId]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission((Notification.permission as NotificationPermission) ?? 'default');
    }
  }, []);

  useEffect(() => {
    if (permission !== 'granted') return;
    let cleanup: (() => void) | undefined;
    setupFCMForegroundListener().then((c) => {
      cleanup = c;
    });
    return () => {
      cleanup?.();
    };
  }, [permission]);

  // Re-sincronizar token al abrir la app o recuperar foco: si el token cambió o fue invalidado, se registra de nuevo.
  useEffect(() => {
    if (typeof window === 'undefined' || permission !== 'granted' || optedOut) return;
    const syncToken = () => {
      getFCMToken().then((token) => {
        if (!token) return;
        if (lastRegisteredTokenRef.current !== token) {
          lastRegisteredTokenRef.current = null;
          registerToken(token, true);
        }
      });
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') syncToken();
    };
    document.addEventListener('visibilitychange', onVisibility);
    syncToken();
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [permission, optedOut, registerToken]);

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setError('Tu navegador no soporta notificaciones');
      return;
    }
    try {
      localStorage.removeItem(OPTED_OUT_KEY);
    } catch {
      /* Silencioso en móvil */
    }
    setOptedOut(false);
    setLoading(true);
    setError(null);
    try {
      const result = await Notification.requestPermission();
      setPermission(result as NotificationPermission);
      if (result === 'denied') {
        setError('Rechazaste las notificaciones. Podés activarlas después en la configuración del navegador.');
        return;
      }
      if (result === 'granted') {
        const token = await getFCMTokenWithRetry({ maxAttempts: 3, delayMs: 2000 });
        if (token) {
          const maxRegisterAttempts = 3;
          const registerDelayMs = 2000;
          let registered = await registerToken(token, true);
          for (let attempt = 1; !registered && attempt < maxRegisterAttempts; attempt++) {
            await new Promise((r) => setTimeout(r, registerDelayMs));
            registered = await registerToken(token, true);
          }
        }
      }
    } catch {
      setError('No se pudo activar las notificaciones');
    } finally {
      setLoading(false);
    }
  }, [registerToken]);

  /** Reintenta obtener el token FCM y registrarlo (sin pedir permiso). Para el botón "Reintentar" cuando permission ya es granted. */
  const reintentarRegistro = useCallback(async (): Promise<boolean> => {
    if (permission !== 'granted' || optedOut) return false;
    const token = await getFCMTokenWithRetry();
    if (!token) return false;
    return registerToken(token, true);
  }, [permission, optedOut, registerToken]);

  const desactivar = useCallback(async () => {
    try {
      const idToken = await getIdToken();
      if (!idToken) return;
      const res = await fetch('/api/fcm/unregister', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ role }),
      });
      if (res.ok) {
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(OPTED_OUT_KEY, '1');
          } catch {
            /* Silencioso en móvil */
          }
        }
        setOptedOut(true);
        setError(null);
      }
    } catch {
      setError('No se pudo desactivar. Intentá de nuevo.');
    }
  }, [role]);

  const isSupported = typeof window !== 'undefined' && 'Notification' in window;

  return {
    permission,
    loading,
    error,
    isSupported,
    optedOut,
    requestPermission,
    reintentarRegistro,
    desactivar,
    registerToken,
  };
}
