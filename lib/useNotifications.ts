'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { getFCMToken, getFCMTokenWithRetry, setupFCMForegroundListener, waitForServiceWorker } from '@/lib/fcm-client';
import { getIdToken } from '@/lib/authToken';
import { getFirebaseAuth } from '@/lib/firebase/client';

function isPWA(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches;
}

/**
 * Espera hasta que Firebase Auth tenga un usuario activo con UID disponible.
 * Evita la carrera de velocidad entre Auth y el registro FCM en arranque en frío.
 * Devuelve el uid si se resuelve antes del timeout, o null si no hay usuario.
 */
async function waitForAuthCurrentUser(timeoutMs = 5000): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const auth = getFirebaseAuth();
  // Fast path: ya hay usuario activo
  if (auth.currentUser) return auth.currentUser.uid;
  return new Promise((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        unsub();
        resolve(null);
      }
    }, timeoutMs);
    const unsub = auth.onAuthStateChanged((user) => {
      if (!resolved && user) {
        resolved = true;
        clearTimeout(timer);
        unsub();
        resolve(user.uid);
      }
    });
  });
}

export type NotificationRole = 'central' | 'rider' | 'local' | 'user';

export type NotificationPermission = 'granted' | 'denied' | 'default';

const OPTED_OUT_KEY = 'andina_notifications_opted_out';
const TOKEN_KEY_PREFIX = 'andina_fcm_token_';
const PENDING_REGISTER_KEY = 'andina_fcm_pending_';

function getOptedOut(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(OPTED_OUT_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Clasifica el tipo de error de registro para decidir si reintentar.
 * - 'validation': error de schema Zod → no reintentar
 * - 'auth': 401/403 → marcar pendiente, esperar Auth
 * - 'transient': red/5xx → reintentar con backoff
 */
type RegisterErrorType = 'validation' | 'auth' | 'transient' | 'unknown';

function classifyRegisterError(status: number, errorMsg: string): RegisterErrorType {
  if (status === 401 || status === 403) return 'auth';
  if (status >= 500) return 'transient';
  if (status === 400) {
    // Mensaje de Zod con campo específico → validación real, no reintentar
    if (/token.*requerido|role.*requerido|must be|required|enum|min|max/i.test(errorMsg)) return 'validation';
    // 400 genérico puede ser Auth transitorio (ej: uid no disponible) → reintentar
    return 'transient';
  }
  return 'unknown';
}

export function useNotifications(role: NotificationRole, options?: { localId?: string }) {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optedOut, setOptedOut] = useState(false);
  const lastRegisteredTokenRef = useRef<string | null>(null);
  // pendingRegisterRef: true si el último intento de registro falló por error transitorio
  const pendingRegisterRef = useRef<boolean>(false);

  const storageKey = typeof window !== 'undefined' ? `${TOKEN_KEY_PREFIX}${role}` : TOKEN_KEY_PREFIX;
  const pendingKey = typeof window !== 'undefined' ? `${PENDING_REGISTER_KEY}${role}` : PENDING_REGISTER_KEY;

  const readStoredToken = useCallback((): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem(storageKey) || null;
    } catch {
      return null;
    }
  }, [storageKey]);

  const writeStoredToken = useCallback(
    (token: string | null) => {
      if (typeof window === 'undefined') return;
      try {
        if (token) {
          localStorage.setItem(storageKey, token);
        } else {
          localStorage.removeItem(storageKey);
        }
      } catch {
        // silencioso en móvil / modo privado
      }
    },
    [storageKey]
  );

  const setPendingRegister = useCallback(
    (pending: boolean) => {
      pendingRegisterRef.current = pending;
      if (typeof window === 'undefined') return;
      try {
        if (pending) {
          localStorage.setItem(pendingKey, '1');
        } else {
          localStorage.removeItem(pendingKey);
        }
      } catch {
        // silencioso
      }
    },
    [pendingKey]
  );

  const getPendingRegister = useCallback((): boolean => {
    if (pendingRegisterRef.current) return true;
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(pendingKey) === '1';
    } catch {
      return false;
    }
  }, [pendingKey]);

  useEffect(() => {
    setOptedOut(getOptedOut());
    // Restaurar bandera pendiente al montar (survive page refresh)
    if (typeof window !== 'undefined') {
      try {
        pendingRegisterRef.current = localStorage.getItem(pendingKey) === '1';
      } catch {
        // silencioso
      }
    }
  }, [pendingKey]);

  const registerToken = useCallback(
    async (fcmToken: string | null, silent = false, extraPayloadOverride?: Record<string, string>): Promise<boolean> => {
      if (!fcmToken) return false;
      try {
        // Guardia de Auth: esperar a que Firebase tenga usuario activo antes de enviar
        const uid = await waitForAuthCurrentUser(5000);
        if (!uid) {
          console.warn('[FCM] registerToken: No hay usuario autenticado disponible. Marcando pendiente.');
          setPendingRegister(true);
          return false;
        }
        const idToken = await getIdToken();
        if (!idToken) {
          console.warn('[FCM] registerToken: No se pudo obtener idToken. Marcando pendiente.');
          setPendingRegister(true);
          if (!silent) setError('Sesión expirada. Recarga la página e intenta de nuevo.');
          return false;
        }
        // Payload obligatorio: token + uid + rol (+ localId si rol=local)
        const body: Record<string, string> = { token: fcmToken, role, uid };
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
          writeStoredToken(fcmToken);
          // Limpieza inmediata de estado: el mensaje "token no registrado" desaparece sin recargar
          setPendingRegister(false);
          setError(null);
          console.log('🔥 Token guardado en Firestore. Rol:', role, options?.localId ? `localId:${options.localId}` : '');
          return true;
        }
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        const errMsg = data?.error ?? 'No se pudo registrar. Intenta de nuevo.';
        const errorType = classifyRegisterError(res.status, errMsg);

        if (errorType === 'validation') {
          // Error de validación Zod: no reintentar, es un bug de payload
          console.error('[FCM] registerToken: Error de validación Zod:', errMsg);
          if (!silent) setError(errMsg);
          return false;
        }
        // Error transitorio (red, Auth, 5xx): marcar pendiente silenciosamente
        console.warn('[FCM] registerToken: Error transitorio (', res.status, '), marcando pendiente:', errMsg);
        setPendingRegister(true);
        if (typeof errMsg === 'string' && /unregistered|invalid|token|inválido/.test(errMsg.toLowerCase())) {
          lastRegisteredTokenRef.current = null;
          writeStoredToken(null);
        }
        return false;
      } catch (e) {
        // Error de red (ERR_NAME_NOT_RESOLVED, fetch error, timeout, etc.)
        const msg = e instanceof Error ? e.message : String(e);
        console.warn('[FCM] registerToken: Error de red, marcando pendiente:', msg);
        setPendingRegister(true);
        return false;
      }
    },
    [role, options?.localId, writeStoredToken, setPendingRegister]
  );

  /**
   * Registra token con backoff exponencial silencioso: inmediato → 2s → 5s.
   * No muestra errores rojos al usuario por fallos transitorios.
   */
  const registerWithBackoff = useCallback(
    async (fcmToken: string): Promise<boolean> => {
      const delays = [0, 2000, 5000];
      for (let i = 0; i < delays.length; i++) {
        if (delays[i] > 0) {
          console.log(`[FCM] Backoff: esperando ${delays[i] / 1000}s antes del intento ${i + 1}/${delays.length}...`);
          await new Promise((r) => setTimeout(r, delays[i]));
        }
        const ok = await registerToken(fcmToken, true);
        if (ok) return true;
      }
      console.warn('[FCM] Registro pendiente tras backoff 0/2s/5s. Se reintentará al recuperar conexión o foco.');
      return false;
    },
    [registerToken]
  );

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission((Notification.permission as NotificationPermission) ?? 'default');
    }
  }, []);

  useEffect(() => {
    if (permission !== 'granted') return;
    if (!isPWA()) return;
    let cleanup: (() => void) | undefined;
    setupFCMForegroundListener().then((c) => {
      cleanup = c;
    });
    return () => {
      cleanup?.();
    };
  }, [permission]);

  // Re-sincronizar token al abrir la app, recuperar foco, o volver online.
  // Si hay un registro pendiente (red caída en arranque en frío), reintenta automáticamente.
  useEffect(() => {
    if (typeof window === 'undefined' || permission !== 'granted' || optedOut) return;
    if (!isPWA()) return;
    // Tras reload, el ref arranca en null y forzaba POST aunque localStorage ya tuviera el mismo token.
    lastRegisteredTokenRef.current = readStoredToken();
    const syncToken = () => {
      getFCMToken().then((token) => {
        if (!token) return;
        const stored = readStoredToken();
        const hasPending = getPendingRegister();
        if (!hasPending && stored === token && lastRegisteredTokenRef.current === token) {
          return;
        }
        lastRegisteredTokenRef.current = null;
        registerToken(token, true);
      });
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') syncToken();
    };
    const onOnline = () => {
      console.log('[FCM] Conexión restaurada. Re-sincronizando token pendiente...');
      syncToken();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
    syncToken();
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
    };
  }, [permission, optedOut, registerToken, readStoredToken, getPendingRegister]);

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setError('Tu navegador no soporta notificaciones');
      return;
    }
    if (!isPWA()) {
      // Fuera de PWA no pedimos nada: evita errores en navegadores móviles
      return;
    }
    // Guardia de Auth: solo pedir permiso si hay usuario autenticado listo
    const uid = await waitForAuthCurrentUser(5000);
    if (!uid) {
      console.warn('[FCM] requestPermission: No hay usuario autenticado. Abortando solicitud de permiso.');
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
        setError('Rechazaste las notificaciones. Puedes activarlas después en la configuración del navegador.');
        return;
      }
      if (result === 'granted') {
        console.log('[FCM] Permiso concedido. Esperando sincronización...');
        // Delay táctico: da tiempo al navegador para propagar el permiso al SDK de Firebase
        await new Promise((resolve) => setTimeout(resolve, 800));
        // Esperar a que el Service Worker FCM esté activo y validado
        await waitForServiceWorker();
        console.log('[FCM] SW listo. Obteniendo token...');
        const token = await getFCMTokenWithRetry({ maxAttempts: 3, delayMs: 2000 });
        if (token) {
          console.log('[FCM] Token generado:', token.slice(0, 20) + '...');
          const registered = await registerWithBackoff(token);
          if (registered) {
            console.log('[FCM] ÉXITO en Firestore.');
          } else {
            console.warn('[FCM] Registro pendiente. Se reintentará al recuperar foco o conexión.');
          }
        } else {
          console.warn('[FCM] No se obtuvo token FCM tras 3 intentos.');
        }
      }
    } catch {
      setError('No se pudo activar las notificaciones');
    } finally {
      setLoading(false);
    }
  }, [registerWithBackoff]);

  /** Reintenta obtener el token FCM y registrarlo (sin pedir permiso). Para el botón "Reintentar" cuando permission ya es granted. */
  const reintentarRegistro = useCallback(async (): Promise<boolean> => {
    if (permission !== 'granted' || optedOut) return false;
    const token = await getFCMTokenWithRetry();
    if (!token) return false;
    return registerWithBackoff(token);
  }, [permission, optedOut, registerWithBackoff]);

  const desactivar = useCallback(async () => {
    try {
      const idToken = await getIdToken();
      if (!idToken) return;
      const token = readStoredToken() ?? (await getFCMToken());
      if (!token) {
        setError('No se encontró el token del dispositivo actual.');
        return;
      }
      const res = await fetch('/api/fcm/unregister', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ role, token }),
      });
      if (res.ok) {
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(OPTED_OUT_KEY, '1');
          } catch {
            /* Silencioso en móvil */
          }
        }
        setPendingRegister(false);
        setOptedOut(true);
        setError(null);
      }
    } catch {
      setError('No se pudo desactivar. Intenta de nuevo.');
    }
  }, [role, setPendingRegister, readStoredToken]);

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
