import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAuth } from '@/lib/api-auth';
import { riderEstadoPatchSchema } from '@/lib/schemas/riderEstado';

/** PATCH /api/riders/[uid]/estado → el rider actualiza su estado manual (disponible, fuera_servicio). */
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

    const body = await request.json();
    const parse = riderEstadoPatchSchema.safeParse(body);
    if (!parse.success) {
      const flat = parse.error.flatten().fieldErrors;
      const firstMessage = Object.values(flat).flat().find(Boolean) || 'Datos inválidos';
      return NextResponse.json({ error: String(firstMessage), fieldErrors: flat }, { status: 400 });
    }
    const estadoRider = parse.data.estadoRider;

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
