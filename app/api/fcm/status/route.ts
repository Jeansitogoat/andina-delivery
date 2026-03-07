import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getAdminFirestore } from '@/lib/firebase-admin';

const FCM_TOKENS_COLLECTION = 'fcm_tokens';

export async function GET(request: Request) {
  let auth: { uid: string };
  try {
    auth = await requireAuth(request, ['central', 'rider', 'local', 'maestro', 'cliente']);
  } catch (e) {
    const err = e as unknown;
    if (err instanceof Response) return err;
    throw err;
  }
  try {
    const db = getAdminFirestore();
    const docRef = db.collection(FCM_TOKENS_COLLECTION).doc(`${auth.uid}_user`);
    const snap = await docRef.get();
    const hasToken = snap.exists && !!(snap.data()?.token);
    return NextResponse.json({ hasToken });
  } catch (e) {
    console.error('GET /api/fcm/status', e);
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
}
