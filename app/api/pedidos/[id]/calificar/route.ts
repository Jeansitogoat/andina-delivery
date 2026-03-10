import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAuth } from '@/lib/api-auth';
import { calificarPostSchema } from '@/lib/schemas/calificar';

/** POST /api/pedidos/[id]/calificar → cliente califica local y rider tras entrega. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let uid: string;
  let clienteNombre: string;
  try {
    const auth = await requireAuth(request, ['cliente']);
    uid = auth.uid;
    const db = getAdminFirestore();
    const userSnap = await db.collection('users').doc(uid).get();
    clienteNombre = userSnap.data()?.displayName || userSnap.data()?.email || 'Cliente';
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
  try {
    const { id } = await params;
    const body = await request.json();
    const parse = calificarPostSchema.safeParse(body);
    if (!parse.success) {
      const flat = parse.error.flatten().fieldErrors;
      const firstMessage = Object.values(flat).flat().find(Boolean) || 'Datos inválidos';
      return NextResponse.json({ error: String(firstMessage), fieldErrors: flat }, { status: 400 });
    }
    const bodyData = parse.data;
    const estrellasLocal = typeof bodyData.estrellasLocal === 'number' ? Math.min(5, Math.max(0, bodyData.estrellasLocal)) : 0;
    const estrellasRider = typeof bodyData.estrellasRider === 'number' ? Math.min(5, Math.max(0, bodyData.estrellasRider)) : 0;
    const reseñaLocal = typeof bodyData.reseñaLocal === 'string' ? bodyData.reseñaLocal.trim().slice(0, 500) : '';

    const db = getAdminFirestore();
    const ref = db.collection('pedidos').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }
    const data = snap.data()!;
    if (data.clienteId !== uid) {
      return NextResponse.json({ error: 'Solo el cliente del pedido puede calificar' }, { status: 403 });
    }
    if (data.estado !== 'entregado') {
      return NextResponse.json({ error: 'Solo puedes calificar pedidos entregados' }, { status: 400 });
    }
    if (data.calificacionLocal !== undefined || data.calificacionRider !== undefined) {
      return NextResponse.json({ error: 'Este pedido ya fue calificado' }, { status: 400 });
    }

    const localId = data.localId ?? null;
    const riderId = data.riderId ?? null;

    await ref.update({
      calificacionLocal: estrellasLocal,
      calificacionRider: estrellasRider,
      reseñaLocal: reseñaLocal || null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (localId && (estrellasLocal > 0 || reseñaLocal)) {
      await db.collection('reviews').add({
        localId,
        pedidoId: id,
        author: data.clienteNombre || clienteNombre,
        rating: estrellasLocal,
        comment: reseñaLocal || '',
        createdAt: FieldValue.serverTimestamp(),
      });
      const localRef = db.collection('locales').doc(localId);
      const localSnap = await localRef.get();
      if (localSnap.exists) {
        const d = localSnap.data()!;
        const ratingSum = (d.ratingSum ?? (d.rating ?? 0) * (d.reviewsCount ?? 1)) + estrellasLocal;
        const ratingCount = (d.reviewsCount ?? 0) + 1;
        await localRef.update({
          rating: Math.round((ratingSum / ratingCount) * 10) / 10,
          ratingSum,
          reviewsCount: ratingCount,
          reviews: ratingCount,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    if (riderId && estrellasRider > 0) {
      const riderRef = db.collection('users').doc(riderId);
      const riderSnap = await riderRef.get();
      if (riderSnap.exists) {
        const d = riderSnap.data()!;
        const ratingSum = (d.ratingSum ?? (d.ratingPromedio ?? 0) * (d.ratingCount ?? 1)) + estrellasRider;
        const ratingCount = (d.ratingCount ?? 0) + 1;
        await riderRef.update({
          ratingPromedio: Math.round((ratingSum / ratingCount) * 10) / 10,
          ratingSum,
          ratingCount,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('POST /api/pedidos/[id]/calificar', e);
    return NextResponse.json({ error: 'Error al guardar calificación' }, { status: 500 });
  }
}
