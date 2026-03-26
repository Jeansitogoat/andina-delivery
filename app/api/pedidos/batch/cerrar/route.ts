import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAuth } from '@/lib/api-auth';
import { batchCerrarPostSchema } from '@/lib/schemas/batchCerrar';
import { calcularComision } from '@/lib/commissions';
import { applyDeliveredOrderAggregates } from '@/lib/local-stats-aggregates';

const CONFIG_DOC_ID = 'transferenciaAndina';

/** POST /api/pedidos/batch/cerrar → cierra todos los pedidos del batch con un solo código (rider). Transacción atómica. */
export async function POST(request: Request) {
  let auth: { uid: string; rol: string };
  try {
    auth = await requireAuth(request, ['rider', 'maestro']);
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
  try {
    const body = await request.json();
    const parse = batchCerrarPostSchema.safeParse(body);
    if (!parse.success) {
      const flat = parse.error.flatten().fieldErrors;
      const firstMessage = Object.values(flat).flat().find(Boolean) || 'Datos inválidos';
      return NextResponse.json({ error: String(firstMessage), fieldErrors: flat }, { status: 400 });
    }
    const { batchId, codigo } = parse.data;

    const db = getAdminFirestore();

    let programStartDate = '';
    try {
      const configSnap = await db.collection('config').doc(CONFIG_DOC_ID).get();
      const configData = configSnap.data();
      if (typeof configData?.programStartDate === 'string') {
        programStartDate = configData.programStartDate;
      }
    } catch {
      // si no hay config, se cobra comisión (comportamiento anterior)
    }

    const programStartTime = programStartDate ? new Date(programStartDate).getTime() : 0;

    const result = await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(
        db.collection('pedidos').where('batchId', '==', batchId)
      );

      if (snap.empty) {
        return { ok: false, error: 'Batch no encontrado' };
      }

      const docs = snap.docs
        .map((d) => ({ id: d.id, ref: d.ref, data: d.data() }))
        .sort((a, b) => (a.data.batchIndex ?? 0) - (b.data.batchIndex ?? 0));

      const leader = docs[0];
      const leaderCodigo = leader.data.codigoVerificacion || '';
      if (leaderCodigo !== codigo) {
        return { ok: false, error: 'Código incorrecto' };
      }

      const riderId = auth.uid;

      const ESTADOS_CANCELADOS = ['cancelado_local', 'cancelado_cliente'];
      for (const { ref, data, id } of docs) {
        const estadoActual = data.estado as string | undefined;
        const esCancelado = ESTADOS_CANCELADOS.includes(estadoActual ?? '');
        const pasarAEntregado = !esCancelado && estadoActual !== 'entregado';
        transaction.update(ref, {
          estado: esCancelado ? estadoActual : 'entregado',
          updatedAt: FieldValue.serverTimestamp(),
        });
        if (esCancelado) continue;

        const localId = data.localId ?? null;
        if (!localId) continue;

        if (pasarAEntregado) {
          await applyDeliveredOrderAggregates(
            db,
            {
              localId,
              pedidoId: id,
              total: Number(data.total ?? 0),
              timestamp: Number(
                (data.createdAt as { toMillis?: () => number } | undefined)?.toMillis?.()
                  ?? (data.timestamp as number | undefined)
                  ?? Date.now()
              ),
              items: Array.isArray(data.items) ? (data.items as string[]) : [],
            },
            transaction
          );
        }

        const pedidoTimestamp = (data.createdAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? (data.timestamp as number | undefined) ?? 0;
        if (programStartTime > 0 && pedidoTimestamp < programStartTime) continue;

        const localSnap = await transaction.get(db.collection('locales').doc(localId));
        const localData = localSnap.data() ?? {};
        const commissionStartDate = (typeof localData.commissionStartDate === 'string' ? localData.commissionStartDate : null) ?? programStartDate;
        const commissionStartTime = commissionStartDate ? new Date(commissionStartDate).getTime() : 0;
        if (commissionStartTime > 0 && pedidoTimestamp < commissionStartTime) continue;

        const total = (data.total as number) || 0;
        const montoComision = calcularComision(total, data.subtotal as number | undefined);
        // Idempotencia: docId = pedidoId evita comisiones duplicadas en reenvíos
        const comisionRef = db.collection('comisiones').doc(id);
        transaction.set(comisionRef, {
          localId,
          pedidoId: id,
          riderId,
          totalPedido: total,
          montoComision,
          fecha: FieldValue.serverTimestamp(),
          pagado: false,
        }, { merge: false });
      }

      return { ok: true };
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error ?? 'Error al cerrar batch' },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('POST /api/pedidos/batch/cerrar', e);
    return NextResponse.json(
      { error: 'Error al cerrar el batch' },
      { status: 500 }
    );
  }
}
