/**
 * Firebase Admin SDK para uso en API routes (Firestore, Auth).
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
  admin.initializeApp({ credential: loadCredential() });
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

export async function verifyIdToken(token: string): Promise<{ uid: string }> {
  const d = await getAdminAuth().verifyIdToken(token);
  return { uid: d.uid };
}
