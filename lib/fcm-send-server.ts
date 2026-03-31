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

type DocWithTokens = { ref: FirebaseFirestore.DocumentReference; tokens: string[] };

function normalizeDataPayload(data?: Record<string, string>): Record<string, string> {
  return data && typeof data === 'object'
    ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]))
    : {};
}

/**
 * Solo payload `data` (sin `notification`): en primer plano el cliente muestra toast vía onMessage;
 * en segundo plano firebase-messaging-sw.js arma la notificación desde data.title / data.body.
 */
function buildDataOnlyFcmMessage(token: string, fullData: Record<string, string>) {
  return {
    token,
    data: fullData,
    android: { priority: 'high' as const },
    apns: {
      headers: { 'apns-priority': '10' },
      payload: {
        aps: {
          'content-available': 1,
          sound: 'default',
        },
      },
    },
    webpush: {
      headers: { Urgency: 'high' },
    },
  };
}

/**
 * Un token = un envío: deduplica entre documentos y usa messaging.sendEach.
 */
async function sendDedupedToTokens(
  docsWithTokens: DocWithTokens[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<number> {
  const dataPayload = normalizeDataPayload(data);
  const fullData: Record<string, string> = { title, body, ...dataPayload };

  const tokenToRefs = new Map<string, Set<FirebaseFirestore.DocumentReference>>();
  for (const entry of docsWithTokens) {
    for (const raw of entry.tokens) {
      const t = raw?.trim();
      if (!t) continue;
      let refs = tokenToRefs.get(t);
      if (!refs) {
        refs = new Set();
        tokenToRefs.set(t, refs);
      }
      refs.add(entry.ref);
    }
  }

  const uniqueTokens = [...tokenToRefs.keys()];
  if (uniqueTokens.length === 0) return 0;

  const messaging = getAdminMessaging();
  const messages = uniqueTokens.map((tok) => buildDataOnlyFcmMessage(tok, fullData));
  const batch = await messaging.sendEach(messages);

  let sent = 0;
  for (let i = 0; i < batch.responses.length; i++) {
    const r = batch.responses[i];
    const token = uniqueTokens[i];
    if (r.success) {
      sent++;
      continue;
    }
    const err = r.error;
    const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: string }).code) : '';
    const isUnregistered = /registration-token-not-registered|invalid-registration-token|invalid-argument/.test(code);
    if (isUnregistered) {
      const refs = tokenToRefs.get(token);
      if (refs) {
        for (const ref of refs) {
          await removeDeadToken(ref, token);
          console.log('[FCM] Token eliminado (inválido o no registrado):', ref.id);
        }
      }
    } else {
      console.error('[FCM] sendEach falló para token (índice', i, '):', err);
    }
  }
  return sent;
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
  return sendDedupedToTokens(docsWithTokens, title, body, data);
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
  const docsWithTokens = snap.docs.map((d) => ({
    ref: d.ref,
    tokens: extractTokens(d.data() as TokenDocData),
  }));
  const n = docsWithTokens.reduce((a, d) => a + d.tokens.length, 0);
  if (n === 0) {
    console.warn(
      '[FCM] Ningún token para restaurante localId=',
      localId.trim(),
      '(docs:',
      snap.size,
      ') — revisar registro FCM y campo localId en fcm_tokens'
    );
  }
  return sendDedupedToTokens(docsWithTokens, title, body, data);
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
  try {
    const sent = await sendDedupedToTokens([{ ref: docRef, tokens }], title, body, data);
    if (sent > 0) console.log('[FCM] Sent to user', uid);
    return sent > 0;
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
  try {
    const sent = await sendDedupedToTokens([{ ref: docRef, tokens }], title, body, data);
    if (sent > 0) console.log('[FCM] Sent to rider', uid);
    return sent > 0;
  } catch (e) {
    console.error('[FCM] sendFCMToRider failed for', uid, e);
    return false;
  }
}
