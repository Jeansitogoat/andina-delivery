import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue, type DocumentSnapshot } from 'firebase-admin/firestore';
import { requireAuth } from '@/lib/api-auth';
import type { PedidoCentral } from '@/lib/types';
import { sendFCMToRole } from '@/lib/fcm-send-server';

const ESTADOS_ACTIVOS: string[] = ['confirmado', 'preparando', 'listo', 'esperando_rider', 'asignado', 'en_camino'];
const LIMIT_POLL = 50;
const LIMIT_ENTREGADOS = 4;

function docToPedidoCentral(d: DocumentSnapshot): PedidoCentral {
  const data = d.data() || {};
  return {
    id: d.id,
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
    batchId: data.batchId ?? null,
    batchIndex: data.batchIndex ?? null,
    batchLeaderLocalId: data.batchLeaderLocalId ?? null,
    deliveryType: (data.deliveryType === 'pickup' ? 'pickup' : 'delivery') as 'delivery' | 'pickup',
  };
}

function filterTransferenciaNoConfirmada(d: DocumentSnapshot): boolean {
  const data = d.data();
  if (data?.paymentMethod === 'transferencia' && data?.paymentConfirmed === false) return false;
  return true;
}

/** GET /api/pedidos?localId=xxx&soloActivos=true | estado=entregado&limit=4&cursor=xxx → pedidos del local. */
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
    const db = getAdminFirestore();
    const soloActivos = searchParams.get('soloActivos') === 'true';
    const estadoEntregado = searchParams.get('estado') === 'entregado';
    const limitParam = Math.min(Math.max(parseInt(searchParams.get('limit') || String(LIMIT_ENTREGADOS), 10) || LIMIT_ENTREGADOS, 1), 20);
    const cursor = searchParams.get('cursor') || null;

    if (auth.rol === 'local') {
      const userSnap = await db.collection('users').doc(auth.uid).get();
      const userLocalId = userSnap.data()?.localId ?? null;
      if (!userLocalId) {
        return NextResponse.json({ pedidos: [], nextCursor: null });
      }

      if (estadoEntregado) {
        try {
          let query = db
            .collection('pedidos')
            .where('localId', '==', userLocalId)
            .where('estado', '==', 'entregado')
            .orderBy('timestamp', 'desc')
            .limit(limitParam);
          if (cursor) {
            const docRef = db.collection('pedidos').doc(cursor);
            const cursorSnap = await docRef.get();
            if (cursorSnap.exists) query = query.startAfter(cursorSnap);
          }
          const snap = await query.get();
          const pedidos: PedidoCentral[] = snap.docs.filter(filterTransferenciaNoConfirmada).map(docToPedidoCentral);
          const nextCursor = snap.docs.length === limitParam ? snap.docs[snap.docs.length - 1].id : null;
          return NextResponse.json({ pedidos, nextCursor });
        } catch (err) {
          const msg = (err as Error)?.message ?? '';
          if (msg.includes('index') || msg.includes('Index')) {
            const snap = await db.collection('pedidos').where('localId', '==', userLocalId).orderBy('timestamp', 'desc').limit(100).get();
            const filtered = snap.docs
              .filter(filterTransferenciaNoConfirmada)
              .filter((d) => (d.data().estado || '') === 'entregado');
            const start = cursor ? Math.min(filtered.findIndex((d) => d.id === cursor) + 1, filtered.length) : 0;
            const page = filtered.slice(start, start + limitParam);
            const pedidos: PedidoCentral[] = page.map(docToPedidoCentral);
            const nextCursor = start + limitParam < filtered.length ? page[page.length - 1]?.id ?? null : null;
            return NextResponse.json({ pedidos, nextCursor });
          }
          throw err;
        }
      }

      try {
        const limit = LIMIT_POLL;
        const snap = await db
          .collection('pedidos')
          .where('localId', '==', userLocalId)
          .orderBy('timestamp', 'desc')
          .limit(limit)
          .get();
        let pedidos: PedidoCentral[] = snap.docs.filter(filterTransferenciaNoConfirmada).map(docToPedidoCentral);
        if (soloActivos) pedidos = pedidos.filter((p) => ESTADOS_ACTIVOS.includes(p.estado));
        return NextResponse.json({ pedidos, nextCursor: null });
      } catch (err) {
        const msg = (err as Error)?.message ?? '';
        if (msg.includes('index') || msg.includes('Index')) {
          const snap = await db.collection('pedidos').where('localId', '==', userLocalId).limit(LIMIT_POLL).get();
          let pedidos: PedidoCentral[] = snap.docs
            .filter(filterTransferenciaNoConfirmada)
            .map(docToPedidoCentral)
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          if (soloActivos) pedidos = pedidos.filter((p) => ESTADOS_ACTIVOS.includes(p.estado));
          return NextResponse.json({ pedidos, nextCursor: null });
        }
        throw err;
      }
    }

    if (auth.rol === 'maestro') {
      const localIdParam = searchParams.get('localId');
      if (!localIdParam || !localIdParam.trim()) {
        return NextResponse.json({ error: 'localId requerido para rol maestro' }, { status: 400 });
      }
      const localIdTrim = localIdParam.trim();

      if (estadoEntregado) {
        try {
          let query = db
            .collection('pedidos')
            .where('localId', '==', localIdTrim)
            .where('estado', '==', 'entregado')
            .orderBy('timestamp', 'desc')
            .limit(limitParam);
          if (cursor) {
            const docRef = db.collection('pedidos').doc(cursor);
            const cursorSnap = await docRef.get();
            if (cursorSnap.exists) query = query.startAfter(cursorSnap);
          }
          const snap = await query.get();
          const pedidos: PedidoCentral[] = snap.docs.filter(filterTransferenciaNoConfirmada).map(docToPedidoCentral);
          const nextCursor = snap.docs.length === limitParam ? snap.docs[snap.docs.length - 1].id : null;
          return NextResponse.json({ pedidos, nextCursor });
        } catch (err) {
          const msg = (err as Error)?.message ?? '';
          if (msg.includes('index') || msg.includes('Index')) {
            const snap = await db.collection('pedidos').where('localId', '==', localIdTrim).orderBy('timestamp', 'desc').limit(100).get();
            const filtered = snap.docs
              .filter(filterTransferenciaNoConfirmada)
              .filter((d) => (d.data().estado || '') === 'entregado');
            const start = cursor ? Math.min(filtered.findIndex((d) => d.id === cursor) + 1, filtered.length) : 0;
            const page = filtered.slice(start, start + limitParam);
            const pedidos: PedidoCentral[] = page.map(docToPedidoCentral);
            const nextCursor = start + limitParam < filtered.length ? page[page.length - 1]?.id ?? null : null;
            return NextResponse.json({ pedidos, nextCursor });
          }
          throw err;
        }
      }

      try {
        const snap = await db
          .collection('pedidos')
          .where('localId', '==', localIdTrim)
          .orderBy('timestamp', 'desc')
          .limit(LIMIT_POLL)
          .get();
        let pedidos: PedidoCentral[] = snap.docs.filter(filterTransferenciaNoConfirmada).map(docToPedidoCentral);
        if (soloActivos) pedidos = pedidos.filter((p) => ESTADOS_ACTIVOS.includes(p.estado));
        return NextResponse.json({ pedidos, nextCursor: null });
      } catch (err) {
        const msg = (err as Error)?.message ?? '';
        if (msg.includes('index') || msg.includes('Index')) {
          const snap = await db.collection('pedidos').where('localId', '==', localIdTrim).limit(LIMIT_POLL).get();
          let pedidos: PedidoCentral[] = snap.docs
            .filter(filterTransferenciaNoConfirmada)
            .map(docToPedidoCentral)
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          if (soloActivos) pedidos = pedidos.filter((p) => ESTADOS_ACTIVOS.includes(p.estado));
          return NextResponse.json({ pedidos, nextCursor: null });
        }
        throw err;
      }
    }

    return NextResponse.json({ pedidos: [], nextCursor: null });
  } catch (e) {
    console.error('GET /api/pedidos', e);
    return NextResponse.json({ error: 'Error al cargar pedidos' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let uid: string;
  try {
    const auth = await requireAuth(request, ['cliente', 'maestro']);
    uid = auth.uid;
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
  try {
    const body = await request.json() as {
      id: string;
      restaurante: string;
      restauranteDireccion: string;
      clienteNombre: string;
      clienteDireccion: string;
      clienteTelefono: string;
      items: string[];
      total: number;
      subtotal?: number;
      serviceCost?: number;
      localId?: string;
      codigoVerificacion?: string;
      batchId?: string | null;
      batchIndex?: number | null;
      batchLeaderLocalId?: string | null;
      deliveryType?: 'delivery' | 'pickup';
      paymentMethod?: 'efectivo' | 'transferencia';
      paymentConfirmed?: boolean;
      itemsCart?: { localId: string; items: { id: string; qty: number; note?: string }[] };
    };

    const { id, restaurante, items, total, localId: bodyLocalId } = body;
    const deliveryType = body.deliveryType === 'pickup' ? 'pickup' : 'delivery';

    if (!id || !restaurante || !Array.isArray(items) || typeof total !== 'number') {
      return NextResponse.json(
        { error: 'Faltan campos: id, restaurante, items, total' },
        { status: 400 }
      );
    }

    const localId = typeof bodyLocalId === 'string' ? bodyLocalId.trim() : null;
    if (!localId) {
      return NextResponse.json(
        { error: 'localId es obligatorio para que el pedido aparezca en el panel del restaurante' },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    const docRef = db.collection('pedidos').doc(id);
    const existing = await docRef.get();
    const totalNum = Number(total);
    const itemsKey = JSON.stringify(items);

    if (existing.exists) {
      const data = existing.data();
      const sameCliente = (data?.clienteId ?? '') === uid;
      const sameLocal = (data?.localId ?? '') === localId;
      const sameTotal = Number(data?.total ?? 0) === totalNum;
      const sameItems = JSON.stringify(data?.items ?? []) === itemsKey;
      if (sameCliente && sameLocal && sameTotal && sameItems) {
        console.log('[pedidos] Idempotente: pedido ya existe', { id, clienteId: uid, localId });
        const pedidoExistente: PedidoCentral = {
          id: existing.id,
          clienteId: data?.clienteId ?? uid,
          restaurante: data?.restaurante ?? '—',
          restauranteDireccion: data?.restauranteDireccion ?? '—',
          clienteNombre: data?.clienteNombre ?? 'Cliente',
          clienteDireccion: data?.clienteDireccion ?? '—',
          clienteTelefono: data?.clienteTelefono ?? '',
          items: (data?.items as string[]) ?? items,
          total: Number(data?.total ?? 0),
          estado: data?.estado ?? 'confirmado',
          riderId: data?.riderId ?? null,
          hora: data?.hora ?? '',
          timestamp: data?.timestamp ?? 0,
          distancia: data?.distancia ?? '—',
          localId: data?.localId ?? localId,
          codigoVerificacion: data?.codigoVerificacion ?? '',
          propina: data?.propina ?? 0,
          batchId: data?.batchId ?? null,
          batchIndex: data?.batchIndex ?? null,
          batchLeaderLocalId: data?.batchLeaderLocalId ?? null,
          deliveryType: (data?.deliveryType === 'pickup' ? 'pickup' : 'delivery') as 'delivery' | 'pickup',
        };
        return NextResponse.json({ ok: true, pedido: pedidoExistente });
      }
    }

    const ahora = new Date();
    const paymentMethod = body.paymentMethod === 'transferencia' ? 'transferencia' : 'efectivo';
    const paymentConfirmed = body.paymentConfirmed === true;
    const pedido: PedidoCentral = {
      id,
      clienteId: uid,
      restaurante: body.restaurante || '—',
      restauranteDireccion: body.restauranteDireccion || '—',
      clienteNombre: body.clienteNombre || 'Cliente',
      clienteDireccion: body.clienteDireccion || '—',
      clienteTelefono: body.clienteTelefono || '',
      items,
      total: totalNum,
      estado: 'confirmado',
      riderId: null,
      hora: ahora.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }),
      timestamp: ahora.getTime(),
      distancia: '—',
      localId,
      codigoVerificacion: body.codigoVerificacion ?? '',
      propina: 0,
      batchId: deliveryType === 'delivery' ? body.batchId ?? null : null,
      batchIndex: deliveryType === 'delivery' && typeof body.batchIndex === 'number' ? body.batchIndex : null,
      batchLeaderLocalId: deliveryType === 'delivery' ? body.batchLeaderLocalId ?? null : null,
      deliveryType,
    };

    const docData: Record<string, unknown> = {
      ...pedido,
      paymentMethod,
      paymentConfirmed,
      createdAt: FieldValue.serverTimestamp(),
    };
    if (typeof body.subtotal === 'number' && !Number.isNaN(body.subtotal)) {
      docData.subtotal = body.subtotal;
    }
    if (typeof body.serviceCost === 'number' && !Number.isNaN(body.serviceCost)) {
      docData.serviceCost = body.serviceCost;
    }
    if (body.itemsCart && typeof body.itemsCart === 'object' && body.itemsCart.localId && Array.isArray(body.itemsCart.items)) {
      docData.itemsCart = {
        localId: String(body.itemsCart.localId),
        items: body.itemsCart.items.map((i) => ({
          id: String(i.id),
          qty: Number(i.qty) || 1,
          ...(typeof i.note === 'string' ? { note: i.note } : {}),
        })),
      };
    }
    await docRef.set(docData);

    try {
      await sendFCMToRole(
        'restaurant',
        'Nuevo pedido',
        `${body.restaurante || 'Restaurante'} · ${body.clienteNombre || 'Cliente'}`,
        { localId, pedidoId: id, restaurante: body.restaurante || '' }
      );
    } catch {
      // no bloquear la respuesta por fallo de notificación
    }

    return NextResponse.json({ ok: true, pedido });
  } catch (e) {
    console.error('POST /api/pedidos', e);
    return NextResponse.json({ error: 'Error al crear pedido' }, { status: 500 });
  }
}
