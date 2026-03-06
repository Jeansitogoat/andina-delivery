import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAuth } from '@/lib/api-auth';

const ESTADOS_VALIDOS = ['disponible', 'ausente', 'fuera_servicio'] as const;

/** PATCH /api/riders/[uid]/estado → el rider actualiza su estado manual (disponible, ausente, fuera_servicio). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  let auth: { uid: string; rol: string };
  try {
    auth = await requireAuth(request, ['rider', 'maestro']);
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
  try {
    const { uid } = await params;
    if (auth.rol === 'rider' && auth.uid !== uid) {
      return NextResponse.json({ error: 'Solo puedes actualizar tu propio estado' }, { status: 403 });
    }

    const body = await request.json() as { estadoRider?: string };
    const estadoRider = body.estadoRider;
    if (!estadoRider || !ESTADOS_VALIDOS.includes(estadoRider as (typeof ESTADOS_VALIDOS)[number])) {
      return NextResponse.json(
        { error: 'estadoRider debe ser uno de: disponible, ausente, fuera_servicio' },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    await db.collection('users').doc(uid).update({
      estadoRider,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true, estadoRider });
  } catch (e) {
    console.error('PATCH /api/riders/[uid]/estado', e);
    return NextResponse.json({ error: 'Error al actualizar estado' }, { status: 500 });
  }
}
