/**
 * Helpers de servidor para enviar notificaciones FCM (sin pasar por HTTP).
 * Usado por API de pedidos y por /api/fcm/send.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore, getAdminMessaging } from '@/lib/firebase-admin';

const FCM_TOKENS_COLLECTION = 'fcm_tokens';

export type FCMRole = 'central' | 'rider' | 'local' | 'user';

const ROLES: FCMRole[] = ['central', 'rider', 'local', 'user'];

function isValidRole(r: string): r is FCMRole {
  return ROLES.includes(r as FCMRole);
}

type TokenDocData = { tokens?: unknown; token?: unknown };

function extractTokens(data: TokenDocData | undefined): string[] {
  const arr = Array.isArray(data?.tokens)
    ? (data.tokens as unknown[]).filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    : [];
  const legacy = typeof data?.token === 'string' && data.token.trim() ? data.token.trim() : null;
  return legacy ? Array.from(new Set([...arr, legacy])) : Array.from(new Set(arr));
}

async function removeDeadToken(ref: FirebaseFirestore.DocumentReference, token: string): Promise<void> {
  try {
    const snap = await ref.get();
    if (!snap.exists) return;
    const tokens = extractTokens(snap.data() as TokenDocData);
    const next = tokens.filter((t) => t !== token);
    if (next.length === 0) {
      await ref.delete();
      return;
    }
    await ref.set(
      {
        tokens: next,
        token: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch {
    // silencioso
  }
}

/**
 * Envía una notificación FCM a todos los tokens registrados con el rol dado.
 * No lanza; devuelve el número de envíos exitosos.
 */
export async function sendFCMToRole(
  role: FCMRole,
  title: string,
  body: string,
  data?: Record<string, string>,
  options?: { localId?: string; maxTokens?: number }
): Promise<number> {
  if (!isValidRole(role)) return 0;
  const db = getAdminFirestore();
  const maxTokens = Math.min(Math.max(options?.maxTokens ?? 200, 1), 500);
  let query = db.collection(FCM_TOKENS_COLLECTION).where('role', '==', role);
  if (options?.localId?.trim()) {
    query = query.where('localId', '==', options.localId.trim());
  }
  const snap = await query.limit(maxTokens).get();
  const docsWithTokens = snap.docs.map((d) => ({ ref: d.ref, tokens: extractTokens(d.data() as TokenDocData) }));
  const totalTokens = docsWithTokens.reduce((acc, x) => acc + x.tokens.length, 0);
  if (totalTokens === 0) return 0;
  const messaging = getAdminMessaging();
  const dataPayload = data && typeof data === 'object'
    ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]))
    : {};
  const fullData = { title, body, ...dataPayload };
  let sent = 0;
  for (const entry of docsWithTokens) {
    for (const token of entry.tokens) {
      if (!token.trim()) continue;
      try {
        await messaging.send({
          token: token.trim(),
          notification: { title, body },
          data: fullData,
          android: { priority: 'high' },
          apns: {
            headers: { 'apns-priority': '10' },
            payload: { aps: { sound: 'default' } },
          },
        });
        sent++;
      } catch (e) {
        const code = e && typeof e === 'object' && 'code' in e ? String((e as { code: string }).code) : '';
        const isUnregistered = /registration-token-not-registered|invalid-registration-token|invalid-argument/.test(code);
        if (isUnregistered) {
          await removeDeadToken(entry.ref, token);
          console.log('[FCM] Token eliminado (inválido o no registrado):', entry.ref.id);
        }
      }
    }
  }
  return sent;
}

/**
 * Envía una notificación FCM solo a los tokens del local con el localId dado.
 * Filtro quirúrgico: solo role === 'local' y localId coincidente. No broadcast.
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
    .where('role', '==', 'local')
    .where('localId', '==', localId.trim())
    .get();
  const messaging = getAdminMessaging();
  const dataPayload = data && typeof data === 'object'
    ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]))
    : {};
  const fullData = { title, body, ...dataPayload };
  let sent = 0;
  for (const doc of snap.docs) {
    const tokens = extractTokens(doc.data() as TokenDocData);
    for (const token of tokens) {
      if (!token?.trim()) continue;
      try {
        await messaging.send({
          token: token.trim(),
          notification: { title, body },
          data: fullData,
          android: { priority: 'high' },
          apns: {
            headers: { 'apns-priority': '10' },
            payload: { aps: { sound: 'default' } },
          },
        });
        sent++;
      } catch (e) {
        const code = e && typeof e === 'object' && 'code' in e ? String((e as { code: string }).code) : '';
        const isUnregistered = /registration-token-not-registered|invalid-registration-token|invalid-argument/.test(code);
        if (isUnregistered) {
          await removeDeadToken(doc.ref, token);
          console.log('[FCM] Token eliminado (inválido o no registrado):', doc.id);
        }
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
  const tokens = snap.exists ? extractTokens(snap.data() as TokenDocData) : [];
  if (tokens.length === 0) {
    console.warn('[FCM] No token for user', uid, '- fcm_tokens/', `${uid}_user`);
    return false;
  }
  const messaging = getAdminMessaging();
  const dataPayload = data && typeof data === 'object'
    ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]))
    : {};
  const fullData = { title, body, ...dataPayload };
  try {
    let sentOne = false;
    for (const token of tokens) {
      try {
        await messaging.send({
          token: token.trim(),
          notification: { title, body },
          data: fullData,
          android: { priority: 'high' },
          apns: {
            headers: { 'apns-priority': '10' },
            payload: { aps: { sound: 'default' } },
          },
        });
        sentOne = true;
      } catch (e) {
        const code = e && typeof e === 'object' && 'code' in e ? String((e as { code: string }).code) : '';
        const isUnregistered = /registration-token-not-registered|invalid-registration-token|invalid-argument/.test(code);
        if (isUnregistered) {
          await removeDeadToken(docRef, token);
          console.log('[FCM] Token eliminado para usuario (inválido o no registrado):', docRef.id);
        } else {
          console.error('[FCM] sendFCMToUser failed for', uid, e);
        }
      }
    }
    if (sentOne) console.log('[FCM] Sent to user', uid);
    return sentOne;
  } catch (e) {
    console.error('[FCM] sendFCMToUser failed for', uid, e);
    return false;
  }
}

/**
 * Envía una notificación FCM solo al rider con el uid dado (rol 'rider').
 * El token se obtiene del documento fcm_tokens/{uid}_rider.
 * No lanza; devuelve true si se envió, false si no hay token o error.
 */
export async function sendFCMToRider(
  uid: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> {
  if (!uid?.trim()) return false;
  const db = getAdminFirestore();
  const docRef = db.collection(FCM_TOKENS_COLLECTION).doc(`${uid.trim()}_rider`);
  const snap = await docRef.get();
  const tokens = snap.exists ? extractTokens(snap.data() as TokenDocData) : [];
  if (tokens.length === 0) {
    console.warn('[FCM] No token for rider', uid, '- fcm_tokens/', `${uid}_rider`);
    return false;
  }
  const messaging = getAdminMessaging();
  const dataPayload = data && typeof data === 'object'
    ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]))
    : {};
  const fullData = { title, body, ...dataPayload };
  try {
    let sentOne = false;
    for (const token of tokens) {
      try {
        await messaging.send({
          token: token.trim(),
          notification: { title, body },
          data: fullData,
          android: { priority: 'high' },
          apns: {
            headers: { 'apns-priority': '10' },
            payload: { aps: { sound: 'default' } },
          },
        });
        sentOne = true;
      } catch (e) {
        const code = e && typeof e === 'object' && 'code' in e ? String((e as { code: string }).code) : '';
        const isUnregistered = /registration-token-not-registered|invalid-registration-token|invalid-argument/.test(code);
        if (isUnregistered) {
          await removeDeadToken(docRef, token);
          console.log('[FCM] Token eliminado para rider (inválido o no registrado):', docRef.id);
        } else {
          console.error('[FCM] sendFCMToRider failed for', uid, e);
        }
      }
    }
    if (sentOne) console.log('[FCM] Sent to rider', uid);
    return sentOne;
  } catch (e) {
    console.error('[FCM] sendFCMToRider failed for', uid, e);
    return false;
  }
}
