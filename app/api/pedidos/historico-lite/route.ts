import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/api-auth';
import { getOrderMoney } from '@/lib/order-money';

type LitePedido = {
  id: string;
  clienteNombre: string;
  clienteDireccion: string;
  items: string[];
  timestamp: number;
  subtotalBase: number;
  totalCliente: number;
};

function toLitePedido(id: string, data: Record<string, unknown>): LitePedido {
  const money = getOrderMoney(data);
  return {
    id,
    clienteNombre: typeof data.clienteNombre === 'string' ? data.clienteNombre : 'Cliente',
    clienteDireccion: typeof data.clienteDireccion === 'string' ? data.clienteDireccion : '—',
    items: Array.isArray(data.items) ? (data.items as string[]) : [],
    timestamp: Number(data.timestamp ?? 0),
    subtotalBase: money.subtotalBase,
    totalCliente: money.totalCliente,
  };
}

export async function GET(request: Request) {
  let auth: { uid: string; rol: string };
  try {
    auth = await requireAuth(request, ['local', 'maestro']);
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }

  try {
    const db = getAdminFirestore();
    const { searchParams } = new URL(request.url);
    const beforeTsParam = Number(searchParams.get('antesDeTs') || 0);
    const beforeTs = Number.isFinite(beforeTsParam) && beforeTsParam > 0 ? beforeTsParam : Date.now();
    const limitParam = Math.min(Math.max(Number(searchParams.get('limit') || 15), 1), 20);
    const cursor = searchParams.get('cursor')?.trim() || null;

    let localId = searchParams.get('localId')?.trim() || null;
    if (auth.rol === 'local') {
      const userSnap = await db.collection('users').doc(auth.uid).get();
      localId = (userSnap.data()?.localId as string | null) ?? null;
    }

    if (!localId) {
      return NextResponse.json({ pedidos: [], nextCursor: null });
    }

    try {
      let query = db
        .collection('pedidos')
        .where('localId', '==', localId)
        .where('estado', '==', 'entregado')
        .where('timestamp', '<', beforeTs)
        .orderBy('timestamp', 'desc')
        .limit(limitParam);

      if (cursor) {
        const cursorSnap = await db.collection('pedidos').doc(cursor).get();
        if (cursorSnap.exists) query = query.startAfter(cursorSnap);
      }

      const snap = await query.get();
      const pedidos = snap.docs.map((doc) => toLitePedido(doc.id, doc.data() as Record<string, unknown>));
      const nextCursor = snap.docs.length === limitParam ? snap.docs[snap.docs.length - 1]?.id ?? null : null;
      return NextResponse.json({ pedidos, nextCursor });
    } catch (err) {
      const msg = (err as Error)?.message ?? '';
      if (!msg.includes('index') && !msg.includes('Index')) throw err;

      const raw = await db.collection('pedidos').where('localId', '==', localId).limit(80).get();
      const filtered = raw.docs
        .filter((doc) => doc.data().estado === 'entregado')
        .filter((doc) => Number(doc.data().timestamp ?? 0) < beforeTs)
        .sort((a, b) => Number(b.data().timestamp ?? 0) - Number(a.data().timestamp ?? 0));
      const start = cursor ? Math.max(0, filtered.findIndex((doc) => doc.id === cursor) + 1) : 0;
      const page = filtered.slice(start, start + limitParam);
      const pedidos = page.map((doc) => toLitePedido(doc.id, doc.data() as Record<string, unknown>));
      const nextCursor = start + limitParam < filtered.length ? page[page.length - 1]?.id ?? null : null;
      return NextResponse.json({ pedidos, nextCursor });
    }
  } catch (e) {
    console.error('GET /api/pedidos/historico-lite', e);
    return NextResponse.json({ error: 'Error al cargar historial anterior' }, { status: 500 });
  }
}
