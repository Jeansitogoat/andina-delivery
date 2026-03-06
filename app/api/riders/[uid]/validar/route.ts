import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/api-auth';
import { FieldValue } from 'firebase-admin/firestore';

/** POST /api/riders/[uid]/validar → riderStatus = 'approved' (solo central o maestro) */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    await requireAuth(request, ['central', 'maestro']);
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
  try {
    const { uid } = await params;
    const db = getAdminFirestore();
    const ref = db.collection('users').doc(uid);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.rol !== 'rider') {
      return NextResponse.json({ error: 'Rider no encontrado' }, { status: 404 });
    }
    await ref.update({
      riderStatus: 'approved',
      updatedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('POST /api/riders/[uid]/validar', e);
    return NextResponse.json({ error: 'Error al validar' }, { status: 500 });
  }
}
