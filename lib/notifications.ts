import { isSafeInternalRedirectPath } from '@/lib/auth-routing';

/**
 * Envía una solicitud al backend para que dispare una notificación push.
 * Requiere usuario autenticado (envía Bearer token).
 */
export type NotificationTarget = 'central' | 'rider' | 'local' | 'user';

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

/** Ruta relativa para abrir seguimiento desde payload FCM (`data`). */
export function getFcmDeepLinkPath(data?: Record<string, string | undefined> | null): string | null {
  if (!data) return null;
  const openPath = typeof data.openPath === 'string' ? data.openPath.trim() : '';
  if (openPath && isSafeInternalRedirectPath(openPath)) return openPath;
  const mid = typeof data.mandadoId === 'string' ? data.mandadoId.trim() : '';
  if (mid) return `/mandado/${encodeURIComponent(mid)}`;
  const pid = typeof data.pedidoId === 'string' ? data.pedidoId.trim() : '';
  if (pid) return `/pedido/${encodeURIComponent(pid)}`;
  return null;
}

/**
 * Notificación local en primer plano; opcionalmente navega al hacer clic (pedido / mandado).
 */
export function showLocalNotification(
  title: string,
  body: string,
  data?: Record<string, string | undefined> | null
): void {
  try {
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }
    const tag =
      (typeof data?.mandadoId === 'string' && data.mandadoId.trim()) ||
      (typeof data?.pedidoId === 'string' && data.pedidoId.trim()) ||
      'andina-fcm';
    const nav = getFcmDeepLinkPath(data ?? undefined);
    const n = new Notification(title, {
      body,
      tag,
      data: data ? { ...data } : undefined,
    });
    n.onclick = () => {
      try {
        window.focus();
        if (nav) {
          window.location.assign(nav);
        }
      } finally {
        n.close();
      }
    };
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
