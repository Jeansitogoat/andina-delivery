import { NextResponse } from 'next/server';
import type { DocumentData } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/api-auth';
import type { PedidoCentral } from '@/lib/types';

const DEFAULT_PAGE = 18;
const MAX_PAGE = 20;
const FALLBACK_FETCH = 50;

function mapDocToPedido(id: string, data: DocumentData): PedidoCentral {
  return {
    id,
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
    nombreLocal: typeof data.nombreLocal === 'string' ? data.nombreLocal : undefined,
    logoLocal: typeof data.logoLocal === 'string' ? data.logoLocal : undefined,
    fotoLocal: typeof data.fotoLocal === 'string' ? data.fotoLocal : undefined,
    telefonoLocal: typeof data.telefonoLocal === 'string' ? data.telefonoLocal : undefined,
    codigoVerificacion: data.codigoVerificacion || '',
    propina: data.propina ?? 0,
    ...(data.itemsCart && typeof data.itemsCart === 'object' && data.itemsCart.localId && Array.isArray(data.itemsCart.items)
      ? { itemsCart: data.itemsCart as PedidoCentral['itemsCart'] }
      : {}),
  };
}

/** GET /api/mis-pedidos?limit=18&cursor=docId → pedidos del cliente (paginado). */
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
    const { searchParams } = new URL(request.url);
    const limitParam = Math.min(
      Math.max(parseInt(searchParams.get('limit') || String(DEFAULT_PAGE), 10) || DEFAULT_PAGE, 1),
      MAX_PAGE
    );
    const cursor = searchParams.get('cursor')?.trim() || null;

    const db = getAdminFirestore();
    try {
      let query = db
        .collection('pedidos')
        .where('clienteId', '==', uid)
        .orderBy('timestamp', 'desc')
        .limit(limitParam);
      if (cursor) {
        const cursorSnap = await db.collection('pedidos').doc(cursor).get();
        if (cursorSnap.exists) {
          query = query.startAfter(cursorSnap);
        }
      }
      const snap = await query.get();
      const pedidos: PedidoCentral[] = snap.docs.map((d) => mapDocToPedido(d.id, d.data()));
      const nextCursor = snap.docs.length === limitParam ? snap.docs[snap.docs.length - 1].id : null;
      return NextResponse.json({ pedidos, nextCursor });
    } catch (err) {
      const msg = (err as Error)?.message ?? '';
      if (msg.includes('index') || msg.includes('Index')) {
        const raw = await db.collection('pedidos').where('clienteId', '==', uid).limit(FALLBACK_FETCH).get();
        const sorted = raw.docs.sort((a, b) => (b.data().timestamp || 0) - (a.data().timestamp || 0));
        const start = cursor ? Math.max(0, sorted.findIndex((d) => d.id === cursor) + 1) : 0;
        const page = sorted.slice(start, start + limitParam);
        const pedidos: PedidoCentral[] = page.map((d) => mapDocToPedido(d.id, d.data()));
        const nextCursor = start + limitParam < sorted.length ? page[page.length - 1]?.id ?? null : null;
        return NextResponse.json({ pedidos, nextCursor });
      }
      throw err;
    }
  } catch (e) {
    console.error('GET /api/mis-pedidos', e);
    return NextResponse.json({ error: 'Error al cargar pedidos' }, { status: 500 });
  }
}
