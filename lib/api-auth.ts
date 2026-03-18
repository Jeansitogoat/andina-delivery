/**
 * Verifica token Firebase y rol del usuario para APIs.
 * El cliente debe enviar: Authorization: Bearer <idToken>
 */
import { getAdminFirestore, verifyIdToken } from '@/lib/firebase-admin';
import type { UserRole } from '@/lib/useAuth';

function isTokenExpiredOrInvalid(e: unknown): boolean {
  const err = e as { code?: string; errorInfo?: { code?: string } };
  const code = err?.code ?? err?.errorInfo?.code ?? '';
  return (
    code === 'auth/id-token-expired' ||
    code === 'auth/argument-error' ||
    code === 'auth/invalid-argument' ||
    code === 'auth/invalid-id-token'
  );
}

export async function requireAuth(
  request: Request,
  allowedRoles: UserRole[]
): Promise<{ uid: string; rol: UserRole; localId: string | null }> {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    throw new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
  }
  try {
    const { uid } = await verifyIdToken(token);
    const db = getAdminFirestore();
    const snap = await db.collection('users').doc(uid).get();
    const data = snap.data();
    const rol = (data?.rol ?? 'cliente') as UserRole;
    if (!allowedRoles.includes(rol)) {
      throw new Response(JSON.stringify({ error: 'Rol no permitido' }), { status: 403 });
    }
    const localId = typeof data?.localId === 'string' ? data.localId : null;
    return { uid, rol, localId };
  } catch (e) {
    if (e instanceof Response) throw e;
    if (isTokenExpiredOrInvalid(e)) {
      throw new Response(
        JSON.stringify({ error: 'Token expirado o inválido', code: 'auth/id-token-expired' }),
        { status: 401 }
      );
    }
    throw e;
  }
}
