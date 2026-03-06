import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/api-auth';
import type { PedidoCentral } from '@/lib/types';

/** GET /api/pedidos/batch/[batchId] → pedidos del batch (solo local/maestro; debe tener al menos un pedido de su local). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  let auth: { uid: string; rol: string };
  try {
    auth = await requireAuth(_request, ['local', 'maestro']);
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
  try {
    const { batchId } = await params;
    if (!batchId?.trim()) {
      return NextResponse.json({ error: 'batchId requerido' }, { status: 400 });
    }
    const db = getAdminFirestore();

    let userLocalId: string | null = null;
    if (auth.rol === 'local') {
      const userSnap = await db.collection('users').doc(auth.uid).get();
      userLocalId = userSnap.data()?.localId ?? null;
      if (!userLocalId) {
        return NextResponse.json({ pedidos: [] });
      }
    }
    if (auth.rol === 'maestro') {
      // Maestro must pass localId in query to scope to a local
      const { searchParams } = new URL(_request.url);
      userLocalId = searchParams.get('localId')?.trim() ?? null;
      if (!userLocalId) {
        return NextResponse.json({ error: 'localId requerido para rol maestro' }, { status: 400 });
      }
    }

    const snap = await db
      .collection('pedidos')
      .where('batchId', '==', batchId.trim())
      .get();

    const allInBatch: PedidoCentral[] = snap.docs.map((d) => {
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
        batchId: data.batchId ?? null,
        batchIndex: data.batchIndex ?? null,
        batchLeaderLocalId: data.batchLeaderLocalId ?? null,
      };
    });

    const hasAccess =
      allInBatch.length === 0 ||
      allInBatch.some((p) => p.localId === userLocalId);
    if (!hasAccess) {
      return NextResponse.json({ pedidos: [] });
    }

    const pedidos = allInBatch.sort((a, b) => (a.batchIndex ?? 0) - (b.batchIndex ?? 0));

    return NextResponse.json({ pedidos });
  } catch (e) {
    console.error('GET /api/pedidos/batch/[batchId]', e);
    return NextResponse.json({ error: 'Error al cargar batch' }, { status: 500 });
  }
}
