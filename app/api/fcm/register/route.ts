import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAuth } from '@/lib/api-auth';
import { getAdminFirestore } from '@/lib/firebase-admin';

const ROLES = ['central', 'rider', 'restaurant', 'user'] as const;
type Role = (typeof ROLES)[number];

const FCM_TOKENS_COLLECTION = 'fcm_tokens';

function isValidRole(r: string): r is Role {
  return ROLES.includes(r as Role);
}

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
    const { token, role } = body as { token?: string; role?: string };
    if (typeof token !== 'string' || !token.trim()) {
      return NextResponse.json({ error: 'token requerido' }, { status: 400 });
    }
    const trimmedToken = token.trim();
    const roleStr = (typeof role === 'string' ? role : '').trim();
    if (!isValidRole(roleStr)) {
      return NextResponse.json({ error: 'role inválido (central, rider, restaurant, user)' }, { status: 400 });
    }
    const db = getAdminFirestore();
    const docId = `${auth.uid}_${roleStr}`;
    await db.collection(FCM_TOKENS_COLLECTION).doc(docId).set({
      token: trimmedToken,
      role: roleStr,
      uid: auth.uid,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log('[FCM] Token registered', docId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('POST /api/fcm/register', e);
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
}
