import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAuth } from '@/lib/api-auth';
import type { PedidoCentral } from '@/lib/types';
import { sendFCMToUser, sendFCMToRole, sendFCMToRider } from '@/lib/fcm-send-server';
import { sanitizeForFirestore } from '@/lib/firestoreUtils';
import { pedidoPatchSchema } from '@/lib/schemas/pedidoPatch';
import { applyDeliveredOrderAggregates } from '@/lib/local-stats-aggregates';
import { calcularComision, calcularNetoLocal } from '@/lib/commissions';
import { getOrderMoney } from '@/lib/order-money';
import { getRiderProfileForPedidoAssignment } from '@/lib/rider-profile-admin';

const RENOTIFY_COOLDOWN_MS = 3 * 60 * 1000;

const PEDIDO_TERMINAL_SIN_ASIGNAR: string[] = [
  'entregado',
  'cancelado_local',
  'cancelado_cliente',
  'cancelado_central',
  'cancelado_rider',
];

type PedidoConRider = PedidoCentral & { riderRating?: number | null };

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
    const transporte = data.transporte === 'buscando_rider' ? 'buscando_rider' : 'pendiente';
    const isRiderVerPreview =
      auth.rol === 'rider' &&
      (data.riderId ?? null) === null &&
      ((data.estado === 'esperando_rider') ||
        (transporte === 'buscando_rider' && ['preparando', 'listo'].includes(String(data.estado || ''))));
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
      transporte?: 'pendiente' | 'buscando_rider';
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
      riderNombre:
        typeof data.riderNombre === 'string' && data.riderNombre.trim()
          ? data.riderNombre.trim()
          : null,
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
      transporte: transporte === 'buscando_rider' ? 'buscando_rider' : undefined,
      motivoCancelacion:
        typeof data.motivoCancelacion === 'string' ? data.motivoCancelacion : undefined,
      ...(data.itemsCart && typeof data.itemsCart === 'object' && data.itemsCart.localId && Array.isArray(data.itemsCart.items)
        ? { itemsCart: data.itemsCart as PedidoCentral['itemsCart'] }
        : {}),
    };
    let pedido: PedidoConRider & PedidoPublico = pedidoBase;
    if (data.riderId) {
      const denorm =
        typeof pedidoBase.riderNombre === 'string' && pedidoBase.riderNombre.trim()
          ? pedidoBase.riderNombre.trim()
          : '';
      const hasRatingSnapshot = Object.prototype.hasOwnProperty.call(data, 'riderRatingSnapshot');
      if (hasRatingSnapshot) {
        const snapVal = data.riderRatingSnapshot;
        pedido = {
          ...pedidoBase,
          riderNombre: denorm || 'Rider',
          riderRating: snapVal == null || snapVal === '' ? null : Number(snapVal),
        };
      } else {
        const riderSnap = await db.collection('users').doc(data.riderId as string).get();
        if (riderSnap.exists) {
          const riderData = riderSnap.data()!;
          pedido = {
            ...pedidoBase,
            riderNombre: denorm || riderData.displayName || riderData.email || 'Rider',
            riderRating: riderData.ratingPromedio != null ? Number(riderData.ratingPromedio) : null,
          };
        }
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

    const isCentralOrMaestroPatch = auth.rol === 'central' || auth.rol === 'maestro';

    if (isCentralOrMaestroPatch && body.ocultoCentral !== undefined) {
      await ref.update(
        sanitizeForFirestore({
          ocultoCentral: body.ocultoCentral,
          updatedAt: FieldValue.serverTimestamp(),
        })
      );
      return NextResponse.json({ ok: true });
    }

    if (isCentralOrMaestroPatch && body.accion === 'rechazar_central') {
      const estadoActual = (data.estado as string) || 'confirmado';
      const terminales = [
        'entregado',
        'cancelado_local',
        'cancelado_cliente',
        'cancelado_central',
        'cancelado_rider',
      ];
      if (terminales.includes(estadoActual)) {
        return NextResponse.json(
          { error: 'No se puede rechazar este pedido en su estado actual' },
          { status: 400 }
        );
      }
      const motivoTrim =
        typeof body.motivo === 'string' ? body.motivo.trim().slice(0, 500) : '';
      if (!motivoTrim) {
        return NextResponse.json({ error: 'Debes indicar el motivo de rechazo' }, { status: 400 });
      }
      const riderIdPrev = (data.riderId as string) || null;
      const updatesRechazo: Record<string, unknown> = {
        estado: 'cancelado_central',
        motivoCancelacion: motivoTrim,
        canceladoPor: 'central',
        canceladoPorUid: auth.uid,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (riderIdPrev) {
        updatesRechazo.riderId = null;
        updatesRechazo.riderNombre = null;
      }
      await ref.update(sanitizeForFirestore(updatesRechazo));
      const clienteIdRechazo = data.clienteId ?? null;
      const motivoCorto =
        motivoTrim.length > 120 ? `${motivoTrim.slice(0, 117)}...` : motivoTrim;
      if (clienteIdRechazo && typeof clienteIdRechazo === 'string') {
        try {
          await sendFCMToUser(clienteIdRechazo, 'Pedido rechazado', `Motivo: ${motivoCorto}`, {
            pedidoId: id,
          });
        } catch {
          // ignorar
        }
      }
      if (riderIdPrev) {
        try {
          await sendFCMToRider(riderIdPrev, 'Carrera cancelada por Central', motivoCorto, {
            pedidoId: id,
          });
        } catch {
          // ignorar
        }
      }
      return NextResponse.json({ ok: true, cancelado: true });
    }

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
      const motivoTrim =
        typeof body.motivo === 'string' ? body.motivo.trim().slice(0, 500) : '';
      if (!motivoTrim) {
        return NextResponse.json(
          { error: 'Debes indicar el motivo de cancelación' },
          { status: 400 }
        );
      }
      await ref.update(
        sanitizeForFirestore({
          estado: 'cancelado_cliente',
          updatedAt: FieldValue.serverTimestamp(),
          canceladoPor: 'cliente',
          canceladoPorUid: auth.uid,
          motivoCancelacion: motivoTrim,
        })
      );
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
        const motivoTrim =
          typeof body.motivo === 'string' ? body.motivo.trim().slice(0, 500) : '';
        if (!motivoTrim) {
          return NextResponse.json(
            { error: 'Debes indicar el motivo de cancelación' },
            { status: 400 }
          );
        }
        const updatesCancel: Record<string, unknown> = {
          estado: 'cancelado_local',
          updatedAt: FieldValue.serverTimestamp(),
          canceladoPor: 'local',
          canceladoPorUid: auth.uid,
          motivoCancelacion: motivoTrim,
        };
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

      if (body.accion === 'solicitar_rider') {
        if (body.estado !== undefined || body.riderId !== undefined) {
          return NextResponse.json(
            { error: 'Para pedir rider usa solo la acción solicitar_rider' },
            { status: 400 }
          );
        }
        if (data.deliveryType === 'pickup') {
          return NextResponse.json({ error: 'Pedir rider no aplica a retiro en local' }, { status: 400 });
        }
        const estadoProd = (data.estado as string) || 'confirmado';
        if (!['preparando', 'listo'].includes(estadoProd)) {
          return NextResponse.json(
            { error: 'Solo puedes pedir rider mientras preparas o ya marcaste listo' },
            { status: 400 }
          );
        }
        if (data.riderId) {
          return NextResponse.json({ error: 'Este pedido ya tiene rider asignado' }, { status: 400 });
        }
        const batchLeaderLocalId = data.batchLeaderLocalId as string | null | undefined;
        const batchId = data.batchId as string | null | undefined;
        if (batchId && batchLeaderLocalId && batchLeaderLocalId !== userLocalId) {
          return NextResponse.json(
            { error: 'Solo el local líder del batch puede pedir rider' },
            { status: 403 }
          );
        }
        const restaurante = (data.restaurante as string) || 'Restaurante';
        const clienteNombre = (data.clienteNombre as string) || 'Cliente';
        const isRetry = body.isRetry === true;
        if (isRetry) {
          if (data.transporte !== 'buscando_rider') {
            return NextResponse.json(
              { error: 'Solo puedes re-notificar si ya pediste rider a central' },
              { status: 400 }
            );
          }
          const lastBump =
            typeof data.logisticaBumpAt === 'number' && !Number.isNaN(data.logisticaBumpAt)
              ? data.logisticaBumpAt
              : 0;
          if (lastBump > 0 && Date.now() - lastBump < RENOTIFY_COOLDOWN_MS) {
            return NextResponse.json(
              { error: 'Espera al menos 3 minutos entre re-notificaciones' },
              { status: 429 }
            );
          }
          const now = Date.now();
          await ref.update(
            sanitizeForFirestore({
              logisticaBumpAt: now,
              updatedAt: FieldValue.serverTimestamp(),
            })
          );
          try {
            await sendFCMToRole(
              'central',
              'Pedido lento — re-notificación',
              `${restaurante} · ${clienteNombre} — priorizar rider`,
              { pedidoId: id, localId: String(pedidoLocalId ?? ''), renotify: '1' }
            );
          } catch {
            // ignorar
          }
          return NextResponse.json({ ok: true, retry: true, logisticaBumpAt: now });
        }
        if (data.transporte === 'buscando_rider') {
          return NextResponse.json({ ok: true, already: true });
        }
        await ref.update(
          sanitizeForFirestore({
            transporte: 'buscando_rider',
            updatedAt: FieldValue.serverTimestamp(),
          })
        );
        try {
          await sendFCMToRole(
            'central',
            'Solicitud de rider',
            `${restaurante} · ${clienteNombre} (anticipada)`,
            { pedidoId: id, localId: String(pedidoLocalId ?? '') }
          );
        } catch {
          // ignorar
        }
        const clienteId = data.clienteId ?? null;
        if (clienteId && typeof clienteId === 'string') {
          try {
            await sendFCMToUser(
              clienteId,
              'Coordinando reparto',
              ' Estamos buscando un repartidor para tu pedido.',
              { pedidoId: id }
            );
          } catch {
            // ignorar
          }
        }
        return NextResponse.json({ ok: true });
      }

      const estadosPermitidosLocal = ['preparando', 'listo'];
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
            riderNombre: null,
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

    /* Central / maestro: asignar rider con transacción (evita doble asignación). */
    const isCentralOrMaestro = auth.rol === 'central' || auth.rol === 'maestro';
    const riderIdInBody = typeof body.riderId === 'string' ? body.riderId.trim() : '';
    const esAsignacionRider =
      isCentralOrMaestro &&
      riderIdInBody !== '' &&
      (body.estado === undefined || body.estado === 'asignado');

    if (esAsignacionRider) {
      const estadoActual = (data.estado as string) || 'confirmado';
      if (PEDIDO_TERMINAL_SIN_ASIGNAR.includes(estadoActual)) {
        return NextResponse.json(
          { error: 'No se puede asignar rider en este estado del pedido.' },
          { status: 400 }
        );
      }
      const currentRider = (data.riderId as string) || null;
      if (currentRider && currentRider !== riderIdInBody) {
        return NextResponse.json(
          { error: 'Este pedido ya fue asignado a otro rider.' },
          { status: 409 }
        );
      }
      if (currentRider === riderIdInBody) {
        return NextResponse.json({ ok: true, alreadyAssigned: true });
      }

      const estadoAsignacion = body.estado ?? 'asignado';
      const riderProfile = await getRiderProfileForPedidoAssignment(db, riderIdInBody);
      const riderNombre = riderProfile.displayName;
      const { riderRatingSnapshot, riderPhotoURLSnapshot } = riderProfile;

      try {
        await db.runTransaction(async (tx) => {
          const s = await tx.get(ref);
          if (!s.exists) {
            throw new Error('NOT_FOUND');
          }
          const d = s.data()!;
          const er = (d.riderId as string) || null;
          const es = (d.estado as string) || 'confirmado';
          if (PEDIDO_TERMINAL_SIN_ASIGNAR.includes(es)) {
            throw new Error('BAD_STATE');
          }
          if (er && er !== riderIdInBody) {
            throw new Error('CONFLICT');
          }
          if (er === riderIdInBody) {
            return;
          }
          const patch: Record<string, unknown> = {
            riderId: riderIdInBody,
            riderNombre,
            estado: estadoAsignacion,
            updatedAt: FieldValue.serverTimestamp(),
            riderRatingSnapshot,
            riderPhotoURLSnapshot,
          };
          if (body.propina !== undefined) patch.propina = body.propina;
          tx.update(ref, sanitizeForFirestore(patch));
        });
      } catch (e) {
        const code = e instanceof Error ? e.message : '';
        if (code === 'CONFLICT') {
          return NextResponse.json(
            { error: 'Este pedido ya fue asignado a otro rider.' },
            { status: 409 }
          );
        }
        if (code === 'BAD_STATE') {
          return NextResponse.json(
            { error: 'No se puede asignar rider en este estado del pedido.' },
            { status: 400 }
          );
        }
        if (code === 'NOT_FOUND') {
          return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
        }
        throw e;
      }

      const clienteIdAssign = data.clienteId ?? null;
      if (clienteIdAssign && typeof clienteIdAssign === 'string') {
        try {
          await sendFCMToUser(
            clienteIdAssign,
            'Repartidor asignado',
            'Tu pedido tiene repartidor asignado.',
            { pedidoId: id }
          );
        } catch {
          // ignorar
        }
      }
      const nombreLocalRaw =
        (typeof data.restaurante === 'string' && data.restaurante.trim()) ||
        (typeof data.nombreLocal === 'string' && data.nombreLocal.trim()) ||
        'el local';
      const nombreLocalCorto = nombreLocalRaw.slice(0, 80);
      try {
        await sendFCMToRider(
          riderIdInBody,
          '¡Nueva carrera asignada!',
          `Tienes un pedido de ${nombreLocalCorto}`,
          { pedidoId: id, tipo: 'pedido' }
        );
      } catch {
        // ignorar
      }
      return NextResponse.json({ ok: true });
    }

    const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (body.estado !== undefined) updates.estado = body.estado;
    if (body.riderId !== undefined) {
      updates.riderId = body.riderId;
      if (typeof body.riderId === 'string' && body.riderId.trim()) {
        const rp = await getRiderProfileForPedidoAssignment(db, body.riderId.trim());
        updates.riderNombre = rp.displayName;
        updates.riderRatingSnapshot = rp.riderRatingSnapshot;
        updates.riderPhotoURLSnapshot = rp.riderPhotoURLSnapshot;
      } else {
        updates.riderNombre = null;
        updates.riderRatingSnapshot = null;
        updates.riderPhotoURLSnapshot = null;
      }
    }
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

    // Al marcar como entregado: comisión idempotente del 8% sobre (subtotalBase + serviceFee al cliente).
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
          const montoComision = calcularComision(money.totalCliente, subtotalBase, money.serviceFee);
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
        esperando_rider: {
          title: 'Buscando repartidor',
          body: 'Seguimos coordinando la entrega. Te avisamos cuando vaya en camino.',
        },
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
