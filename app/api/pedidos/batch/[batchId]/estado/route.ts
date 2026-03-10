import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAuth } from '@/lib/api-auth';
import { batchEstadoPatchSchema } from '@/lib/schemas/batchEstado';

/** PATCH /api/pedidos/batch/[batchId]/estado → actualiza estado de todos los pedidos del batch (rider: en_camino). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    await requireAuth(request, ['rider', 'maestro']);
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
  try {
    const { batchId } = await params;
    const body = await request.json();
    const parse = batchEstadoPatchSchema.safeParse(body);
    if (!parse.success || !batchId?.trim()) {
      if (!parse.success) {
        const flat = parse.error.flatten().fieldErrors;
        const firstMessage = Object.values(flat).flat().find(Boolean) || 'Datos inválidos';
        return NextResponse.json({ error: String(firstMessage), fieldErrors: flat }, { status: 400 });
      }
      return NextResponse.json(
        { error: 'batchId y estado (en_camino) requeridos' },
        { status: 400 }
      );
    }
    const estado = parse.data.estado;

    const db = getAdminFirestore();
    const snap = await db
      .collection('pedidos')
      .where('batchId', '==', batchId.trim())
      .get();

    if (snap.empty) {
      return NextResponse.json({ error: 'Batch no encontrado' }, { status: 404 });
    }

    for (const d of snap.docs) {
      await d.ref.update({
        estado,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('PATCH /api/pedidos/batch/[batchId]/estado', e);
    return NextResponse.json(
      { error: 'Error al actualizar batch' },
      { status: 500 }
    );
  }
}
