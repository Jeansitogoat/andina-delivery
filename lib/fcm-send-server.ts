/**
 * Helpers de servidor para enviar notificaciones FCM (sin pasar por HTTP).
 * Usado por API de pedidos y por /api/fcm/send.
 */
import { getAdminFirestore, getAdminMessaging } from '@/lib/firebase-admin';

const FCM_TOKENS_COLLECTION = 'fcm_tokens';

export type FCMRole = 'central' | 'rider' | 'restaurant' | 'user';

const ROLES: FCMRole[] = ['central', 'rider', 'restaurant', 'user'];

function isValidRole(r: string): r is FCMRole {
  return ROLES.includes(r as FCMRole);
}

/**
 * Envía una notificación FCM a todos los tokens registrados con el rol dado.
 * No lanza; devuelve el número de envíos exitosos.
 */
export async function sendFCMToRole(
  role: FCMRole,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<number> {
  if (!isValidRole(role)) return 0;
  const db = getAdminFirestore();
  const snap = await db.collection(FCM_TOKENS_COLLECTION).where('role', '==', role).get();
  const tokens = snap.docs.map((d) => d.data().token as string).filter(Boolean);
  if (tokens.length === 0) return 0;
  const messaging = getAdminMessaging();
  const dataPayload = data && typeof data === 'object'
    ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]))
    : {};
  let sent = 0;
  for (const token of tokens) {
    try {
      await messaging.send({
        token,
        notification: { title, body },
        data: dataPayload,
      });
      sent++;
    } catch {
      // token inválido; seguir con el siguiente
    }
  }
  return sent;
}

/**
 * Envía una notificación FCM solo al usuario con el uid dado (rol 'user').
 * El token se obtiene del documento fcm_tokens/{uid}_user.
 * No lanza; devuelve true si se envió, false si no hay token o error.
 */
export async function sendFCMToUser(
  uid: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> {
  if (!uid?.trim()) return false;
  const db = getAdminFirestore();
  const docRef = db.collection(FCM_TOKENS_COLLECTION).doc(`${uid.trim()}_user`);
  const snap = await docRef.get();
  const token = snap.exists ? (snap.data()?.token as string) : null;
  if (!token?.trim()) return false;
  const messaging = getAdminMessaging();
  const dataPayload = data && typeof data === 'object'
    ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]))
    : {};
  try {
    await messaging.send({
      token: token.trim(),
      notification: { title, body },
      data: dataPayload,
    });
    return true;
  } catch {
    return false;
  }
}
