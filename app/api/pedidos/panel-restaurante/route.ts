import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/api-auth';
import type { EstadoPedido } from '@/lib/types';

const ESTADOS_ACTIVOS: EstadoPedido[] = ['confirmado', 'preparando', 'listo', 'esperando_rider', 'asignado', 'en_camino'];
const DEFAULT_ACTIVE_LIMIT = 20;
const MAX_ACTIVE_LIMIT = 50;
const DEFAULT_FETCH_LIMIT = 60;
const FALLBACK_FETCH_LIMIT = 80;

type ActiveOrder = {
  id: string;
  clienteNombre: string;
  items: string[];
  total: number;
  timestamp: number;
  estado: EstadoPedido;
  clienteDireccion: string;
  batchId?: string | null;
  batchLeaderLocalId?: string | null;
  deliveryType?: 'delivery' | 'pickup';
  paymentMethod?: 'efectivo' | 'transferencia';
  serviceCost?: number;
};

type PendingTransferOrder = {
  orderId: string;
  orderNum: string;
  total: number;
  direccion: string;
  items: string[];
  createdAt: number;
  comprobanteBase64?: string | null;
  comprobanteFileName?: string | null;
  comprobanteMimeType?: string | null;
};

function toActiveOrder(id: string, data: Record<string, unknown>): ActiveOrder {
  return {
    id,
    clienteNombre: (data.clienteNombre as string) || 'Cliente',
    items: Array.isArray(data.items) ? (data.items as string[]) : [],
    total: Number(data.total ?? 0),
    timestamp: Number(data.timestamp ?? 0),
    estado: ((data.estado as EstadoPedido) || 'confirmado'),
    clienteDireccion: (data.clienteDireccion as string) || '—',
    batchId: (data.batchId as string) ?? null,
    batchLeaderLocalId: (data.batchLeaderLocalId as string) ?? null,
    deliveryType: data.deliveryType === 'pickup' ? 'pickup' : 'delivery',
    paymentMethod: data.paymentMethod === 'transferencia' ? 'transferencia' : 'efectivo',
    serviceCost: typeof data.serviceCost === 'number' && !Number.isNaN(data.serviceCost) ? data.serviceCost : undefined,
  };
}

function toPendingTransfer(id: string, data: Record<string, unknown>): PendingTransferOrder {
  return {
    orderId: id,
    orderNum: `#${id}`,
    total: Number(data.total ?? 0),
    direccion: (data.clienteDireccion as string) || '—',
    items: Array.isArray(data.items) ? (data.items as string[]) : [],
    createdAt: Number(data.timestamp ?? 0),
    comprobanteBase64: (data.comprobanteBase64 as string | null) ?? null,
    comprobanteFileName: (data.comprobanteFileName as string | null) ?? null,
    comprobanteMimeType: (data.comprobanteMimeType as string | null) ?? null,
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
    const activeLimit = Math.min(
      Math.max(parseInt(searchParams.get('activeLimit') || String(DEFAULT_ACTIVE_LIMIT), 10) || DEFAULT_ACTIVE_LIMIT, 1),
      MAX_ACTIVE_LIMIT
    );
    const cursor = searchParams.get('cursor')?.trim() || null;
    const localIdParam = searchParams.get('localId')?.trim() || null;

    let localId = localIdParam;
    if (auth.rol === 'local') {
      const userSnap = await db.collection('users').doc(auth.uid).get();
      localId = (userSnap.data()?.localId as string | null) ?? null;
    }

    if (!localId) {
      return NextResponse.json({ activos: [], pendientesTransferencia: [], nextCursorActivos: null });
    }

    if (auth.rol === 'local' && localIdParam && localIdParam !== localId) {
      return NextResponse.json({ error: 'No autorizado para este local' }, { status: 403 });
    }

    try {
      let query = db
        .collection('pedidos')
        .where('localId', '==', localId)
        .orderBy('timestamp', 'desc')
        .limit(DEFAULT_FETCH_LIMIT);
      if (cursor) {
        const cursorSnap = await db.collection('pedidos').doc(cursor).get();
        if (cursorSnap.exists) query = query.startAfter(cursorSnap);
      }
      const snap = await query.get();

      const activos: ActiveOrder[] = [];
      const pendientesTransferencia: PendingTransferOrder[] = [];

      for (const doc of snap.docs) {
        const data = doc.data() as Record<string, unknown>;
        const estado = (data.estado as EstadoPedido) || 'confirmado';
        const isPendingTransfer = data.paymentMethod === 'transferencia' && data.paymentConfirmed === false;
        if (isPendingTransfer) {
          pendientesTransferencia.push(toPendingTransfer(doc.id, data));
        }
        if (ESTADOS_ACTIVOS.includes(estado) && !isPendingTransfer) {
          activos.push(toActiveOrder(doc.id, data));
        }
      }

      const activePage = activos.slice(0, activeLimit);
      const nextCursorActivos =
        activePage.length === activeLimit && snap.docs.length === DEFAULT_FETCH_LIMIT
          ? activePage[activePage.length - 1]?.id ?? null
          : null;

      return NextResponse.json({
        activos: activePage,
        pendientesTransferencia: pendientesTransferencia.slice(0, activeLimit),
        nextCursorActivos,
      });
    } catch (err) {
      const msg = (err as Error)?.message ?? '';
      if (msg.includes('index') || msg.includes('Index')) {
        const snap = await db
          .collection('pedidos')
          .where('localId', '==', localId)
          .limit(FALLBACK_FETCH_LIMIT)
          .get();
        const ordered = snap.docs.sort((a, b) => (Number(b.data().timestamp ?? 0) - Number(a.data().timestamp ?? 0)));
        const activos: ActiveOrder[] = [];
        const pendientesTransferencia: PendingTransferOrder[] = [];
        for (const doc of ordered) {
          const data = doc.data() as Record<string, unknown>;
          const estado = (data.estado as EstadoPedido) || 'confirmado';
          const isPendingTransfer = data.paymentMethod === 'transferencia' && data.paymentConfirmed === false;
          if (isPendingTransfer) pendientesTransferencia.push(toPendingTransfer(doc.id, data));
          if (ESTADOS_ACTIVOS.includes(estado) && !isPendingTransfer) activos.push(toActiveOrder(doc.id, data));
        }
        const start = cursor ? Math.max(0, activos.findIndex((a) => a.id === cursor) + 1) : 0;
        const activePage = activos.slice(start, start + activeLimit);
        const nextCursorActivos = start + activeLimit < activos.length ? activePage[activePage.length - 1]?.id ?? null : null;
        return NextResponse.json({
          activos: activePage,
          pendientesTransferencia: pendientesTransferencia.slice(0, activeLimit),
          nextCursorActivos,
        });
      }
      throw err;
    }
  } catch (e) {
    console.error('GET /api/pedidos/panel-restaurante', e);
    return NextResponse.json({ error: 'Error al cargar panel restaurante' }, { status: 500 });
  }
}
