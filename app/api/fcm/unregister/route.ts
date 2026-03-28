import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAuth } from '@/lib/api-auth';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { fcmUnregisterPostSchema } from '@/lib/schemas/fcmUnregister';

const FCM_TOKENS_COLLECTION = 'fcm_tokens';

export async function POST(request: Request) {
  let auth: { uid: string; rol: string };
  try {
    auth = await requireAuth(request, ['central', 'rider', 'local', 'maestro', 'cliente']);
  } catch (e) {
    const err = e as unknown;
    if (err instanceof Response) return err;
    throw err;
  }
  try {
    const body = await request.json().catch(() => ({}));
    const parse = fcmUnregisterPostSchema.safeParse(body);
    if (!parse.success) {
      const fieldErrors = parse.error.flatten().fieldErrors;
      const firstMsg = Object.values(fieldErrors).flat()[0] ?? 'Datos inválidos';
      return NextResponse.json({ error: firstMsg, fieldErrors }, { status: 400 });
    }
    const role =
      parse.data.role ??
      (auth.rol === 'cliente'
        ? 'user'
        : auth.rol === 'maestro'
          ? 'central'
          : (auth.rol as 'central' | 'rider' | 'local'));
    const token = parse.data.token.trim();
    const docId = `${auth.uid}_${role}`;
    const db = getAdminFirestore();
    const ref = db.collection(FCM_TOKENS_COLLECTION).doc(docId);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return;
      const data = snap.data() as { tokens?: unknown; token?: unknown } | undefined;
      const currentTokens = Array.isArray(data?.tokens)
        ? (data.tokens as unknown[]).filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
        : [];
      const legacyToken = typeof data?.token === 'string' && data.token.trim() ? data.token.trim() : null;
      const merged = legacyToken ? [...currentTokens, legacyToken] : currentTokens;
      const nextTokens = merged.filter((t) => t !== token);
      if (nextTokens.length === 0) {
        tx.delete(ref);
        return;
      }
      tx.update(ref, {
        tokens: nextTokens,
        token: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    console.log('[FCM] Token unregistered', docId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('POST /api/fcm/unregister', e);
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
}
