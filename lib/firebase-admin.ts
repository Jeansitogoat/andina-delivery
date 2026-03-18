/**
 * Firebase Admin SDK para uso en API routes (Firestore, Auth, Storage).
 * Solo usa FIREBASE_SERVICE_ACCOUNT_JSON (contenido del JSON en una variable de entorno).
 */
const admin = require('firebase-admin') as typeof import('firebase-admin');

function loadCredential(): import('firebase-admin').credential.Credential {
  const jsonStr = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!jsonStr || typeof jsonStr !== 'string' || !jsonStr.trim()) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON debe estar configurado (contenido del JSON de la cuenta de servicio)');
  }
  try {
    const cred = JSON.parse(jsonStr) as object;
    if (!cred || typeof cred !== 'object') {
      throw new Error('JSON inválido');
    }
    return admin.credential.cert(cred);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('JSON') || msg.includes('parse')) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON no es un JSON válido: ' + msg);
    }
    throw e;
  }
}

function ensureInit(): void {
  if (admin.apps.length > 0) return;
  admin.initializeApp({
    credential: loadCredential(),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

export function getAdminFirestore(): import('firebase-admin/firestore').Firestore {
  ensureInit();
  return admin.firestore();
}

export function getAdminMessaging(): import('firebase-admin/messaging').Messaging {
  ensureInit();
  return admin.messaging();
}

export function getAdminAuth(): import('firebase-admin/auth').Auth {
  ensureInit();
  return admin.auth();
}

export function getAdminStorage(): import('firebase-admin/storage').Storage {
  ensureInit();
  return admin.storage();
}

export interface DecodedToken {
  uid: string;
  /** Custom claim: rol del usuario (maestro | local | central | rider | cliente) */
  rol?: string;
  /** Custom claim: localId asociado al usuario (solo rol local) */
  localId?: string | null;
}

/**
 * Verifica el ID token y retorna el decoded token incluyendo custom claims.
 * Los custom claims (rol, localId) están disponibles directamente sin leer Firestore.
 */
export async function verifyIdToken(token: string): Promise<DecodedToken> {
  const d = await getAdminAuth().verifyIdToken(token);
  return {
    uid: d.uid,
    rol: d['rol'] as string | undefined,
    localId: d['localId'] as string | null | undefined,
  };
}

/**
 * Establece los custom claims del usuario en Firebase Auth.
 * Los claims se incluyen en el JWT en el siguiente login o refresh de token.
 * Para forzar el refresh en el cliente, llamar a user.getIdToken(true) después.
 */
export async function setUserClaims(
  uid: string,
  claims: { rol: string; localId?: string | null }
): Promise<void> {
  await getAdminAuth().setCustomUserClaims(uid, {
    rol: claims.rol,
    ...(claims.localId !== undefined ? { localId: claims.localId } : {}),
  });
}
