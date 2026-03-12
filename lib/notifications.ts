/**
 * Envía una solicitud al backend para que dispare una notificación push.
 * Requiere usuario autenticado (envía Bearer token).
 */
export type NotificationTarget = 'central' | 'rider' | 'restaurant' | 'user';

export interface SendNotificationParams {
  target: NotificationTarget;
  title: string;
  body: string;
  data?: Record<string, string>;
  /** Opcional: uid específico cuando el target admite envíos directos (p. ej. rider, user). */
  uid?: string;
}

export async function sendNotification({ target, title, body, data, uid }: SendNotificationParams): Promise<void> {
  try {
    const { getIdToken } = await import('@/lib/authToken');
    const token = await getIdToken();
    if (!token) return;
    const res = await fetch('/api/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ target, title, body, data: data ?? {}, ...(uid ? { uid } : {}) }),
    });
    if (!res.ok) {
      // API error; no molestar al usuario
    }
  } catch {
    // Red o API no disponible
  }
}

/**
 * Muestra una notificación local en el navegador (para demo).
 * Solo tiene efecto si el usuario ya dio permiso de notificaciones.
 */
export function showLocalNotification(title: string, body: string): void {
  try {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  } catch {
    // Ignorar
  }
}

/** Indica si se pueden mostrar notificaciones del sistema (permiso concedido). Útil para mostrar feedback en demos. */
export function canShowLocalNotification(): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  return Notification.permission === 'granted';
}

/** Mensaje para mostrar cuando el usuario prueba la demo sin haber activado notificaciones. */
export const DEMO_NEED_PERMISSION_MESSAGE = 'Activa notificaciones arriba para ver la notificación del sistema.';
