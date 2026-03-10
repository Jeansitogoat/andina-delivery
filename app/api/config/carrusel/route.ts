import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAuth } from '@/lib/api-auth';
import { revalidatePath } from 'next/cache';
import { configCarruselPatchSchema } from '@/lib/schemas/configCarrusel';

/** PATCH /api/config/carrusel → actualizar intervalo del carrusel (solo maestro) */
export async function PATCH(request: Request) {
  try {
    await requireAuth(request, ['maestro']);
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
  try {
    const body = await request.json();
    const parse = configCarruselPatchSchema.safeParse(body);
    if (!parse.success) {
      const flat = parse.error.flatten().fieldErrors;
      const firstMessage = Object.values(flat).flat().find(Boolean) || 'Datos inválidos';
      return NextResponse.json({ error: String(firstMessage), fieldErrors: flat }, { status: 400 });
    }
    const intervalSeconds = parse.data.intervalSeconds != null && !Number.isNaN(parse.data.intervalSeconds)
      ? Math.min(60, Math.max(2, Math.round(parse.data.intervalSeconds)))
      : 4;
    const clamped = intervalSeconds;

    const db = getAdminFirestore();
    await db.collection('config').doc('carrusel').set(
      { intervalSeconds: clamped, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    revalidatePath('/');
    revalidatePath('/panel/maestro');
    return NextResponse.json({ ok: true, intervalSeconds: clamped });
  } catch (e) {
    console.error('PATCH /api/config/carrusel', e);
    return NextResponse.json({ error: 'Error al actualizar configuración' }, { status: 500 });
  }
}
