import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getAdminFirestore } from '@/lib/firebase-admin';

const FCM_TOKENS_COLLECTION = 'fcm_tokens';

export async function GET(request: Request) {
  try {
    await requireAuth(request, ['maestro', 'central']);
  } catch (e) {
    const err = e as unknown;
    if (err instanceof Response) return err;
    throw err;
  }
  try {
    const db = getAdminFirestore();
    const snap = await db
      .collection(FCM_TOKENS_COLLECTION)
      .orderBy('updatedAt', 'desc')
      .limit(1)
      .get();
    if (snap.empty) {
      return NextResponse.json({ lastSync: null });
    }
    const doc = snap.docs[0];
    const data = doc.data() as { updatedAt?: FirebaseFirestore.Timestamp; lastUpdated?: FirebaseFirestore.Timestamp };
    const ts = data.updatedAt ?? data.lastUpdated;
    const lastSync = ts ? ts.toMillis() : null;
    return NextResponse.json({ lastSync });
  } catch (e) {
    console.error('GET /api/fcm/last-sync', e);
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
}

