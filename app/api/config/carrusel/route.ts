import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAuth } from '@/lib/api-auth';

/** PATCH /api/config/carrusel → actualizar intervalo del carrusel (solo maestro) */
export async function PATCH(request: Request) {
  try {
    await requireAuth(request, ['maestro']);
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
  try {
    const body = await request.json() as { intervalSeconds?: number };
    const raw = body.intervalSeconds;
    const intervalSeconds = typeof raw === 'number' && !Number.isNaN(raw)
      ? Math.round(raw)
      : 4;
    const clamped = Math.min(60, Math.max(2, intervalSeconds));

    const db = getAdminFirestore();
    await db.collection('config').doc('carrusel').set(
      { intervalSeconds: clamped, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    return NextResponse.json({ ok: true, intervalSeconds: clamped });
  } catch (e) {
    console.error('PATCH /api/config/carrusel', e);
    return NextResponse.json({ error: 'Error al actualizar configuración' }, { status: 500 });
  }
}
