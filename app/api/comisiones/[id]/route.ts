import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAuth } from '@/lib/api-auth';
import { sanitizeForFirestore } from '@/lib/firestoreUtils';
import { comisionPatchSchema } from '@/lib/schemas/comisionPatch';

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
    const body = await request.json();
    const parse = comisionPatchSchema.safeParse(body);
    if (!parse.success) {
      const flat = parse.error.flatten().fieldErrors;
      const firstMessage = Object.values(flat).flat().find(Boolean) || 'Datos inválidos';
      return NextResponse.json({ error: String(firstMessage), fieldErrors: flat }, { status: 400 });
    }
    const { pagado } = parse.data;

    const db = getAdminFirestore();
    const ref = db.collection('comisiones').doc(id);
    const snap = await ref.get();

    if (!snap.exists) {
      return NextResponse.json({ error: 'Comisión no encontrada' }, { status: 404 });
    }

    const updates: Record<string, unknown> = { pagado };
    if (pagado) {
      updates.pagadoAt = FieldValue.serverTimestamp();
    }

    await ref.update(sanitizeForFirestore(updates));

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('PATCH /api/comisiones/[id]', e);
    return NextResponse.json({ error: 'Error al actualizar comisión' }, { status: 500 });
  }
}
