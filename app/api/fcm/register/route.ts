import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAuth } from '@/lib/api-auth';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { sanitizeForFirestore } from '@/lib/firestoreUtils';
import { fcmRegisterSchema } from '@/lib/schemas/fcmRegister';

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
    const body = await request.json();
    const parseResult = fcmRegisterSchema.safeParse(body);
    if (!parseResult.success) {
      const issues = parseResult.error.flatten().fieldErrors;
      const firstMsg = Object.values(issues).flat()[0] ?? 'Datos inválidos';
      return NextResponse.json({ error: firstMsg }, { status: 400 });
    }
    const { token: rawToken, role: roleStr, localId: bodyLocalId } = parseResult.data;
    const trimmedToken = rawToken.trim();
    const db = getAdminFirestore();
    let localId: string | null = typeof bodyLocalId === 'string' && bodyLocalId.trim() ? bodyLocalId.trim() : null;
    if (roleStr === 'restaurant') {
      if (!localId) {
        const userSnap = await db.collection('users').doc(auth.uid).get();
        localId = userSnap.data()?.localId ?? null;
      }
    }
    const docId = `${auth.uid}_${roleStr}`;
    const docData: Record<string, unknown> = {
      token: trimmedToken,
      role: roleStr,
      uid: auth.uid,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (roleStr === 'restaurant' && localId) docData.localId = localId;
    await db.collection(FCM_TOKENS_COLLECTION).doc(docId).set(sanitizeForFirestore(docData), { merge: true });
    console.log('[FCM] Token registered', docId, roleStr === 'restaurant' && localId ? `localId=${localId}` : '');
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('POST /api/fcm/register', e);
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
}
