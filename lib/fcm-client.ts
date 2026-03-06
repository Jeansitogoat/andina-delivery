/**
 * Obtiene el token FCM del dispositivo para notificaciones push.
 * Requiere: Firebase Cloud Messaging activado, VAPID key en NEXT_PUBLIC_FIREBASE_VAPID_KEY
 * y el service worker public/firebase-messaging-sw.js desplegado.
 */
import { getFirebaseApp } from '@/lib/firebase/client';

export async function getFCMToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey?.trim()) return null;
  try {
    const { getMessaging, getToken } = await import('firebase/messaging');
    const app = getFirebaseApp();
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey: vapidKey.trim() });
    return token ?? null;
  } catch {
    return null;
  }
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
