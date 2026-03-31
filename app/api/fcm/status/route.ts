import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getAdminFirestore } from '@/lib/firebase-admin';

const FCM_TOKENS_COLLECTION = 'fcm_tokens';
const ALLOWED_ROLES = new Set(['user', 'local', 'rider', 'central']);

export async function GET(request: Request) {
  let auth: { uid: string; rol: string };
  try {
    auth = await requireAuth(request, ['central', 'rider', 'local', 'maestro', 'cliente']);
  } catch (e) {
    const err = e as unknown;
    if (err instanceof Response) return err;
    throw err;
  }

  const { searchParams } = new URL(request.url);
  const roleQuery = searchParams.get('role');
  const defaultRole =
    auth.rol === 'cliente'
      ? 'user'
      : auth.rol === 'maestro'
        ? 'central'
        : (auth.rol as 'central' | 'rider' | 'local');
  const role = roleQuery && ALLOWED_ROLES.has(roleQuery) ? roleQuery : defaultRole;

  try {
    const currentToken = request.headers.get('x-fcm-token')?.trim() ?? '';

    const db = getAdminFirestore();
    const docRef = db.collection(FCM_TOKENS_COLLECTION).doc(`${auth.uid}_${role}`);
    const snap = await docRef.get();
    const data = snap.data() as { tokens?: unknown; token?: unknown } | undefined;
    const tokens = Array.isArray(data?.tokens)
      ? (data.tokens as unknown[]).filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
      : [];
    const legacyToken = typeof data?.token === 'string' && data.token.trim() ? data.token.trim() : null;
    const merged = legacyToken ? Array.from(new Set([...tokens, legacyToken])) : tokens;
    const hasToken = merged.length > 0;
    const hasCurrentToken = currentToken ? merged.includes(currentToken) : null;
    return NextResponse.json({ hasToken, hasCurrentToken, tokensCount: merged.length, role });
  } catch (e) {
    console.error('GET /api/fcm/status', e);
    return NextResponse.json({
      hasToken: false,
      hasCurrentToken: null as boolean | null,
      tokensCount: 0,
      role,
    });
  }
}
