import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAuth } from '@/lib/api-auth';
import { sanitizeForFirestore } from '@/lib/firestoreUtils';

/** PATCH /api/comisiones/[id] → marcar comisión como pagada (solo maestro) */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request, ['maestro']);
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
  try {
    const { id } = await params;
    const body = await request.json() as { pagado?: boolean };
    if (typeof body.pagado !== 'boolean') {
      return NextResponse.json({ error: 'pagado (boolean) requerido' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const ref = db.collection('comisiones').doc(id);
    const snap = await ref.get();

    if (!snap.exists) {
      return NextResponse.json({ error: 'Comisión no encontrada' }, { status: 404 });
    }

    const updates: Record<string, unknown> = { pagado: body.pagado };
    if (body.pagado) {
      updates.pagadoAt = FieldValue.serverTimestamp();
    }

    await ref.update(sanitizeForFirestore(updates));

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('PATCH /api/comisiones/[id]', e);
    return NextResponse.json({ error: 'Error al actualizar comisión' }, { status: 500 });
  }
}
