'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { getFCMToken, getFCMTokenWithRetry, setupFCMForegroundListener } from '@/lib/fcm-client';
import { getIdToken } from '@/lib/authToken';

export type NotificationRole = 'central' | 'rider' | 'restaurant' | 'user';

export type NotificationPermission = 'granted' | 'denied' | 'default';

const OPTED_OUT_KEY = 'andina_notifications_opted_out';

function getOptedOut(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(OPTED_OUT_KEY) === '1';
}

export function useNotifications(role: NotificationRole) {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optedOut, setOptedOut] = useState(false);
  const lastRegisteredTokenRef = useRef<string | null>(null);

  useEffect(() => {
    setOptedOut(getOptedOut());
  }, []);

  const registerToken = useCallback(async (fcmToken: string | null) => {
    if (!fcmToken) return;
    try {
      const idToken = await getIdToken();
      if (!idToken) {
        if (typeof window !== 'undefined') console.warn('[FCM] registerToken: sin sesión (getIdToken null)');
        setError('Sesión expirada. Recargá la página e intentá de nuevo.');
        return;
      }
      const res = await fetch('/api/fcm/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ token: fcmToken, role }),
      });
      if (res.ok) {
        lastRegisteredTokenRef.current = fcmToken;
        setError(null);
        if (typeof window !== 'undefined') console.log('[FCM] Token enviado al servidor');
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      const errMsg = data?.error ?? 'No se pudo registrar. Intentá de nuevo.';
      setError(errMsg);
      if (typeof errMsg === 'string' && /unregistered|invalid|token|inválido/.test(errMsg.toLowerCase())) {
        lastRegisteredTokenRef.current = null;
      }
    } catch {
      setError('No se pudo registrar. Intentá de nuevo.');
    }
  }, [role]);

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
          registerToken(token);
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
    localStorage.removeItem(OPTED_OUT_KEY);
    setOptedOut(false);
    setLoading(true);
    setError(null);
    try {
      const result = await Notification.requestPermission();
      setPermission(result as NotificationPermission);
      if (result === 'granted') {
        const token = await getFCMTokenWithRetry({ maxAttempts: 3, delayMs: 1500 });
        if (!token) {
          setError('No se pudo obtener el token de notificaciones. Verificá que NEXT_PUBLIC_FIREBASE_VAPID_KEY esté configurada.');
          return;
        }
        await registerToken(token);
      }
    } catch {
      setError('No se pudo activar las notificaciones');
    } finally {
      setLoading(false);
    }
  }, [registerToken]);

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
          localStorage.setItem(OPTED_OUT_KEY, '1');
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
    desactivar,
    registerToken,
  };
}
