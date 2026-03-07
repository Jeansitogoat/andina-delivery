import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/api-auth';
import type { PedidoCentral } from '@/lib/types';

/** GET /api/mis-pedidos → pedidos del cliente autenticado (rol cliente). */
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
    let snap;
    try {
      snap = await db
        .collection('pedidos')
        .where('clienteId', '==', uid)
        .orderBy('timestamp', 'desc')
        .limit(50)
        .get();
    } catch (err) {
      const msg = (err as Error)?.message ?? '';
      if (msg.includes('index') || msg.includes('Index')) {
        const raw = await db.collection('pedidos').where('clienteId', '==', uid).limit(50).get();
        const docs = raw.docs.sort((a, b) => (b.data().timestamp || 0) - (a.data().timestamp || 0));
        snap = { docs };
      } else {
        throw err;
      }
    }
    const pedidos: PedidoCentral[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        clienteId: data.clienteId ?? null,
        restaurante: data.restaurante || '—',
        restauranteDireccion: data.restauranteDireccion || '—',
        clienteNombre: data.clienteNombre || 'Cliente',
        clienteDireccion: data.clienteDireccion || '—',
        clienteTelefono: data.clienteTelefono || '',
        items: data.items || [],
        total: data.total || 0,
        estado: data.estado || 'confirmado',
        riderId: data.riderId ?? null,
        hora: data.hora || '',
        timestamp: data.timestamp || 0,
        distancia: data.distancia || '—',
        localId: data.localId ?? null,
        codigoVerificacion: data.codigoVerificacion || '',
        propina: data.propina ?? 0,
        ...(data.itemsCart && typeof data.itemsCart === 'object' && data.itemsCart.localId && Array.isArray(data.itemsCart.items)
          ? { itemsCart: data.itemsCart as PedidoCentral['itemsCart'] }
          : {}),
      };
    });
    return NextResponse.json({ pedidos });
  } catch (e) {
    console.error('GET /api/mis-pedidos', e);
    return NextResponse.json({ error: 'Error al cargar pedidos' }, { status: 500 });
  }
}
