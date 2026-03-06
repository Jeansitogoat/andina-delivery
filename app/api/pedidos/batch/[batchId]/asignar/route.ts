import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAuth } from '@/lib/api-auth';

/** PATCH /api/pedidos/batch/[batchId]/asignar → asigna un rider a todos los pedidos del batch (panel central). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  let auth: { uid: string; rol: string };
  try {
    auth = await requireAuth(request, ['central', 'maestro']);
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }

  try {
    const { batchId } = await params;
    const body = (await request.json()) as { riderId?: string };
    const riderId = typeof body.riderId === 'string' ? body.riderId.trim() : '';

    if (!batchId?.trim() || !riderId) {
      return NextResponse.json(
        { error: 'batchId y riderId son obligatorios' },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    const batchIdTrim = batchId.trim();

    const snap = await db
      .collection('pedidos')
      .where('batchId', '==', batchIdTrim)
      .get();

    if (snap.empty) {
      return NextResponse.json(
        { error: 'Batch no encontrado' },
        { status: 404 }
      );
    }

    const writer = db.batch();
    for (const d of snap.docs) {
      writer.update(d.ref, {
        estado: 'asignado',
        riderId,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await writer.commit();

    return NextResponse.json({
      ok: true,
      updated: snap.size,
      batchId: batchIdTrim,
      riderId,
      asignadoPor: auth.uid,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('PATCH /api/pedidos/batch/[batchId]/asignar', e);
    return NextResponse.json(
      { error: 'Error al asignar rider al batch' },
      { status: 500 }
    );
  }
}

