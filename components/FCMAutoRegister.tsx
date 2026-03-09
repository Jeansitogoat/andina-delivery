'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/useAuth';
import { getIdToken } from '@/lib/authToken';
import { getFCMTokenWithRetry } from '@/lib/fcm-client';

const OPTED_OUT_KEY = 'andina_notifications_opted_out';

/**
 * Si el usuario ya dio permisos pero no tiene token en Firestore, intenta obtenerlo y registrarlo en segundo plano (silencioso).
 * Solo para rol cliente (user). Se ejecuta al montar y al recuperar foco.
 */
export default function FCMAutoRegister() {
  const { user } = useAuth();
  const triedThisSessionRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !user || user.rol !== 'cliente') return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      if (localStorage.getItem(OPTED_OUT_KEY) === '1') return;
    } catch {
      /* Silencioso en móvil (modo privado, WebView, etc.) */
    }

    const tryRegister = async () => {
      try {
        const idToken = await getIdToken();
        if (!idToken) return;
        const res = await fetch('/api/fcm/status', {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!res.ok) return;
        const data = (await res.json()) as { hasToken?: boolean };
        if (data.hasToken) return;

        const token = await getFCMTokenWithRetry({ maxAttempts: 3, delayMs: 2000 });
        if (!token) return;
        const registerPayload = () =>
          fetch('/api/fcm/register', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({ token, role: 'user' }),
          });
        let regRes = await registerPayload();
        for (let attempt = 1; !regRes.ok && attempt < 3; attempt++) {
          await new Promise((r) => setTimeout(r, 2000));
          regRes = await registerPayload();
        }
      } catch {
        // silencioso
      }
    };

    const run = () => {
      if (triedThisSessionRef.current) return;
      triedThisSessionRef.current = true;
      tryRegister();
    };

    run();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        triedThisSessionRef.current = false;
        tryRegister();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [user]);

  return null;
}
