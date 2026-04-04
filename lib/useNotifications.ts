'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  getFCMToken,
  setupFCMForegroundListener,
  waitForServiceWorkerWithTimeout,
} from '@/lib/fcm-client';
import { getIdToken } from '@/lib/authToken';
import { getFirebaseAuth } from '@/lib/firebase/client';
import { useAuth } from '@/lib/useAuth';
import { effectiveNotificationRole } from '@/lib/fcmEffectiveRole';

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
/**
 * Presupuesto único para SW + getToken: toques cortos (10s) cortaban la promesa mientras el SW aún cargaba.
 * Aplica a botón del usuario, reintento y sync en segundo plano.
 */
const FCM_GET_TOKEN_BUDGET_MS = 55_000;
const REGISTER_FETCH_TIMEOUT_MS = 20_000;
/** La comprobación /api/fcm/status no debe bloquear el registro más de esto. */
const FCM_STATUS_PROBE_MS = 3_000;
/** Evita disparar getToken al cambiar de pestaña cada pocos segundos. */
const FCM_VISIBILITY_SYNC_COOLDOWN_MS = 120_000;

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

/** GET /api/fcm/status acotado: si tarda o falla, el caller sigue con el registro. */
async function fetchFcmStatusProbe(
  fcmRole: NotificationRole,
  idTok: string,
  fcmToken: string
): Promise<{ hasCurrentToken?: boolean | null; hasToken?: boolean } | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FCM_STATUS_PROBE_MS);
  try {
    const res = await fetch(`/api/fcm/status?role=${encodeURIComponent(fcmRole)}`, {
      headers: {
        Authorization: `Bearer ${idTok}`,
        'x-fcm-token': fcmToken,
      },
      signal: ctl.signal,
    });
    if (!res.ok) return null;
    return (await res.json().catch(() => ({}))) as { hasCurrentToken?: boolean | null; hasToken?: boolean };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
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
  const { user, loading: authLoading } = useAuth();

  /** Página de operador de local: exige rol local + localId antes de POST /register. */
  const expectsLocalRegister = role === 'local' || Boolean(options?.localId?.trim());

  const fcmRole: NotificationRole = useMemo(() => {
    const routedAsLocal = role === 'local' || Boolean(options?.localId?.trim());
    if (authLoading || !user) {
      return routedAsLocal ? 'local' : role;
    }
    if (user.rol === 'local') return 'local';
    if (routedAsLocal) return 'local';
    return effectiveNotificationRole(user);
  }, [authLoading, user, role, options?.localId]);

  const effectiveLocalId = useMemo(() => {
    const fromOpts = options?.localId?.trim();
    const fromUser = user?.localId?.trim();
    return (fromOpts || fromUser || '').trim();
  }, [options?.localId, user?.localId]);

  /** Perfil listo para POST: siempre auth resuelto; en contexto local, rol local + id de restaurante. */
  const registrationAllowed =
    !authLoading &&
    user != null &&
    user.rol != null &&
    (!expectsLocalRegister || (user.rol === 'local' && Boolean(effectiveLocalId)));

  /** UI: mostrar carga mientras faltan datos obligatorios para registrar un local. */
  const waitingForFcmProfile =
    expectsLocalRegister &&
    (authLoading || !user || user.rol !== 'local' || !effectiveLocalId);

  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optedOut, setOptedOut] = useState(false);
  const lastRegisteredTokenRef = useRef<string | null>(null);
  const pendingRegisterRef = useRef<boolean>(false);
  const [pendingRegister, setPendingRegisterUi] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  /** null = sin comprobar o error de red; true solo si permiso granted y hasCurrentToken; false si este dispositivo no está en el servidor. */
  const [serverTokenRegistered, setServerTokenRegistered] = useState<boolean | null>(null);
  const registerInFlightRef = useRef(false);
  /** Tras POST /register OK, evita ráfagas automáticas mientras status/index convergen. */
  const registerCooldownUntilRef = useRef(0);
  /** Evita varias carreras raceGetFCMToken en paralelo (visibility + efecto + online). */
  const syncTokenInFlightRef = useRef(false);
  const lastVisibilityFcmSyncRef = useRef(0);
  /** true solo cuando la API confirmó hasCurrentToken para el token de este dispositivo. */
  const serverTokenRegisteredRef = useRef(false);
  const refreshStatusInFlightRef = useRef(false);
  /** Si cambia el rol FCM efectivo (p. ej. rider pending→approved: user→rider), hay que volver a POST /register. */
  const prevFcmRoleRef = useRef<NotificationRole | null>(null);
  useEffect(() => {
    if (prevFcmRoleRef.current !== null && prevFcmRoleRef.current !== fcmRole) {
      lastRegisteredTokenRef.current = null;
    }
    prevFcmRoleRef.current = fcmRole;
  }, [fcmRole]);

  const storageKey = typeof window !== 'undefined' ? `${TOKEN_KEY_PREFIX}${fcmRole}` : TOKEN_KEY_PREFIX;
  const pendingKey = typeof window !== 'undefined' ? `${PENDING_REGISTER_KEY}${fcmRole}` : PENDING_REGISTER_KEY;

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

  useEffect(() => {
    serverTokenRegisteredRef.current = serverTokenRegistered === true;
  }, [serverTokenRegistered]);

  const refreshServerTokenStatus = useCallback(async () => {
    if (typeof window === 'undefined' || permission !== 'granted' || optedOut) {
      setServerTokenRegistered(null);
      return;
    }
    if (!isWebPushEnvironment()) {
      setServerTokenRegistered(null);
      return;
    }
    if (!registrationAllowed) {
      setServerTokenRegistered(null);
      return;
    }
    if (refreshStatusInFlightRef.current) return;
    refreshStatusInFlightRef.current = true;
    try {
      const idToken = await getIdToken();
      if (!idToken) {
        setServerTokenRegistered(null);
        return;
      }
      let deviceToken = (readStoredToken() ?? '').trim();
      if (!deviceToken) {
        const r = await raceGetFCMToken(FCM_GET_TOKEN_BUDGET_MS);
        deviceToken = (r.token ?? '').trim();
      }
      if (!deviceToken) {
        setServerTokenRegistered(false);
        return;
      }
      const data = await fetchFcmStatusProbe(fcmRole, idToken, deviceToken);
      if (!data) {
        setServerTokenRegistered(null);
        return;
      }
      if (typeof data.hasCurrentToken === 'boolean') {
        setServerTokenRegistered(data.hasCurrentToken);
      } else {
        setServerTokenRegistered(false);
      }
    } finally {
      refreshStatusInFlightRef.current = false;
    }
  }, [permission, optedOut, fcmRole, readStoredToken, registrationAllowed]);

  const registerToken = useCallback(
    async (fcmToken: string | null, silent = false, extraPayloadOverride?: Record<string, string>): Promise<boolean> => {
      if (!fcmToken) return false;
      if (!registrationAllowed) return false;
      if (fcmRole === 'local' && !effectiveLocalId) {
        if (!silent) {
          console.warn('[FCM] registerToken omitido: rol local sin localId en perfil o ruta.');
        }
        return false;
      }
      if (registerInFlightRef.current) return false;
      registerInFlightRef.current = true;
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
        const body: Record<string, string> = { token: fcmToken, role: fcmRole, uid };
        const extra =
          extraPayloadOverride ??
          (fcmRole === 'local' && effectiveLocalId ? { localId: effectiveLocalId } : undefined);
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
          registerCooldownUntilRef.current = Date.now() + 5000;
          lastRegisteredTokenRef.current = fcmToken;
          writeStoredToken(fcmToken);
          // Limpieza inmediata de estado: el mensaje "token no registrado" desaparece sin recargar
          setPendingRegister(false);
          setError(null);
          setServerTokenRegistered(true);
          console.log(
            '🔥 Token guardado en Firestore. Rol:',
            fcmRole,
            effectiveLocalId ? `localId:${effectiveLocalId}` : ''
          );
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
      } finally {
        registerInFlightRef.current = false;
      }
    },
    [
      registrationAllowed,
      fcmRole,
      effectiveLocalId,
      writeStoredToken,
      setPendingRegister,
      refreshServerTokenStatus,
    ]
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
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const sync = () => {
      setPermission((Notification.permission as NotificationPermission) ?? 'default');
    };
    sync();
    const onVis = () => {
      if (document.visibilityState === 'visible') sync();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
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
    if (!registrationAllowed) return;
    if (expectsLocalRegister) return;
    // Tras reload, el ref arranca en null y forzaba POST aunque localStorage ya tuviera el mismo token.
    lastRegisteredTokenRef.current = readStoredToken();
    const syncToken = () => {
      if (syncTokenInFlightRef.current) return;
      syncTokenInFlightRef.current = true;
      raceGetFCMToken(FCM_GET_TOKEN_BUDGET_MS).then(async (r) => {
        try {
        let token = r.token;
        if (r.timedOut) {
          const cached = readStoredToken();
          if (cached) {
            token = cached;
            if (process.env.NODE_ENV === 'development') {
              console.warn('[FCM] Sync: tope de tiempo en getToken; usando token en almacenamiento.');
            }
          } else if (serverTokenRegisteredRef.current) {
            console.warn(
              '[FCM] Sync: getToken tardó y no hay caché local; este dispositivo ya constaba registrado. Si fallan los avisos, usen «Re-sincronizar dispositivo» en Perfil.'
            );
            return;
          } else {
            console.warn('[FCM] Timeout obteniendo token en sync; marcando registro pendiente.');
            setPendingRegister(true);
            return;
          }
        }
        if (!token) return;
        const stored = readStoredToken();
        const hasPending = getPendingRegister();
        const looksSyncedLocally = !hasPending && stored === token && lastRegisteredTokenRef.current === token;
        if (looksSyncedLocally) {
          const idTok = await getIdToken();
          if (idTok) {
            const data = await fetchFcmStatusProbe(fcmRole, idTok, token);
            if (data?.hasCurrentToken === true) {
              if (process.env.NODE_ENV === 'development') {
                console.log('[FCM] Skip register: token already in server.');
              }
              return;
            }
            // Timeout, abort o error de /status: no bloquear registro
          }
        }
        if (
          !getPendingRegister() &&
          Date.now() < registerCooldownUntilRef.current &&
          readStoredToken() === token &&
          lastRegisteredTokenRef.current === token
        ) {
          return;
        }
        lastRegisteredTokenRef.current = null;
        await registerToken(token, true);
        } finally {
          syncTokenInFlightRef.current = false;
        }
      });
    };
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastVisibilityFcmSyncRef.current < FCM_VISIBILITY_SYNC_COOLDOWN_MS) return;
      lastVisibilityFcmSyncRef.current = now;
      syncToken();
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
  }, [
    permission,
    optedOut,
    registrationAllowed,
    expectsLocalRegister,
    registerToken,
    readStoredToken,
    getPendingRegister,
    fcmRole,
  ]);

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
    if (!registrationAllowed) {
      setError('Cargando tu perfil… espera un momento e intenta de nuevo.');
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
        console.log('[FCM] Permiso concedido. Preparando Service Worker....');
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
        for (let attempt = 0; attempt < 2 && !token && !sawTimeout; attempt++) {
          if (attempt > 0) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
          const r = await raceGetFCMToken(FCM_GET_TOKEN_BUDGET_MS);
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
  }, [registerWithBackoff, refreshServerTokenStatus, setPendingRegister, registrationAllowed]);

  /** Reintenta obtener el token FCM y registrarlo (sin pedir permiso). Para el botón "Reintentar" cuando permission ya es granted. */
  const reintentarRegistro = useCallback(async (): Promise<boolean> => {
    if (permission !== 'granted' || optedOut) return false;
    if (!registrationAllowed) return false;
    const r = await raceGetFCMToken(FCM_GET_TOKEN_BUDGET_MS);
    if (r.timedOut) {
      setError('Tiempo de espera agotado');
      return false;
    }
    if (!r.token) return false;
    const ok = await registerWithBackoff(r.token);
    void refreshServerTokenStatus();
    return ok;
  }, [permission, optedOut, registrationAllowed, registerWithBackoff, refreshServerTokenStatus]);

  const resincronizarNotificaciones = useCallback(async () => {
    if (typeof window === 'undefined' || !isWebPushEnvironment()) return;
    if (permission !== 'granted' || optedOut) return;
    if (!registrationAllowed) return;
    registerCooldownUntilRef.current = 0;
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
        const timer = setTimeout(() => resolve({ token: null, timedOut: true }), FCM_GET_TOKEN_BUDGET_MS);
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
    registrationAllowed,
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
        body: JSON.stringify({ role: fcmRole, token }),
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
  }, [fcmRole, setPendingRegister, readStoredToken]);

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
    /** True mientras el contexto local espera perfil (rol + localId) para poder registrar. */
    waitingForFcmProfile,
  };
}
