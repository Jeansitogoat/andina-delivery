/**
 * Verifica token Firebase y rol del usuario para APIs.
 * El cliente debe enviar: Authorization: Bearer <idToken>
 *
 * Fase 3 — Custom Claims:
 * El rol se lee directamente del JWT (custom claim `rol`), eliminando la lectura
 * de Firestore por request. Si el claim no está presente (usuarios legacy sin claim),
 * hace el fallback a Firestore y fija el claim para futuras llamadas.
 */
import { getAdminFirestore, verifyIdToken, setUserClaims } from '@/lib/firebase-admin';
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
    const decoded = await verifyIdToken(token);
    const { uid } = decoded;

    // Fast path: el rol ya viene en el JWT como custom claim → cero lecturas de Firestore.
    if (decoded.rol) {
      const rol = decoded.rol as UserRole;
      if (!allowedRoles.includes(rol)) {
        throw new Response(JSON.stringify({ error: 'Rol no permitido' }), { status: 403 });
      }
      const localId = decoded.localId ?? null;
      return { uid, rol, localId };
    }

    // Fallback legacy: el usuario no tiene claim todavía (registro anterior a Fase 3).
    // Lee Firestore UNA VEZ y fija el claim para que las próximas llamadas vayan por fast path.
    const db = getAdminFirestore();
    const snap = await db.collection('users').doc(uid).get();
    const data = snap.data();
    const rol = (data?.rol ?? 'cliente') as UserRole;
    const localId = typeof data?.localId === 'string' ? data.localId : null;

    // Fijar custom claim de forma asíncrona sin bloquear la respuesta.
    setUserClaims(uid, { rol, localId }).catch((err) =>
      console.error('[api-auth] error fijando custom claim para uid', uid, err)
    );

    if (!allowedRoles.includes(rol)) {
      throw new Response(JSON.stringify({ error: 'Rol no permitido' }), { status: 403 });
    }
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
