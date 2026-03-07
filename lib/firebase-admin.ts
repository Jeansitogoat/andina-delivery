/**
 * Firebase Admin SDK para uso en API routes (Firestore, Auth).
 * Usa FIREBASE_SERVICE_ACCOUNT_PATH (ruta al JSON) o FIREBASE_SERVICE_ACCOUNT_JSON.
 */
const admin = require('firebase-admin') as typeof import('firebase-admin');
const fs = require('fs') as typeof import('fs');
const path = require('path') as typeof import('path');

function loadCredential(): import('firebase-admin').credential.Credential {
  const jsonPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const jsonStr = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (jsonPath?.trim()) {
    const resolved = path.resolve(process.cwd(), jsonPath);
    const raw = fs.readFileSync(resolved, 'utf8');
    const cred = JSON.parse(raw) as object;
    return admin.credential.cert(cred);
  }
  if (jsonStr?.trim()) {
    const cred = JSON.parse(jsonStr) as object;
    return admin.credential.cert(cred);
  }
  throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH o FIREBASE_SERVICE_ACCOUNT_JSON debe estar configurado');
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
