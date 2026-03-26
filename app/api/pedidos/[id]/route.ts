import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAuth } from '@/lib/api-auth';
import type { PedidoCentral } from '@/lib/types';
import { sendFCMToUser, sendFCMToRole } from '@/lib/fcm-send-server';
import { sanitizeForFirestore } from '@/lib/firestoreUtils';
import { pedidoPatchSchema } from '@/lib/schemas/pedidoPatch';
import { applyDeliveredOrderAggregates } from '@/lib/local-stats-aggregates';
import { calcularComision, calcularNetoLocal } from '@/lib/commissions';
import { getOrderMoney } from '@/lib/order-money';

type PedidoConRider = PedidoCentral & { riderNombre?: string; riderRating?: number | null };

/** GET /api/pedidos/[id] → pedido por id. Requiere auth: solo dueño del pedido, dueño del local, rider asignado o central/maestro. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let auth: { uid: string; rol: string };
  try {
    auth = await requireAuth(request, ['cliente', 'central', 'maestro', 'rider', 'local']);
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
  try {
    const { id } = await params;
    const db = getAdminFirestore();
    const snap = await db.collection('pedidos').doc(id).get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }
    const data = snap.data()!;
    const clienteId = data.clienteId ?? null;
    const pedidoLocalId = data.localId ?? null;

    const isCliente = auth.uid === clienteId;
    const isCentralOrMaestro = auth.rol === 'central' || auth.rol === 'maestro';
    const isRiderAsignado = auth.rol === 'rider' && data.riderId === auth.uid;
    const isRiderVerPreview = auth.rol === 'rider' && (data.estado === 'esperando_rider') && (data.riderId ?? null) === null;
    let isLocalDelPedido = false;
    if (auth.rol === 'local') {
      const userSnap = await db.collection('users').doc(auth.uid).get();
      const userLocalId = userSnap.data()?.localId ?? null;
      isLocalDelPedido = !!userLocalId && userLocalId === pedidoLocalId;
    }
    if (!isCliente && !isCentralOrMaestro && !isRiderAsignado && !isRiderVerPreview && !isLocalDelPedido) {
      return NextResponse.json({ error: 'No autorizado para ver este pedido' }, { status: 403 });
    }

    type PedidoPublico = PedidoCentral & {
      paymentMethod?: 'efectivo' | 'transferencia';
      serviceCost?: number;
      costoEnvio?: number;
      serviceFee?: number;
      paymentConfirmed?: boolean;
      comprobanteBase64?: string | null;
      comprobanteFileName?: string | null;
      comprobanteMimeType?: string | null;
    };
    const money = getOrderMoney(data);
    const pedidoBase: PedidoPublico = {
      id: snap.id,
      clienteId: data.clienteId ?? null,
      restaurante: data.restaurante || '—',
      restauranteDireccion: data.restauranteDireccion || '—',
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
      nombreLocal: typeof data.nombreLocal === 'string' ? data.nombreLocal : undefined,
      logoLocal: typeof data.logoLocal === 'string' ? data.logoLocal : undefined,
      fotoLocal: typeof data.fotoLocal === 'string' ? data.fotoLocal : undefined,
      telefonoLocal: typeof data.telefonoLocal === 'string' ? data.telefonoLocal : undefined,
      codigoVerificacion: data.codigoVerificacion || '',
      propina: data.propina ?? 0,
      deliveryType: (data.deliveryType === 'pickup' ? 'pickup' : 'delivery') as 'delivery' | 'pickup',
      paymentMethod: data.paymentMethod === 'transferencia' ? 'transferencia' : 'efectivo',
      serviceCost: money.serviceCost || undefined,
      costoEnvio: money.costoEnvio || undefined,
      serviceFee: money.serviceFee || undefined,
      paymentConfirmed: data.paymentConfirmed !== false,
      comprobanteBase64: data.comprobanteBase64 ?? null,
      comprobanteFileName: data.comprobanteFileName ?? null,
      comprobanteMimeType: data.comprobanteMimeType ?? null,
      ...(data.itemsCart && typeof data.itemsCart === 'object' && data.itemsCart.localId && Array.isArray(data.itemsCart.items)
        ? { itemsCart: data.itemsCart as PedidoCentral['itemsCart'] }
        : {}),
    };
    let pedido: PedidoConRider & PedidoPublico = pedidoBase;
    if (data.riderId) {
      const riderSnap = await db.collection('users').doc(data.riderId as string).get();
      if (riderSnap.exists) {
        const riderData = riderSnap.data()!;
        pedido = {
          ...pedidoBase,
          riderNombre: riderData.displayName || riderData.email || 'Rider',
          riderRating: riderData.ratingPromedio != null ? Number(riderData.ratingPromedio) : null,
        };
      }
    }
    return NextResponse.json(pedido);
  } catch (e) {
    console.error('GET /api/pedidos/[id]', e);
    return NextResponse.json({ error: 'Error al cargar pedido' }, { status: 500 });
  }
}

/** PATCH /api/pedidos/[id] → actualiza estado, riderId. Rol local solo puede actualizar sus pedidos (preparando, listo, esperando_rider). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let auth: { uid: string; rol: string };
  try {
    auth = await requireAuth(request, ['central', 'maestro', 'rider', 'local', 'cliente']);
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
  try {
    const { id } = await params;
    const bodyRaw = await request.json();
    const parseResult = pedidoPatchSchema.safeParse(bodyRaw);
    if (!parseResult.success) {
      const issues = parseResult.error.flatten().fieldErrors;
      const firstMsg = Object.values(issues).flat()[0] ?? 'Datos inválidos';
      return NextResponse.json({ error: firstMsg }, { status: 400 });
    }
    const body = parseResult.data;

    const db = getAdminFirestore();
    const ref = db.collection('pedidos').doc(id);
    const snap = await ref.get();

    if (!snap.exists) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }

    const data = snap.data()!;
    const pedidoLocalId = data.localId ?? null;

    if (auth.rol === 'cliente') {
      const accion = typeof body.accion === 'string' ? body.accion.trim() : '';
      if (accion !== 'cancelar') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
      }
      const clienteId = data.clienteId ?? null;
      if (clienteId !== auth.uid) {
        return NextResponse.json({ error: 'No es tu pedido' }, { status: 403 });
      }
      const estadoActual = (data.estado as string) || 'confirmado';
      if (estadoActual !== 'confirmado') {
        return NextResponse.json({ error: 'Solo puedes cancelar mientras el local no haya aceptado el pedido' }, { status: 400 });
      }
      await ref.update({
        estado: 'cancelado_cliente',
        updatedAt: FieldValue.serverTimestamp(),
        canceladoPor: 'cliente',
        canceladoPorUid: auth.uid,
      });
      return NextResponse.json({ ok: true, cancelado: true });
    }

    if (auth.rol === 'local') {
      const userSnap = await db.collection('users').doc(auth.uid).get();
      const userLocalId = userSnap.data()?.localId ?? null;
      if (!userLocalId || pedidoLocalId !== userLocalId) {
        return NextResponse.json({ error: 'No autorizado para este pedido' }, { status: 403 });
      }
      const accion = typeof body.accion === 'string' ? body.accion.trim() : '';
      if (accion === 'cancelar') {
        const estadoActual = (data.estado as string) || 'confirmado';
        const cancelables = ['confirmado', 'preparando', 'listo', 'esperando_rider'];
        if (!cancelables.includes(estadoActual)) {
          return NextResponse.json({ error: 'No se puede cancelar en este estado' }, { status: 400 });
        }
        const updatesCancel: Record<string, unknown> = {
          estado: 'cancelado_local',
          updatedAt: FieldValue.serverTimestamp(),
          canceladoPor: 'local',
          canceladoPorUid: auth.uid,
        };
        if (typeof body.motivo === 'string' && body.motivo.trim()) {
          updatesCancel.motivoCancelacion = body.motivo.trim().slice(0, 200);
        }
        await ref.update(sanitizeForFirestore(updatesCancel));
        const clienteId = data.clienteId ?? null;
        if (clienteId && typeof clienteId === 'string') {
          try {
            await sendFCMToUser(clienteId, 'Pedido cancelado', 'Tu pedido fue cancelado.', { pedidoId: id });
          } catch {
            // ignorar
          }
        }
        return NextResponse.json({ ok: true, cancelado: true });
      }
      const estadosPermitidosLocal = ['preparando', 'listo', 'esperando_rider'];
      const isPickup = data.deliveryType === 'pickup';
      if (isPickup && body.estado === 'entregado') {
        estadosPermitidosLocal.push('entregado');
      }
      if (body.estado !== undefined && !estadosPermitidosLocal.includes(body.estado)) {
        return NextResponse.json({ error: 'Estado no permitido para el local' }, { status: 400 });
      }
      if (body.riderId !== undefined || body.propina !== undefined) {
        return NextResponse.json({ error: 'Solo central/rider pueden asignar rider o propina' }, { status: 403 });
      }
    }

    /* Rider: puede rechazar carrera o avanzar su pedido asignado (en_camino/entregado). */
    if (auth.rol === 'rider') {
      const accion = typeof body.accion === 'string' ? body.accion.trim() : '';
      if (accion === 'rechazar_carrera') {
        if (data.riderId !== auth.uid) {
          return NextResponse.json({ error: 'No estás asignado a esta carrera' }, { status: 403 });
        }
        await ref.update(
          sanitizeForFirestore({
            riderId: null,
            estado: 'esperando_rider',
            updatedAt: FieldValue.serverTimestamp(),
          })
        );
        return NextResponse.json({ ok: true });
      }
      if (body.estado === undefined) {
        return NextResponse.json({ error: 'Acción no permitida para el rol rider' }, { status: 403 });
      }
      if (data.riderId !== auth.uid) {
        return NextResponse.json({ error: 'No estás asignado a esta carrera' }, { status: 403 });
      }
      if (body.riderId !== undefined || body.propina !== undefined) {
        return NextResponse.json({ error: 'No autorizado para modificar estos campos' }, { status: 403 });
      }
      const estadoActual = (data.estado as string) || 'asignado';
      if (body.estado === 'en_camino') {
        const permitidos = ['asignado', 'listo'];
        if (!permitidos.includes(estadoActual)) {
          return NextResponse.json(
            { error: 'Solo puedes marcar en camino pedidos asignados/listos' },
            { status: 400 }
          );
        }
      } else if (body.estado === 'entregado') {
        const permitidos = ['en_camino', 'asignado'];
        if (!permitidos.includes(estadoActual)) {
          return NextResponse.json(
            { error: 'Solo puedes entregar pedidos en camino o asignados' },
            { status: 400 }
          );
        }
      } else {
        return NextResponse.json({ error: 'Estado no permitido para el rol rider' }, { status: 403 });
      }
    }

    const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (body.estado !== undefined) updates.estado = body.estado;
    if (body.riderId !== undefined) updates.riderId = body.riderId;
    if (body.propina !== undefined) updates.propina = body.propina;
    if (body.paymentConfirmed !== undefined) updates.paymentConfirmed = body.paymentConfirmed;
    if (body.comprobanteBase64 !== undefined) updates.comprobanteBase64 = body.comprobanteBase64;
    if (body.comprobanteFileName !== undefined) updates.comprobanteFileName = body.comprobanteFileName;
    if (body.comprobanteMimeType !== undefined) updates.comprobanteMimeType = body.comprobanteMimeType;

    const prevEstado = (data.estado as string) || 'confirmado';

    await ref.update(sanitizeForFirestore(updates));

    if (body.estado === 'entregado' && prevEstado !== 'entregado' && pedidoLocalId && typeof pedidoLocalId === 'string') {
      try {
        await applyDeliveredOrderAggregates(db, {
          localId: pedidoLocalId,
          pedidoId: id,
          subtotalBase: getOrderMoney(data).subtotalBase,
          timestamp: Number(data.timestamp ?? Date.now()),
          items: Array.isArray(data.items) ? (data.items as string[]) : [],
        });
      } catch {
        // no bloquear actualización del pedido
      }
    }

    // Al marcar como entregado: comisión idempotente del 8% sobre subtotalBase.
    if (body.estado === 'entregado' && prevEstado !== 'entregado') {
      if (pedidoLocalId) {
        const riderId = body.riderId ?? data.riderId ?? null;
        const money = getOrderMoney(data);
        const subtotalBase = money.subtotalBase;
        let programStartDate = '';
        try {
          const configSnap = await db.collection('config').doc('transferenciaAndina').get();
          const configData = configSnap.data();
          if (typeof configData?.programStartDate === 'string') {
            programStartDate = configData.programStartDate;
          }
        } catch {
          // si no hay config, se cobra comisión
        }
        const pedidoTimestamp = Number(data.timestamp ?? Date.now());
        const programStartTime = programStartDate ? new Date(programStartDate).getTime() : 0;
        const localSnap = await db.collection('locales').doc(pedidoLocalId).get();
        const localData = localSnap.data() ?? {};
        const commissionStartDate = (typeof localData.commissionStartDate === 'string' ? localData.commissionStartDate : null) ?? programStartDate;
        const commissionStartTime = commissionStartDate ? new Date(commissionStartDate).getTime() : 0;
        if ((programStartTime <= 0 || pedidoTimestamp >= programStartTime) && (commissionStartTime <= 0 || pedidoTimestamp >= commissionStartTime)) {
          const montoComision = calcularComision(money.totalCliente, subtotalBase);
          const netoLocal = calcularNetoLocal(subtotalBase, montoComision);
          await db.collection('comisiones').doc(id).set({
            localId: pedidoLocalId,
            pedidoId: id,
            riderId,
            totalPedido: money.totalCliente,
            totalCliente: money.totalCliente,
            subtotalBase,
            ivaAmount: money.ivaAmount,
            subtotalConIva: money.subtotalConIva,
            costoEnvio: money.costoEnvio,
            serviceFee: money.serviceFee,
            montoComision,
            commissionRate: 0.08,
            netoLocal,
            fecha: FieldValue.serverTimestamp(),
            pagado: false,
          }, { merge: false });
        }
      }
    }

    // Notificar a central cuando pedido pasa a esperando_rider
    if (body.estado === 'esperando_rider') {
      try {
        const restaurante = (data.restaurante as string) || 'Restaurante';
        const clienteNombre = (data.clienteNombre as string) || 'Cliente';
        await sendFCMToRole(
          'central',
          'Nuevo pedido esperando rider',
          `${restaurante} · ${clienteNombre}`,
          { pedidoId: id, localId: String(pedidoLocalId ?? '') }
        );
      } catch {
        // ignorar
      }
    }

    const clienteId = data.clienteId ?? null;
    if (body.estado !== undefined && clienteId && typeof clienteId === 'string') {
      const messages: Record<string, { title: string; body: string }> = {
        confirmado: { title: '¡Pedido confirmado!', body: 'El restaurante aceptó tu pedido.' },
        preparando: { title: 'Tu pedido se está preparando', body: 'El restaurante está cocinando.' },
        listo: { title: 'Tu pedido está listo', body: 'Pronto saldrá hacia ti.' },
        esperando_rider: { title: 'Tu pedido está listo', body: 'Estamos buscando un repartidor.' },
        asignado: { title: 'Repartidor asignado', body: 'Tu pedido tiene repartidor asignado.' },
        en_camino: { title: 'Tu pedido va en camino', body: 'El repartidor está llevando tu pedido.' },
        entregado: { title: '¡Pedido entregado!', body: 'Que lo disfrutes.' },
      };
      const msg = messages[body.estado];
      if (msg) {
        try {
          await sendFCMToUser(clienteId, msg.title, msg.body, { pedidoId: id });
        } catch {
          // ignorar
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('PATCH /api/pedidos/[id]', e);
    return NextResponse.json({ error: 'Error al actualizar pedido' }, { status: 500 });
  }
}

/** DELETE /api/pedidos/[id] → elimina el pedido (central, maestro o local para sus propios pedidos). */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let auth: { uid: string; rol: string };
  try {
    auth = await requireAuth(request, ['central', 'maestro', 'rider', 'local']);
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
  try {
    const { id } = await params;
    const db = getAdminFirestore();
    const ref = db.collection('pedidos').doc(id);
    const snap = await ref.get();

    if (!snap.exists) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }

    const data = snap.data()!;
    const pedidoLocalId = data.localId ?? null;

    if (auth.rol === 'local') {
      const userSnap = await db.collection('users').doc(auth.uid).get();
      const userLocalId = userSnap.data()?.localId ?? null;
      if (!userLocalId || pedidoLocalId !== userLocalId) {
        return NextResponse.json({ error: 'No autorizado para eliminar este pedido' }, { status: 403 });
      }
    }
    if (auth.rol === 'rider') {
      return NextResponse.json({ error: 'Los riders no pueden eliminar pedidos' }, { status: 403 });
    }

    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/pedidos/[id]', e);
    return NextResponse.json({ error: 'Error al eliminar pedido' }, { status: 500 });
  }
}
