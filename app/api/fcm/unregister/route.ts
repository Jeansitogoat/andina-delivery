import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getAdminFirestore } from '@/lib/firebase-admin';

const FCM_TOKENS_COLLECTION = 'fcm_tokens';

export async function POST(request: Request) {
  let auth: { uid: string };
  try {
    auth = await requireAuth(request, ['central', 'rider', 'local', 'maestro', 'cliente']);
  } catch (e) {
    const err = e as unknown;
    if (err instanceof Response) return err;
    throw err;
  }
  try {
    const body = await request.json().catch(() => ({}));
    const role = (typeof (body as { role?: string }).role === 'string'
      ? (body as { role: string }).role.trim()
      : 'user');
    const docId = `${auth.uid}_${role}`;
    const db = getAdminFirestore();
    await db.collection(FCM_TOKENS_COLLECTION).doc(docId).delete();
    console.log('[FCM] Token unregistered', docId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('POST /api/fcm/unregister', e);
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
}
