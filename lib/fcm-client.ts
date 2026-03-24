/**
 * Obtiene el token FCM del dispositivo para notificaciones push.
 * Requiere: Firebase Cloud Messaging activado, VAPID key en NEXT_PUBLIC_FIREBASE_VAPID_KEY
 * y el service worker public/firebase-messaging-sw.js desplegado.
 */
import { getFirebaseApp } from '@/lib/firebase/client';

const MESSAGING_SW_URL = '/firebase-messaging-sw.js';

export function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Timeout para esperar a que el SW de FCM pase a active (iOS necesita más margen). */
function getSWWaitTimeoutMs(): number {
  return isIOS() ? 10000 : 5000;
}

/**
 * Registra el Service Worker de FCM en la ruta /firebase-messaging-sw.js con scope '/' para evitar
 * 404 o rutas incorrectas en Vercel (el SW debe controlar todo el origen).
 */
async function getMessagingSWRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  const timeoutMs = getSWWaitTimeoutMs();
  try {
    const newReg = await navigator.serviceWorker.register(MESSAGING_SW_URL, { scope: '/' });
    if (newReg.active && newReg.active.scriptURL.includes('firebase-messaging-sw')) return newReg;
    if (newReg.waiting) {
      newReg.waiting.postMessage({ type: 'SKIP_WAITING' });
      await new Promise<void>((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true });
        setTimeout(resolve, 3000);
      });
      const after = await navigator.serviceWorker.getRegistration('/');
      if (after?.active?.scriptURL.includes('firebase-messaging-sw')) return after;
    }
    await new Promise<void>((resolve) => {
      const worker = newReg.installing ?? newReg.waiting;
      const done = () => {
        if (newReg.active) resolve();
      };
      if (worker) {
        worker.addEventListener('statechange', done);
        if (newReg.active) done();
      }
      setTimeout(resolve, timeoutMs);
    });
    return newReg;
  } catch (e) {
    console.warn('[FCM] getMessagingSWRegistration failed', e);
    return null;
  }
}

/** Pre-registra el SW de FCM para que esté listo cuando el usuario active notificaciones (p. ej. desde Perfil o Layout). */
export async function ensureFCMServiceWorkerReady(): Promise<ServiceWorkerRegistration | null> {
  return getMessagingSWRegistration();
}

/**
 * Espera a que el Service Worker de FCM (firebase-messaging-sw.js) esté activo.
 * Si el SW activo no es el de FCM, intenta registrarlo proactivamente.
 * Crítico en arranque en frío: evita que getToken corra sin el SW correcto.
 */
export async function waitForServiceWorker(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }
  // Esperar a que haya cualquier SW ready (prerequisito del navegador)
  await navigator.serviceWorker.ready;
  // Verificar que el SW activo sea el de FCM
  const existing = await navigator.serviceWorker.getRegistration('/');
  if (existing?.active?.scriptURL.includes('firebase-messaging-sw')) {
    return; // FCM SW ya está activo y controlando la página
  }
  // SW activo no es el de FCM (o no hay ninguno): intentar registrar/activar
  console.log('[FCM] waitForServiceWorker: SW FCM no activo, intentando registro proactivo...');
  await getMessagingSWRegistration();
  // Margen adicional en iOS para completar la activación
  if (isIOS()) {
    await new Promise((r) => setTimeout(r, 500));
  }
}

export async function getFCMToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim();
  if (!vapidKey) {
    console.error('[FCM] Error: VAPID Key faltante (NEXT_PUBLIC_FIREBASE_VAPID_KEY). Configurala en .env.local o en las variables de entorno de Vercel. Sin esta key no se puede obtener el token FCM.');
    return null;
  }
  try {
    await waitForServiceWorker();
    const swReg = await getMessagingSWRegistration();
    if (!swReg) {
      console.error('[FCM] getFCMToken: Service Worker no disponible o falló el registro. Comprueba que /firebase-messaging-sw.js exista y tenga scope "/".');
      return null;
    }
    const { getMessaging, getToken } = await import('firebase/messaging');
    const app = getFirebaseApp();
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: swReg,
    });
    return token ?? null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const code = e && typeof e === 'object' && 'code' in e ? String((e as { code: string }).code) : '';
    const lower = (msg + ' ' + code).toLowerCase();
    if (lower.includes('permission') || lower.includes('denied') || lower.includes('notification')) {
      console.error('[FCM] getFCMToken: Error de permisos -', msg, e);
    } else if (lower.includes('vapid') || lower.includes('key') || lower.includes('invalid') && (lower.includes('key') || lower.includes('vapid'))) {
      console.error('[FCM] getFCMToken: Error por llave VAPID (revisa NEXT_PUBLIC_FIREBASE_VAPID_KEY) -', msg, e);
    } else if (lower.includes('service') || lower.includes('worker') || lower.includes('registration') || lower.includes('sw')) {
      console.error('[FCM] getFCMToken: Error de Service Worker -', msg, e);
    } else {
      console.error('[FCM] getFCMToken: Error -', msg, code, e);
    }
    return null;
  }
}

/**
 * Obtiene el token FCM esperando primero al SW y reintentando (recomendado en móvil).
 * En iOS usa más delay inicial y más intentos. Incluye un reintento extra tras 3 s si el bucle no obtuvo token.
 */
export async function getFCMTokenWithRetry(options?: {
  maxAttempts?: number;
  delayMs?: number;
  initialDelayMs?: number;
}): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  // Abort temprano si falta VAPID key: evita flujos ambiguos que retornan null sin diagnóstico
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim();
  if (!vapidKey) {
    console.error('[FCM] Error: VAPID Key faltante (NEXT_PUBLIC_FIREBASE_VAPID_KEY). Abortando getFCMTokenWithRetry.');
    return null;
  }
  const ios = isIOS();
  const {
    maxAttempts = 3,
    delayMs = 2000,
    initialDelayMs = ios ? 2500 : 800,
  } = options ?? {};
  await waitForServiceWorker();
  await getMessagingSWRegistration();
  await new Promise((r) => setTimeout(r, initialDelayMs));
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const token = await getFCMToken();
    if (token) return token;
    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  await new Promise((r) => setTimeout(r, 3000));
  const token = await getFCMToken();
  return token ?? null;
}

/**
 * Configura el listener de mensajes FCM en primer plano.
 * Cuando llega un push con la app abierta, muestra una notificación local.
 * Devuelve una función para cancelar el listener.
 */
export async function setupFCMForegroundListener(): Promise<() => void> {
  if (typeof window === 'undefined') return () => {};
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim();
  if (!vapidKey) return () => {};
  try {
    const { getMessaging, onMessage } = await import('firebase/messaging');
    const { showLocalNotification } = await import('@/lib/notifications');
    const app = getFirebaseApp();
    const messaging = getMessaging(app);
    const unsubscribe = onMessage(messaging, (payload) => {
      const title = payload.notification?.title ?? (payload.data as Record<string, string> | undefined)?.title ?? 'Andina Delivery';
      const body = payload.notification?.body ?? (payload.data as Record<string, string> | undefined)?.body ?? '';
      showLocalNotification(title, body);
    });
    return () => unsubscribe();
  } catch {
    return () => {};
  }
}
