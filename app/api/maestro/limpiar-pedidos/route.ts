import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/api-auth';

const BATCH_SIZE = 500;

/** POST /api/maestro/limpiar-pedidos → borra todos los pedidos (solo maestro). Deja paneles como nuevos. */
export async function POST(request: Request) {
  try {
    await requireAuth(request, ['maestro']);
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }

  try {
    const db = getAdminFirestore();
    let totalEliminados = 0;

    // Firestore batch limit is 500; we delete in batches
    let hasMore = true;
    while (hasMore) {
      const snap = await db.collection('pedidos').limit(BATCH_SIZE).get();
      if (snap.empty) break;

      const batch = db.batch();
      snap.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      totalEliminados += snap.docs.length;
      hasMore = snap.docs.length === BATCH_SIZE;
    }

    return NextResponse.json({ ok: true, eliminados: totalEliminados });
  } catch (e) {
    console.error('POST /api/maestro/limpiar-pedidos', e);
    return NextResponse.json({ error: 'Error al limpiar pedidos' }, { status: 500 });
  }
}
