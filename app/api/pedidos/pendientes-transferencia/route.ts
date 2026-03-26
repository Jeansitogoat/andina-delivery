import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/api-auth';

/** GET /api/pedidos/pendientes-transferencia?localId=xxx → pedidos del local con transferencia pendiente. */
export async function GET(request: Request) {
  let auth: { uid: string; rol: string };
  try {
    auth = await requireAuth(request, ['local', 'maestro']);
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
  try {
    const { searchParams } = new URL(request.url);
    const localId = searchParams.get('localId')?.trim();
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '15', 10) || 15, 1), 20);
    const cursor = searchParams.get('cursor')?.trim() || null;
    if (!localId) {
      return NextResponse.json({ error: 'localId requerido' }, { status: 400 });
    }
    if (auth.rol === 'local') {
      const { getAdminFirestore } = await import('@/lib/firebase-admin');
      const db = getAdminFirestore();
      const userSnap = await db.collection('users').doc(auth.uid).get();
      const userLocalId = userSnap.data()?.localId ?? null;
      if (userLocalId !== localId) {
        return NextResponse.json({ error: 'No autorizado para este local' }, { status: 403 });
      }
    }
    const db = getAdminFirestore();
    let snap;
    try {
      let query = db
        .collection('pedidos')
        .where('localId', '==', localId)
        .where('paymentMethod', '==', 'transferencia')
        .where('paymentConfirmed', '==', false)
        .orderBy('timestamp', 'desc')
        .limit(limit);
      if (cursor) {
        const cursorSnap = await db.collection('pedidos').doc(cursor).get();
        if (cursorSnap.exists) query = query.startAfter(cursorSnap);
      }
      snap = await query.get();
    } catch {
      snap = await db
        .collection('pedidos')
        .where('localId', '==', localId)
        .orderBy('timestamp', 'desc')
        .limit(50)
        .get();
    }

    const pedidos = snap.docs
      .map((d) => {
        const data = d.data();
        if (data.paymentMethod !== 'transferencia' || data.paymentConfirmed === true) return null;
        return {
          orderId: d.id,
          orderNum: `#${d.id}`,
          total: data.total || 0,
          direccion: data.clienteDireccion || '—',
          items: data.items || [],
          createdAt: data.timestamp || 0,
          comprobanteBase64: data.comprobanteBase64 ?? null,
          comprobanteFileName: data.comprobanteFileName ?? null,
          comprobanteMimeType: data.comprobanteMimeType ?? null,
        };
      })
      .filter(Boolean);

    return NextResponse.json(pedidos);
  } catch (e) {
    console.error('GET /api/pedidos/pendientes-transferencia', e);
    return NextResponse.json({ error: 'Error al cargar pendientes' }, { status: 500 });
  }
}
