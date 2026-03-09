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
  const fullData = { title, body, ...dataPayload };
  let sent = 0;
  for (const doc of snap.docs) {
    const token = doc.data().token as string;
    if (!token?.trim()) continue;
    try {
      await messaging.send({
        token: token.trim(),
        data: fullData,
      });
      sent++;
    } catch (e) {
      const code = e && typeof e === 'object' && 'code' in e ? String((e as { code: string }).code) : '';
      const isUnregistered = /registration-token-not-registered|invalid-registration-token|invalid-argument/.test(code);
      if (isUnregistered) {
        await doc.ref.delete();
        console.log('[FCM] Token eliminado (inválido o no registrado):', doc.id);
      }
    }
  }
  return sent;
}

/**
 * Envía una notificación FCM solo a los tokens del restaurante con el localId dado.
 * Filtro quirúrgico: solo role === 'restaurant' y localId coincidente. No broadcast.
 * Si localId está vacío/null/whitespace: no hace nada y devuelve 0 (evita gastar recursos).
 * No lanza; devuelve el número de envíos exitosos.
 */
export async function sendFCMToRestaurantByLocalId(
  localId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<number> {
  if (!localId || typeof localId !== 'string' || !localId.trim()) return 0;
  const db = getAdminFirestore();
  const snap = await db
    .collection(FCM_TOKENS_COLLECTION)
    .where('role', '==', 'restaurant')
    .where('localId', '==', localId.trim())
    .get();
  const messaging = getAdminMessaging();
  const dataPayload = data && typeof data === 'object'
    ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]))
    : {};
  const fullData = { title, body, ...dataPayload };
  let sent = 0;
  for (const doc of snap.docs) {
    const token = doc.data().token as string;
    if (!token?.trim()) continue;
    try {
      await messaging.send({
        token: token.trim(),
        data: fullData,
      });
      sent++;
    } catch (e) {
      const code = e && typeof e === 'object' && 'code' in e ? String((e as { code: string }).code) : '';
      const isUnregistered = /registration-token-not-registered|invalid-registration-token|invalid-argument/.test(code);
      if (isUnregistered) {
        await doc.ref.delete();
        console.log('[FCM] Token eliminado (inválido o no registrado):', doc.id);
      }
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
  if (!token?.trim()) {
    console.warn('[FCM] No token for user', uid, '- fcm_tokens/', `${uid}_user`);
    return false;
  }
  const messaging = getAdminMessaging();
  const dataPayload = data && typeof data === 'object'
    ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]))
    : {};
  const fullData = { title, body, ...dataPayload };
  try {
    await messaging.send({
      token: token.trim(),
      data: fullData,
    });
    console.log('[FCM] Sent to user', uid);
    return true;
  } catch (e) {
    const code = e && typeof e === 'object' && 'code' in e ? String((e as { code: string }).code) : '';
    const isUnregistered = /registration-token-not-registered|invalid-registration-token|invalid-argument/.test(code);
    if (isUnregistered) {
      await docRef.delete();
      console.log('[FCM] Token eliminado para usuario (inválido o no registrado):', docRef.id);
    } else {
      console.error('[FCM] sendFCMToUser failed for', uid, e);
    }
    return false;
  }
}
