import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/api-auth';

export interface ComisionDoc {
  id: string;
  localId: string;
  pedidoId: string;
  totalPedido: number;
  subtotalBase?: number;
  montoComision: number;
  netoLocal?: number;
  fecha: number;
  pagado: boolean;
}

/** GET /api/comisiones?localId=xxx → comisiones del local (local, maestro o central) */
export async function GET(request: Request) {
  let auth: { uid: string; rol: string; localId?: string | null };
  try {
    auth = await requireAuth(request, ['local', 'maestro', 'central']);
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
  try {
    const { searchParams } = new URL(request.url);
    const localId = searchParams.get('localId');
    if (!localId) {
      return NextResponse.json({ error: 'localId requerido' }, { status: 400 });
    }
    if (auth.rol === 'local' && auth.localId !== localId) {
      return NextResponse.json({ error: 'No autorizado para ver las comisiones de este local' }, { status: 403 });
    }

    const db = getAdminFirestore();
    const snap = await db.collection('comisiones').where('localId', '==', localId).orderBy('fecha', 'desc').limit(200).get();

    const comisiones: ComisionDoc[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        localId: data.localId,
        pedidoId: data.pedidoId,
        totalPedido: data.totalPedido || 0,
        subtotalBase: data.subtotalBase || 0,
        montoComision: data.montoComision || 0,
        netoLocal: data.netoLocal || 0,
        fecha: data.fecha?.toMillis?.() ?? 0,
        pagado: data.pagado ?? false,
      };
    }).sort((a, b) => b.fecha - a.fecha);

    const totalPendiente = Math.round(
      comisiones.filter((c) => !c.pagado).reduce((s, c) => s + c.montoComision, 0) * 100
    ) / 100;
    const totalPagado = Math.round(
      comisiones.filter((c) => c.pagado).reduce((s, c) => s + c.montoComision, 0) * 100
    ) / 100;

    return NextResponse.json({ comisiones, totalPendiente, totalPagado });
  } catch (e) {
    console.error('GET /api/comisiones', e);
    return NextResponse.json({ error: 'Error al cargar comisiones' }, { status: 500 });
  }
}
