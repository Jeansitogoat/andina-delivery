import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/api-auth';
import { sanitizeForFirestore } from '@/lib/firestoreUtils';
import type { EstadoMandado } from '@/lib/types';
import { sendFCMToRole, sendFCMToRider, sendFCMToUser } from '@/lib/fcm-send-server';

type PatchBody = {
  estado?: EstadoMandado;
  riderId?: string | null;
  riderNombre?: string | null;
  accion?: 'cancelar_cliente';
};

const ACTIVOS: EstadoMandado[] = ['pendiente', 'asignado', 'en_camino'];

function isCentral(rol: string) {
  return rol === 'central' || rol === 'maestro';
}

/** PATCH /api/mandados/[id] — central asigna rider; rider avanza estado; cliente cancela si pendiente. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let auth: { uid: string; rol: string };
  try {
    auth = await requireAuth(request, ['cliente', 'central', 'maestro', 'rider']);
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }

  const { id } = await params;
  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const db = getAdminFirestore();
  const ref = db.collection('mandados').doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: 'Mandado no encontrado' }, { status: 404 });
  }

  const data = snap.data()!;
  const clienteId = String(data.clienteId || '');
  const riderActual = (data.riderId as string) || null;
  const estadoActual = (data.estado as EstadoMandado) || 'pendiente';
  const descripcion = String(data.descripcion || 'Mandado').slice(0, 120);

  if (auth.rol === 'cliente') {
    if (auth.uid !== clienteId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    if (body.accion !== 'cancelar_cliente') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    if (estadoActual !== 'pendiente') {
      return NextResponse.json({ error: 'Solo puedes cancelar mientras está pendiente' }, { status: 400 });
    }
    await ref.update(
      sanitizeForFirestore({
        estado: 'cancelado',
        updatedAt: FieldValue.serverTimestamp(),
      })
    );
    void sendFCMToRole('central', 'Mandado cancelado', descripcion, {
      tipo: 'mandado',
      mandadoId: id,
      estado: 'cancelado',
    }).catch(() => {});
    if (riderActual) {
      void sendFCMToRider(riderActual, 'Mandado cancelado por el cliente', descripcion, {
        tipo: 'mandado',
        mandadoId: id,
        estado: 'cancelado',
      }).catch(() => {});
    }
    return NextResponse.json({ ok: true });
  }

  if (isCentral(auth.rol)) {
    const riderId = typeof body.riderId === 'string' ? body.riderId.trim() : '';
    const riderNombre = typeof body.riderNombre === 'string' ? body.riderNombre.trim().slice(0, 120) : '';
    if (!riderId || !riderNombre) {
      return NextResponse.json({ error: 'riderId y riderNombre requeridos' }, { status: 400 });
    }
    if (!ACTIVOS.includes(estadoActual)) {
      return NextResponse.json({ error: 'Mandado ya cerrado' }, { status: 400 });
    }
    if (riderActual && riderActual !== riderId) {
      return NextResponse.json({ error: 'Este mandado ya fue asignado a otro rider.' }, { status: 409 });
    }
    if (estadoActual === 'asignado' && riderActual === riderId) {
      return NextResponse.json({ ok: true, alreadyAssigned: true });
    }
    if (estadoActual !== 'pendiente' || riderActual) {
      return NextResponse.json(
        { error: 'Solo se puede asignar rider mientras el mandado está pendiente y sin rider.' },
        { status: 400 }
      );
    }

    try {
      await db.runTransaction(async (tx) => {
        const s = await tx.get(ref);
        if (!s.exists) {
          throw new Error('NOT_FOUND');
        }
        const d = s.data()!;
        const er = (d.riderId as string) || null;
        const es = (d.estado as EstadoMandado) || 'pendiente';
        if (es !== 'pendiente') {
          throw new Error('BAD_STATE');
        }
        if (er) {
          throw new Error('CONFLICT');
        }
        tx.update(
          ref,
          sanitizeForFirestore({
            riderId,
            riderNombre,
            estado: 'asignado',
            updatedAt: FieldValue.serverTimestamp(),
          })
        );
      });
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      if (code === 'CONFLICT') {
        return NextResponse.json({ error: 'Este mandado ya fue asignado a otro rider.' }, { status: 409 });
      }
      if (code === 'BAD_STATE') {
        return NextResponse.json(
          { error: 'Solo se puede asignar rider mientras el mandado está pendiente.' },
          { status: 400 }
        );
      }
      if (code === 'NOT_FOUND') {
        return NextResponse.json({ error: 'Mandado no encontrado' }, { status: 404 });
      }
      throw e;
    }

    void sendFCMToRider(riderId, 'Nuevo mandado asignado', descripcion, {
      tipo: 'mandado',
      mandadoId: id,
      estado: 'asignado',
    }).catch(() => {});
    void sendFCMToUser(clienteId, 'Tu mandado tiene rider', `${riderNombre} fue asignado a tu mandado.`, {
      tipo: 'mandado',
      mandadoId: id,
      estado: 'asignado',
    }).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  if (auth.rol === 'rider') {
    if (riderActual !== auth.uid) {
      return NextResponse.json({ error: 'No eres el rider asignado' }, { status: 403 });
    }
    const next = body.estado;
    if (next === 'en_camino' && estadoActual === 'asignado') {
      await ref.update(
        sanitizeForFirestore({ estado: 'en_camino', updatedAt: FieldValue.serverTimestamp() })
      );
      void sendFCMToUser(clienteId, 'Tu mandado va en camino', 'El motorizado está realizando tu mandado.', {
        tipo: 'mandado',
        mandadoId: id,
        estado: 'en_camino',
      }).catch(() => {});
      return NextResponse.json({ ok: true });
    }
    if (next === 'completado' && (estadoActual === 'asignado' || estadoActual === 'en_camino')) {
      await ref.update(
        sanitizeForFirestore({ estado: 'completado', updatedAt: FieldValue.serverTimestamp() })
      );
      void sendFCMToUser(clienteId, 'Mandado completado', 'Tu mandado fue marcado como completado.', {
        tipo: 'mandado',
        mandadoId: id,
        estado: 'completado',
      }).catch(() => {});
      void sendFCMToRole('central', 'Mandado completado', descripcion, {
        tipo: 'mandado',
        mandadoId: id,
        estado: 'completado',
      }).catch(() => {});
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Transición no válida' }, { status: 400 });
  }

  return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
}
