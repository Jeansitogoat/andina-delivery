'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  getFCMToken,
  setupFCMForegroundListener,
  waitForServiceWorkerWithTimeout,
} from '@/lib/fcm-client';
import { getIdToken } from '@/lib/authToken';
import { getFirebaseAuth } from '@/lib/firebase/client';

/** PWA instalada (atajo desde pantalla de inicio). */
export function isFCMPWA(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches;
}

/**
 * Entorno donde FCM web puede funcionar: contexto seguro (HTTPS/localhost),
 * API de notificaciones y Service Workers. Incluye Chrome/Edge en escritorio sin instalar PWA.
 */
export function isWebPushEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  if (!('Notification' in window)) return false;
  if (!('serviceWorker' in navigator)) return false;
  if (!window.isSecureContext) return false;
  return true;
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
const TOKEN_GET_TIMEOUT_MS = 10_000;
const REGISTER_FETCH_TIMEOUT_MS = 20_000;

/** getToken acotado en tiempo; evita tablets colgadas sin feedback. */
function raceGetFCMToken(timeoutMs: number): Promise<{ token: string | null; timedOut: boolean }> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (token: string | null, timedOut: boolean) => {
      if (settled) return;
      settled = true;
      resolve({ token, timedOut });
    };
    const timer = setTimeout(() => done(null, true), timeoutMs);
    getFCMToken()
      .then((token) => {
        clearTimeout(timer);
        done(token, false);
      })
      .catch(() => {
        clearTimeout(timer);
        done(null, false);
      });
  });
}

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
  const pendingRegisterRef = useRef<boolean>(false);
  const [pendingRegister, setPendingRegisterUi] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  /** null = sin comprobar; true/false según /api/fcm/status (y coincidencia con token local si existe). */
  const [serverTokenRegistered, setServerTokenRegistered] = useState<boolean | null>(null);

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
      setPendingRegisterUi(pending);
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
    if (typeof window !== 'undefined') {
      try {
        const p = localStorage.getItem(pendingKey) === '1';
        pendingRegisterRef.current = p;
        setPendingRegisterUi(p);
      } catch {
        // silencioso
      }
    }
  }, [pendingKey]);

  const refreshServerTokenStatus = useCallback(async () => {
    if (typeof window === 'undefined' || permission !== 'granted' || optedOut) {
      setServerTokenRegistered(null);
      return;
    }
    if (!isWebPushEnvironment()) {
      setServerTokenRegistered(null);
      return;
    }
    const idToken = await getIdToken();
    if (!idToken) {
      setServerTokenRegistered(null);
      return;
    }
    const stored = readStoredToken() ?? '';
    const res = await fetch(`/api/fcm/status?role=${encodeURIComponent(role)}`, {
      headers: {
        Authorization: `Bearer ${idToken}`,
        ...(stored ? { 'x-fcm-token': stored } : {}),
      },
    }).catch(() => null);
    if (!res?.ok) {
      setServerTokenRegistered(null);
      return;
    }
    const data = (await res.json().catch(() => ({}))) as {
      hasToken?: boolean;
      hasCurrentToken?: boolean | null;
    };
    if (stored && typeof data.hasCurrentToken === 'boolean') {
      setServerTokenRegistered(data.hasCurrentToken);
    } else {
      setServerTokenRegistered(Boolean(data.hasToken));
    }
  }, [permission, optedOut, role, readStoredToken]);

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
        const abortCtl = new AbortController();
        const registerTimer = setTimeout(() => abortCtl.abort(), REGISTER_FETCH_TIMEOUT_MS);
        let res: Response;
        try {
          res = await fetch('/api/fcm/register', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify(body),
            signal: abortCtl.signal,
          });
        } catch (e) {
          clearTimeout(registerTimer);
          const aborted =
            (e instanceof Error && e.name === 'AbortError') ||
            (typeof DOMException !== 'undefined' && e instanceof DOMException && e.name === 'AbortError');
          if (aborted) {
            console.warn('[FCM] registerToken: timeout en /api/fcm/register');
            setPendingRegister(true);
            if (!silent) setError('Tiempo de espera agotado al registrar el dispositivo.');
            return false;
          }
          throw e;
        }
        clearTimeout(registerTimer);
        if (res.ok) {
          lastRegisteredTokenRef.current = fcmToken;
          writeStoredToken(fcmToken);
          // Limpieza inmediata de estado: el mensaje "token no registrado" desaparece sin recargar
          setPendingRegister(false);
          setError(null);
          console.log('🔥 Token guardado en Firestore. Rol:', role, options?.localId ? `localId:${options.localId}` : '');
          void refreshServerTokenStatus();
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
    [role, options?.localId, writeStoredToken, setPendingRegister, refreshServerTokenStatus]
  );

  /**
   * Registra token con backoff: inmediato → 2s → 5s.
   * El primer intento no es silencioso (el usuario ve el error real); 2.º y 3.º sí.
   */
  const registerWithBackoff = useCallback(
    async (fcmToken: string): Promise<boolean> => {
      const delays = [0, 2000, 5000];
      for (let i = 0; i < delays.length; i++) {
        if (delays[i] > 0) {
          console.log(`[FCM] Backoff: esperando ${delays[i] / 1000}s antes del intento ${i + 1}/${delays.length}...`);
          await new Promise((r) => setTimeout(r, delays[i]));
        }
        const silent = i > 0;
        const ok = await registerToken(fcmToken, silent);
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
    if (!isWebPushEnvironment()) return;
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
    if (!isWebPushEnvironment()) return;
    // Tras reload, el ref arranca en null y forzaba POST aunque localStorage ya tuviera el mismo token.
    lastRegisteredTokenRef.current = readStoredToken();
    const syncToken = () => {
      raceGetFCMToken(TOKEN_GET_TIMEOUT_MS).then(async (r) => {
        if (r.timedOut) {
          console.warn('[FCM] Timeout obteniendo token en sync; marcando registro pendiente.');
          setPendingRegister(true);
          return;
        }
        const token = r.token;
        if (!token) return;
        const stored = readStoredToken();
        const hasPending = getPendingRegister();
        const looksSyncedLocally = !hasPending && stored === token && lastRegisteredTokenRef.current === token;
        if (looksSyncedLocally) {
          const idTok = await getIdToken();
          if (idTok) {
            const res = await fetch(`/api/fcm/status?role=${encodeURIComponent(role)}`, {
              headers: {
                Authorization: `Bearer ${idTok}`,
                'x-fcm-token': token,
              },
            }).catch(() => null);
            if (res?.ok) {
              const data = (await res.json().catch(() => ({}))) as {
                hasCurrentToken?: boolean | null;
                hasToken?: boolean;
              };
              if (data.hasCurrentToken === true) {
                if (process.env.NODE_ENV === 'development') {
                  console.log('[FCM] Skip register: token already in server.');
                }
                return;
              }
            }
          }
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
  }, [permission, optedOut, registerToken, readStoredToken, getPendingRegister, role]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (permission !== 'granted' || optedOut || !isWebPushEnvironment()) {
      setServerTokenRegistered(null);
      return;
    }
    if (loading || resyncing) return;
    const t = window.setTimeout(() => {
      void refreshServerTokenStatus();
    }, 400);
    return () => clearTimeout(t);
  }, [permission, optedOut, loading, resyncing, pendingRegister, refreshServerTokenStatus]);

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setError('Tu navegador no soporta notificaciones');
      return;
    }
    if (!isWebPushEnvironment()) {
      setError(
        'Aquí no se pueden activar notificaciones push: hace falta HTTPS (o localhost), Service Workers y permisos del navegador. En iPhone suele hacer falta instalar la app a inicio.'
      );
      return;
    }
    // Guardia de Auth: solo pedir permiso si hay usuario autenticado listo
    const uid = await waitForAuthCurrentUser(5000);
    if (!uid) {
      console.warn('[FCM] requestPermission: No hay usuario autenticado. Abortando solicitud de permiso.');
      setError('Inicia sesión y vuelve a intentar activar notificaciones.');
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
        const swOutcome = await waitForServiceWorkerWithTimeout(15_000);
        if (swOutcome === 'timeout') {
          setError('Tiempo de espera agotado al preparar notificaciones');
          return;
        }
        console.log('[FCM] SW listo. Obteniendo token...');
        let token: string | null = null;
        let sawTimeout = false;
        for (let attempt = 0; attempt < 3 && !token && !sawTimeout; attempt++) {
          if (attempt > 0) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
          const r = await raceGetFCMToken(TOKEN_GET_TIMEOUT_MS);
          if (r.timedOut) {
            sawTimeout = true;
            setError('Tiempo de espera agotado');
            break;
          }
          token = r.token;
        }
        if (token) {
          console.log('[FCM] Token generado:', token.slice(0, 20) + '...');
          const registered = await registerWithBackoff(token);
          void refreshServerTokenStatus();
          if (registered) {
            console.log('[FCM] ÉXITO en Firestore.');
          } else {
            console.warn('[FCM] Registro pendiente. Se reintentará al recuperar foco o conexión.');
            setError((prev) =>
              prev?.trim()
                ? prev
                : 'El permiso está bien, pero el token no se guardó en el servidor. Pulsa «Re-sincronizar» o «Sincronizar dispositivo».'
            );
            setPendingRegister(true);
          }
        } else if (!sawTimeout) {
          console.warn('[FCM] No se obtuvo token FCM tras varios intentos.');
        }
      }
    } catch {
      setError('No se pudo activar las notificaciones');
    } finally {
      setLoading(false);
    }
  }, [registerWithBackoff, refreshServerTokenStatus, setPendingRegister]);

  /** Reintenta obtener el token FCM y registrarlo (sin pedir permiso). Para el botón "Reintentar" cuando permission ya es granted. */
  const reintentarRegistro = useCallback(async (): Promise<boolean> => {
    if (permission !== 'granted' || optedOut) return false;
    const r = await raceGetFCMToken(TOKEN_GET_TIMEOUT_MS);
    if (r.timedOut) {
      setError('Tiempo de espera agotado');
      return false;
    }
    if (!r.token) return false;
    const ok = await registerWithBackoff(r.token);
    void refreshServerTokenStatus();
    return ok;
  }, [permission, optedOut, registerWithBackoff, refreshServerTokenStatus]);

  const resincronizarNotificaciones = useCallback(async () => {
    if (typeof window === 'undefined' || !isWebPushEnvironment()) return;
    if (permission !== 'granted' || optedOut) return;
    setResyncing(true);
    setError(null);
    try {
      lastRegisteredTokenRef.current = null;
      writeStoredToken(null);
      setPendingRegister(false);
      try {
        localStorage.removeItem(storageKey);
        localStorage.removeItem(pendingKey);
      } catch {
        // silencioso
      }
      const { forceRefreshFCMToken } = await import('@/lib/fcm-client');
      const outcome = await new Promise<{ token: string | null; timedOut: boolean }>((resolve) => {
        const timer = setTimeout(() => resolve({ token: null, timedOut: true }), TOKEN_GET_TIMEOUT_MS);
        forceRefreshFCMToken()
          .then((token) => {
            clearTimeout(timer);
            resolve({ token, timedOut: false });
          })
          .catch(() => {
            clearTimeout(timer);
            resolve({ token: null, timedOut: false });
          });
      });
      if (outcome.timedOut) {
        setError('Tiempo de espera agotado');
        setPendingRegister(true);
        return;
      }
      if (!outcome.token) {
        setError('No se pudo obtener un token nuevo. Intenta de nuevo.');
        setPendingRegister(true);
        return;
      }
      const ok = await registerWithBackoff(outcome.token);
      if (!ok) setPendingRegister(true);
      void refreshServerTokenStatus();
    } finally {
      setResyncing(false);
    }
  }, [
    permission,
    optedOut,
    writeStoredToken,
    setPendingRegister,
    pendingKey,
    storageKey,
    registerWithBackoff,
    refreshServerTokenStatus,
  ]);

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
    pendingRegister,
    resyncing,
    serverTokenRegistered,
    refreshServerTokenStatus,
    isSupported,
    optedOut,
    requestPermission,
    reintentarRegistro,
    resincronizarNotificaciones,
    desactivar,
    registerToken,
  };
}
