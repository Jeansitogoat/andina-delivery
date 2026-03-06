'use client';

import { useState, useCallback, useEffect } from 'react';
import { getFCMToken, setupFCMForegroundListener } from '@/lib/fcm-client';
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
      if (!idToken) return;
      await fetch('/api/fcm/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ token: fcmToken, role }),
      });
    } catch {
      // API no disponible o no autorizado; se ignorará
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
        const token = await getFCMToken();
        await registerToken(token);
      }
    } catch (e) {
      setError('No se pudo activar las notificaciones');
    } finally {
      setLoading(false);
    }
  }, [role, registerToken]);

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
