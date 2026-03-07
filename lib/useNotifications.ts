'use client';

import { useState, useCallback, useEffect } from 'react';
import { getFCMTokenWithRetry, setupFCMForegroundListener } from '@/lib/fcm-client';
import { getIdToken } from '@/lib/authToken';

export type NotificationRole = 'central' | 'rider' | 'restaurant' | 'user';

export type NotificationPermission = 'granted' | 'denied' | 'default';

export function useNotifications(role: NotificationRole) {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        setError(null);
        if (typeof window !== 'undefined') console.log('[FCM] Token enviado al servidor');
        return;
      }
      if (!res.ok) {
        try {
          const data = (await res.json()) as { error?: string };
          setError(data?.error ?? 'No se pudo registrar. Intentá de nuevo.');
        } catch {
          setError('No se pudo registrar. Intentá de nuevo.');
        }
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

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setError('Tu navegador no soporta notificaciones');
      return;
    }
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
    } catch (e) {
      setError('No se pudo activar las notificaciones');
    } finally {
      setLoading(false);
    }
  }, [registerToken]);

  const isSupported = typeof window !== 'undefined' && 'Notification' in window;

  return {
    permission,
    loading,
    error,
    isSupported,
    requestPermission,
    registerToken,
  };
}
