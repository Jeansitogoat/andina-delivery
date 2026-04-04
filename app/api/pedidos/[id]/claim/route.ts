import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAuth } from '@/lib/api-auth';
import { isRateLimited } from '@/lib/rateLimit';
import { getRiderProfileForPedidoAssignment } from '@/lib/rider-profile-admin';

/** POST /api/pedidos/[id]/claim → rider reclama un pedido nocturno si no tiene riderId asignado. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (isRateLimited(request)) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes. Espera un momento.' },
      { status: 429 }
    );
  }

  let auth: { uid: string; rol: string };
  try {
    auth = await requireAuth(request, ['rider']);
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }

  try {
    const { id } = await params;
    const db = getAdminFirestore();
    const ref = db.collection('pedidos').doc(id);
    const riderProf = await getRiderProfileForPedidoAssignment(db, auth.uid);
    const riderNombre = riderProf.displayName;

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        return { status: 404 as const, body: { error: 'Pedido no encontrado' } };
      }
      const data = snap.data() as { riderId?: string | null };
      const currentRiderId = data.riderId ?? null;
      if (currentRiderId && currentRiderId !== auth.uid) {
        return { status: 409 as const, body: { error: 'Pedido ya fue tomado por otro rider', reason: 'taken' } };
      }
      if (currentRiderId === auth.uid) {
        // Ya asignado a este rider: idempotente
        return { status: 200 as const, body: { ok: true, alreadyAssigned: true } };
      }
      tx.update(ref, {
        riderId: auth.uid,
        estado: 'asignado',
        riderNombre,
        riderRatingSnapshot: riderProf.riderRatingSnapshot,
        riderPhotoURLSnapshot: riderProf.riderPhotoURLSnapshot,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { status: 200 as const, body: { ok: true } };
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (e) {
    console.error('POST /api/pedidos/[id]/claim', e);
    return NextResponse.json({ error: 'Error al reclamar pedido' }, { status: 500 });
  }
}

