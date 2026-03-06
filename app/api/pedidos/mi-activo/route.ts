import { NextResponse } from 'next/server';
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/api-auth';

/** GET /api/pedidos/mi-activo → ID del pedido activo del cliente (no entregado ni cancelado). */
export async function GET(request: Request) {
  let uid: string;
  try {
    const auth = await requireAuth(request, ['cliente']);
    uid = auth.uid;
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
  try {
    const db = getAdminFirestore();
    let docs: QueryDocumentSnapshot[];
    try {
      const snap = await db
        .collection('pedidos')
        .where('clienteId', '==', uid)
        .orderBy('timestamp', 'desc')
        .limit(20)
        .get();
      docs = snap.docs;
    } catch (err) {
      const msg = (err as Error)?.message ?? '';
      if (msg.includes('index') || msg.includes('Index')) {
        const raw = await db.collection('pedidos').where('clienteId', '==', uid).limit(20).get();
        docs = raw.docs.sort((a, b) => (b.data().timestamp || 0) - (a.data().timestamp || 0));
      } else {
        throw err;
      }
    }
    const excluidos = ['entregado', 'cancelado_local', 'cancelado_cliente'];
    const activo = docs.find((d) => !excluidos.includes(String(d.data().estado || '')));
    if (!activo) {
      return NextResponse.json({ id: null });
    }
    return NextResponse.json({ id: activo.id });
  } catch (e) {
    console.error('GET /api/pedidos/mi-activo', e);
    return NextResponse.json({ error: 'Error al obtener pedido activo' }, { status: 500 });
  }
}
