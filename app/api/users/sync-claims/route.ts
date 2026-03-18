import { NextResponse } from 'next/server';
import { getAdminFirestore, verifyIdToken, setUserClaims } from '@/lib/firebase-admin';

/**
 * POST /api/users/sync-claims
 * Sincroniza los custom claims del usuario con su documento de Firestore.
 * Llamar después del registro o cuando se necesite refrescar el rol en el JWT.
 * No requiere rol específico — solo un token válido.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  try {
    const { uid } = await verifyIdToken(token);
    const db = getAdminFirestore();
    const snap = await db.collection('users').doc(uid).get();
    if (!snap.exists) {
      // Usuario nuevo sin documento aún; fijar claim por defecto
      await setUserClaims(uid, { rol: 'cliente', localId: null });
      return NextResponse.json({ ok: true, rol: 'cliente' });
    }
    const data = snap.data()!;
    const rol = (data.rol ?? 'cliente') as string;
    const localId = typeof data.localId === 'string' ? data.localId : null;
    await setUserClaims(uid, { rol, localId });
    return NextResponse.json({ ok: true, rol, localId });
  } catch (e) {
    console.error('POST /api/users/sync-claims', e);
    return NextResponse.json({ error: 'Error al sincronizar claims' }, { status: 500 });
  }
}
