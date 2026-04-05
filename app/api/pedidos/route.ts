import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue, type DocumentData, type DocumentSnapshot } from 'firebase-admin/firestore';
import { requireAuth } from '@/lib/api-auth';
import type { PedidoCentral } from '@/lib/types';
import { sendFCMToRestaurantByLocalId } from '@/lib/fcm-send-server';
import { sanitizeForFirestore } from '@/lib/firestoreUtils';
import { normalizeDataUrl } from '@/lib/validImageUrl';
import { pedidoPostSchema } from '@/lib/schemas/pedido';
import { buildOrderMoney, getOrderMoney, resolveIvaConfig } from '@/lib/order-money';
import { getMenuFromFirestore } from '@/lib/locales-firestore';
import { computeSubtotalFromItemsCart } from '@/lib/pedido-precios-server';
import { formatTimeEcuador } from '@/lib/dateEcuador';

const TOTAL_PEDIDO_TOLERANCE = 0.01;

const ESTADOS_ACTIVOS: string[] = ['confirmado', 'preparando', 'listo', 'esperando_rider', 'asignado', 'en_camino'];
/** Pedidos activos en cocina: por defecto 20 con cursor; máximo 50 por página. */
const DEFAULT_ACTIVE_LIMIT = 20;
const MAX_ACTIVE_LIMIT = 50;
/** Historial entregados: página pequeña + cursor (ahorro de lecturas). */
const LIMIT_ENTREGADOS = 15;
/** Máx. docs en fallback sin índice compuesto (acotar vs 100). */
const LIMIT_ENTREGADOS_FALLBACK = 50;

function docToPedidoCentral(d: DocumentSnapshot): PedidoCentral {
  const data = d.data() || {};
  const money = getOrderMoney(data);
  return {
    id: d.id,
    restaurante: data.restaurante || '—',
    restauranteDireccion: data.restauranteDireccion || '—',
    restauranteLat: typeof data.restauranteLat === 'number' && !Number.isNaN(data.restauranteLat) ? data.restauranteLat : null,
    restauranteLng: typeof data.restauranteLng === 'number' && !Number.isNaN(data.restauranteLng) ? data.restauranteLng : null,
    clienteNombre: data.clienteNombre || 'Cliente',
    clienteDireccion: data.clienteDireccion || '—',
    clienteTelefono: data.clienteTelefono || '',
    items: data.items || [],
    total: money.total,
    totalCliente: money.totalCliente,
    subtotal: money.subtotal,
    subtotalBase: money.subtotalBase,
    ivaEnabled: money.ivaEnabled,
    ivaRate: money.ivaRate,
    ivaAmount: money.ivaAmount,
    subtotalConIva: money.subtotalConIva,
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
    paymentMethod: data.paymentMethod === 'transferencia' ? 'transferencia' : 'efectivo',
    serviceCost: money.serviceCost || undefined,
    costoEnvio: money.costoEnvio || undefined,
    serviceFee: money.serviceFee || undefined,
  };
}

function filterTransferenciaNoConfirmada(d: DocumentSnapshot): boolean {
  const data = d.data();
  if (data?.paymentMethod === 'transferencia' && data?.paymentConfirmed === false) return false;
  return true;
}

/** GET /api/pedidos?localId=xxx&soloActivos=true | estado=entregado&limit=15&cursor=xxx → pedidos del local. */
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
    const activeLimit = Math.min(
      Math.max(parseInt(searchParams.get('limit') || String(DEFAULT_ACTIVE_LIMIT), 10) || DEFAULT_ACTIVE_LIMIT, 1),
      MAX_ACTIVE_LIMIT
    );
    const cursor = searchParams.get('cursor') || null;
    const desdeTsParam = Number(searchParams.get('desdeTs') || 0);
    const desdeTs = Number.isFinite(desdeTsParam) && desdeTsParam > 0 ? desdeTsParam : null;

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
            .where('timestamp', '>=', desdeTs ?? 0)
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
            const snap = await db
              .collection('pedidos')
              .where('localId', '==', userLocalId)
              .orderBy('timestamp', 'desc')
              .limit(LIMIT_ENTREGADOS_FALLBACK)
              .get();
            const filtered = snap.docs
              .filter(filterTransferenciaNoConfirmada)
              .filter((d) => (d.data().estado || '') === 'entregado')
              .filter((d) => Number(d.data().timestamp ?? 0) >= (desdeTs ?? 0));
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
        if (soloActivos) {
          let query = db
            .collection('pedidos')
            .where('localId', '==', userLocalId)
            .where('estado', 'in', ESTADOS_ACTIVOS)
            .orderBy('timestamp', 'desc')
            .limit(activeLimit);
          if (cursor) {
            const cursorSnap = await db.collection('pedidos').doc(cursor).get();
            if (cursorSnap.exists) query = query.startAfter(cursorSnap);
          }
          const snap = await query.get();
          const pedidos: PedidoCentral[] = snap.docs.filter(filterTransferenciaNoConfirmada).map(docToPedidoCentral);
          const nextCursor = snap.docs.length === activeLimit ? snap.docs[snap.docs.length - 1].id : null;
          return NextResponse.json({ pedidos, nextCursor });
        }
        const snap = await db
          .collection('pedidos')
          .where('localId', '==', userLocalId)
          .orderBy('timestamp', 'desc')
          .limit(MAX_ACTIVE_LIMIT)
          .get();
        const pedidos: PedidoCentral[] = snap.docs.filter(filterTransferenciaNoConfirmada).map(docToPedidoCentral);
        return NextResponse.json({ pedidos, nextCursor: null });
      } catch (err) {
        const msg = (err as Error)?.message ?? '';
        if (msg.includes('index') || msg.includes('Index')) {
          const fallbackLimit = soloActivos ? Math.max(activeLimit * 3, 45) : MAX_ACTIVE_LIMIT;
          const snap = await db.collection('pedidos').where('localId', '==', userLocalId).limit(fallbackLimit).get();
          let filtered = snap.docs
            .filter(filterTransferenciaNoConfirmada)
            .map(docToPedidoCentral)
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          if (soloActivos) filtered = filtered.filter((p) => ESTADOS_ACTIVOS.includes(p.estado));
          const start = cursor ? Math.max(0, filtered.findIndex((p) => p.id === cursor) + 1) : 0;
          const page = soloActivos ? filtered.slice(start, start + activeLimit) : filtered;
          const nextCursor = soloActivos && start + activeLimit < filtered.length ? page[page.length - 1]?.id ?? null : null;
          return NextResponse.json({ pedidos: page, nextCursor });
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
            .where('timestamp', '>=', desdeTs ?? 0)
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
            const snap = await db
              .collection('pedidos')
              .where('localId', '==', localIdTrim)
              .orderBy('timestamp', 'desc')
              .limit(LIMIT_ENTREGADOS_FALLBACK)
              .get();
            const filtered = snap.docs
              .filter(filterTransferenciaNoConfirmada)
              .filter((d) => (d.data().estado || '') === 'entregado')
              .filter((d) => Number(d.data().timestamp ?? 0) >= (desdeTs ?? 0));
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
        if (soloActivos) {
          let query = db
            .collection('pedidos')
            .where('localId', '==', localIdTrim)
            .where('estado', 'in', ESTADOS_ACTIVOS)
            .orderBy('timestamp', 'desc')
            .limit(activeLimit);
          if (cursor) {
            const cursorSnap = await db.collection('pedidos').doc(cursor).get();
            if (cursorSnap.exists) query = query.startAfter(cursorSnap);
          }
          const snap = await query.get();
          const pedidos: PedidoCentral[] = snap.docs.filter(filterTransferenciaNoConfirmada).map(docToPedidoCentral);
          const nextCursor = snap.docs.length === activeLimit ? snap.docs[snap.docs.length - 1].id : null;
          return NextResponse.json({ pedidos, nextCursor });
        }
        const snap = await db
          .collection('pedidos')
          .where('localId', '==', localIdTrim)
          .orderBy('timestamp', 'desc')
          .limit(MAX_ACTIVE_LIMIT)
          .get();
        const pedidos: PedidoCentral[] = snap.docs.filter(filterTransferenciaNoConfirmada).map(docToPedidoCentral);
        return NextResponse.json({ pedidos, nextCursor: null });
      } catch (err) {
        const msg = (err as Error)?.message ?? '';
        if (msg.includes('index') || msg.includes('Index')) {
          const fallbackLimit = soloActivos ? Math.max(activeLimit * 3, 45) : MAX_ACTIVE_LIMIT;
          const snap = await db.collection('pedidos').where('localId', '==', localIdTrim).limit(fallbackLimit).get();
          let filtered = snap.docs
            .filter(filterTransferenciaNoConfirmada)
            .map(docToPedidoCentral)
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          if (soloActivos) filtered = filtered.filter((p) => ESTADOS_ACTIVOS.includes(p.estado));
          const start = cursor ? Math.max(0, filtered.findIndex((p) => p.id === cursor) + 1) : 0;
          const page = soloActivos ? filtered.slice(start, start + activeLimit) : filtered;
          const nextCursor = soloActivos && start + activeLimit < filtered.length ? page[page.length - 1]?.id ?? null : null;
          return NextResponse.json({ pedidos: page, nextCursor });
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
  // Rechazar payloads que superen 900KB antes de leer el body o tocar Firestore.
  // Evita el Error 500 causado por comprobanteBase64 demasiado grande (límite Firestore: 1MiB).
  const contentLength = parseInt(request.headers.get('content-length') ?? '0', 10);
  if (contentLength > 900_000) {
    return NextResponse.json(
      { error: 'El comprobante es demasiado grande. Máximo 700 KB. Comprime la imagen o usa una captura de pantalla.' },
      { status: 413 }
    );
  }

  let uid: string;
  try {
    const auth = await requireAuth(request, ['cliente', 'rider', 'maestro']);
    uid = auth.uid;
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
  try {
    const body = await request.json();
    const parseResult = pedidoPostSchema.safeParse(body);
    if (!parseResult.success) {
      const issues = parseResult.error.flatten().fieldErrors;
      const firstMsg = Object.values(issues).flat()[0] ?? 'Datos inválidos';
      return NextResponse.json({ error: firstMsg }, { status: 400 });
    }
    const bodyParsed = parseResult.data;
    const deliveryType = bodyParsed.deliveryType === 'pickup' ? 'pickup' : 'delivery';

    const { id, items, total, localId: bodyLocalId } = bodyParsed;
    const localId = typeof bodyLocalId === 'string' ? bodyLocalId.trim() : null;

    if (!localId) {
      return NextResponse.json(
        { error: 'localId es obligatorio para que el pedido aparezca en el panel del restaurante' },
        { status: 400 }
      );
    }

    const cart = bodyParsed.itemsCart;
    if (!cart?.items?.length) {
      return NextResponse.json(
        { error: 'Debes enviar itemsCart con los productos para validar el total contra el menú.' },
        { status: 400 }
      );
    }
    if (String(cart.localId).trim() !== localId) {
      return NextResponse.json(
        { error: 'itemsCart.localId debe coincidir con localId del pedido.' },
        { status: 400 }
      );
    }

    const menu = await getMenuFromFirestore(localId);
    const menuById = new Map(menu.map((m) => [m.id, m]));
    const subtotalResult = computeSubtotalFromItemsCart(cart.items, menuById);
    if (!subtotalResult.ok) {
      return NextResponse.json({ error: subtotalResult.error }, { status: 400 });
    }

    const db = getAdminFirestore();
    let localData: DocumentData | undefined;
    const localSnap = await db.collection('locales').doc(localId).get();
    localData = localSnap.data();
    const ivaConfig = resolveIvaConfig(localData);
    const costoEnvio =
      typeof bodyParsed.costoEnvio === 'number' && !Number.isNaN(bodyParsed.costoEnvio)
        ? bodyParsed.costoEnvio
        : 0;
    const serviceFee =
      typeof bodyParsed.serviceFee === 'number' && !Number.isNaN(bodyParsed.serviceFee)
        ? bodyParsed.serviceFee
        : 0;
    const orderMoney = buildOrderMoney({
      subtotalBase: subtotalResult.subtotalBase,
      costoEnvio,
      serviceFee,
      propina: 0,
      ivaEnabled: ivaConfig.ivaEnabled,
      ivaRate: ivaConfig.ivaRate,
    });

    const totalNum = Number(total);
    if (!Number.isFinite(totalNum) || Math.abs(orderMoney.totalCliente - totalNum) > TOTAL_PEDIDO_TOLERANCE) {
      return NextResponse.json(
        { error: 'El total no coincide con los precios del menú. Actualiza la app o revisa el carrito.' },
        { status: 400 }
      );
    }

    const docRef = db.collection('pedidos').doc(id);
    const existing = await docRef.get();
    const itemsKey = JSON.stringify(items);

    if (existing.exists) {
      const data = existing.data();
      const sameCliente = (data?.clienteId ?? '') === uid;
      const sameLocal = (data?.localId ?? '') === localId;
      const sameTotal = Number(data?.total ?? 0) === totalNum;
      const sameItems = JSON.stringify(data?.items ?? []) === itemsKey;
      if (sameCliente && sameLocal && sameTotal && sameItems) {
        return NextResponse.json({ ok: true, pedido: docToPedidoCentral(existing) });
      }
    }

    const ahora = new Date();
    const paymentMethod = bodyParsed.paymentMethod === 'transferencia' ? 'transferencia' : 'efectivo';
    const paymentConfirmed = bodyParsed.paymentConfirmed === true;
    const pedido: PedidoCentral = {
      id,
      clienteId: uid,
      restaurante: bodyParsed.restaurante || '—',
      restauranteDireccion: bodyParsed.restauranteDireccion || '—',
      clienteNombre: bodyParsed.clienteNombre || 'Cliente',
      clienteDireccion: bodyParsed.clienteDireccion || '—',
      clienteTelefono: bodyParsed.clienteTelefono || '',
      items,
      total: orderMoney.total,
      totalCliente: orderMoney.totalCliente,
      subtotal: orderMoney.subtotal,
      subtotalBase: orderMoney.subtotalBase,
      ivaEnabled: orderMoney.ivaEnabled,
      ivaRate: orderMoney.ivaRate,
      ivaAmount: orderMoney.ivaAmount,
      subtotalConIva: orderMoney.subtotalConIva,
      estado: 'confirmado',
      riderId: null,
      hora: formatTimeEcuador(ahora),
      timestamp: ahora.getTime(),
      distancia: '—',
      localId,
      codigoVerificacion: bodyParsed.codigoVerificacion ?? '',
      batchId: deliveryType === 'delivery' ? bodyParsed.batchId ?? null : null,
      batchIndex: deliveryType === 'delivery' && typeof bodyParsed.batchIndex === 'number' ? bodyParsed.batchIndex : null,
      batchLeaderLocalId: deliveryType === 'delivery' ? bodyParsed.batchLeaderLocalId ?? null : null,
      deliveryType,
      propina: orderMoney.propina,
      serviceCost: orderMoney.serviceCost,
      costoEnvio: orderMoney.costoEnvio,
      serviceFee: orderMoney.serviceFee,
    };

    const docData: Record<string, unknown> = {
      ...pedido,
      paymentMethod,
      paymentConfirmed,
      createdAt: FieldValue.serverTimestamp(),
    };
    if (typeof bodyParsed.clienteLat === 'number' && typeof bodyParsed.clienteLng === 'number' &&
        !Number.isNaN(bodyParsed.clienteLat) && !Number.isNaN(bodyParsed.clienteLng)) {
      docData.clienteLat = bodyParsed.clienteLat;
      docData.clienteLng = bodyParsed.clienteLng;
    }
    // Una sola lectura de locales: coords (fallback) + snapshot denormalizado para historial
    if (localData) {
      docData.nombreLocal =
        typeof localData.name === 'string' && localData.name.trim()
          ? localData.name.trim()
          : bodyParsed.restaurante || '—';
      if (typeof localData.logo === 'string' && localData.logo.trim()) docData.logoLocal = localData.logo.trim();
      if (typeof localData.cover === 'string' && localData.cover.trim()) docData.fotoLocal = localData.cover.trim();
      if (typeof localData.telefono === 'string' && localData.telefono.trim()) {
        docData.telefonoLocal = localData.telefono.trim();
      }
    }
    let restauranteLat: number | null = null;
    let restauranteLng: number | null = null;
    if (typeof bodyParsed.restauranteLat === 'number' && typeof bodyParsed.restauranteLng === 'number' &&
        !Number.isNaN(bodyParsed.restauranteLat) && !Number.isNaN(bodyParsed.restauranteLng)) {
      restauranteLat = bodyParsed.restauranteLat;
      restauranteLng = bodyParsed.restauranteLng;
    } else if (localData) {
      const lat = typeof localData.lat === 'number' && !Number.isNaN(localData.lat) ? localData.lat : null;
      const lng = typeof localData.lng === 'number' && !Number.isNaN(localData.lng) ? localData.lng : null;
      if (lat != null && lng != null) {
        restauranteLat = lat;
        restauranteLng = lng;
      }
    }
    if (restauranteLat != null && restauranteLng != null) {
      docData.restauranteLat = restauranteLat;
      docData.restauranteLng = restauranteLng;
    }
    if (bodyParsed.itemsCart && typeof bodyParsed.itemsCart === 'object' && bodyParsed.itemsCart.localId && Array.isArray(bodyParsed.itemsCart.items)) {
      docData.itemsCart = {
        localId: String(bodyParsed.itemsCart.localId),
        items: bodyParsed.itemsCart.items.map((i) => ({
          id: String(i.id),
          qty: Number(i.qty) || 1,
          ...(typeof i.note === 'string' ? { note: i.note } : {}),
          ...(typeof i.variationName === 'string' ? { variationName: i.variationName } : {}),
          ...(typeof i.variationPrice === 'number' && !Number.isNaN(i.variationPrice) ? { variationPrice: i.variationPrice } : {}),
          ...(i.complementSelections && typeof i.complementSelections === 'object' ? { complementSelections: i.complementSelections } : {}),
          ...(typeof i.displayLabel === 'string' ? { displayLabel: i.displayLabel } : {}),
        })),
      };
    }
    // Fase 1: preferir URL de Storage; fallback a Base64 legacy para clientes desactualizados.
    if (typeof bodyParsed.comprobanteUrl === 'string' && bodyParsed.comprobanteUrl.trim()) {
      docData.comprobanteUrl = bodyParsed.comprobanteUrl;
      if (typeof bodyParsed.fileName === 'string') docData.comprobanteFileName = bodyParsed.fileName;
      if (typeof bodyParsed.mimeType === 'string') docData.comprobanteMimeType = bodyParsed.mimeType;
    } else if (typeof bodyParsed.comprobanteBase64 === 'string' && bodyParsed.comprobanteBase64.trim()) {
      // Legacy: clientes que todavía envían Base64 (versión antigua del frontend)
      const normalized = bodyParsed.comprobanteBase64.startsWith('data:')
        ? normalizeDataUrl(bodyParsed.comprobanteBase64)
        : bodyParsed.comprobanteBase64;
      docData.comprobanteBase64 = normalized;
      if (typeof bodyParsed.fileName === 'string') docData.comprobanteFileName = bodyParsed.fileName;
      if (typeof bodyParsed.mimeType === 'string') docData.comprobanteMimeType = bodyParsed.mimeType;
    }
    await docRef.set(sanitizeForFirestore(docData));

    const pedidoResp: PedidoCentral = {
      ...pedido,
      ...(typeof docData.nombreLocal === 'string' ? { nombreLocal: docData.nombreLocal } : {}),
      ...(typeof docData.logoLocal === 'string' ? { logoLocal: docData.logoLocal } : {}),
      ...(typeof docData.fotoLocal === 'string' ? { fotoLocal: docData.fotoLocal } : {}),
      ...(typeof docData.telefonoLocal === 'string' ? { telefonoLocal: docData.telefonoLocal } : {}),
    };

    try {
      if (localId && String(localId).trim()) {
        const lid = String(localId).trim();
        // FCM data: openPath obligatorio para el SW (no enviar pedidoId aquí: evita fallback a /pedido/:id en cliente).
        const restauranteNotificationData: Record<string, string> = {
          openPath: `/panel/restaurante/${encodeURIComponent(lid)}?pedido=${encodeURIComponent(id)}`,
          localId: lid,
          restaurante: bodyParsed.restaurante || '',
        };
        await sendFCMToRestaurantByLocalId(
          localId,
          'Nuevo pedido',
          `${bodyParsed.restaurante || 'Restaurante'} · ${bodyParsed.clienteNombre || 'Cliente'}`,
          restauranteNotificationData
        );
      }
    } catch {
      // no bloquear la respuesta por fallo de notificación
    }

    return NextResponse.json({ ok: true, pedido: pedidoResp });
  } catch (e) {
    console.error('POST /api/pedidos', e);
    return NextResponse.json({ error: 'Error al crear pedido' }, { status: 500 });
  }
}
