import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/api-auth';
import type { CarreraRider, EstadoCarrera } from '@/lib/types';

function mapEstado(estadoPedido: string): EstadoCarrera {
  if (estadoPedido === 'en_camino') return 'en_camino';
  if (estadoPedido === 'entregado') return 'entregada';
  return 'asignada';
}

export async function GET(request: Request) {
  let uid: string;
  try {
    const auth = await requireAuth(request, ['rider', 'maestro', 'central']);
    uid = auth.uid;
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
  try {
    const db = getAdminFirestore();
    const { searchParams } = new URL(request.url);
    const filtro = searchParams.get('filtro') || 'hoy';

    const now = Date.now();
    const hoyInicio = new Date();
    hoyInicio.setHours(0, 0, 0, 0);
    const hoyTs = hoyInicio.getTime();
    const semanaAtras = now - 7 * 24 * 60 * 60 * 1000;
    const mesAtras = now - 30 * 24 * 60 * 60 * 1000;

    const desde = filtro === 'mes' ? mesAtras : filtro === 'semana' ? semanaAtras : hoyTs;

    let docs: { id: string; data: () => Record<string, unknown> }[];
    try {
      const snap = await db
        .collection('pedidos')
        .where('riderId', '==', uid)
        .where('timestamp', '>=', desde)
        .get();
      docs = snap.docs;
    } catch (err) {
      const msg = (err as Error)?.message ?? '';
      if (msg.includes('index') || msg.includes('Index')) {
        const raw = await db.collection('pedidos').where('riderId', '==', uid).limit(200).get();
        docs = raw.docs
          .filter((d) => (d.data().timestamp || 0) >= desde)
          .sort((a, b) => (b.data().timestamp || 0) - (a.data().timestamp || 0));
      } else {
        throw err;
      }
    }

    const allCarreras: CarreraRider[] = docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        pedidoId: d.id,
        restaurante: (data.restaurante as string) || '—',
        restauranteDireccion: (data.restauranteDireccion as string) || '—',
        restauranteLat: typeof data.restauranteLat === 'number' ? data.restauranteLat : null,
        restauranteLng: typeof data.restauranteLng === 'number' ? data.restauranteLng : null,
        clienteNombre: (data.clienteNombre as string) || 'Cliente',
        clienteDireccion: (data.clienteDireccion as string) || '—',
        clienteLat: typeof data.clienteLat === 'number' ? data.clienteLat : null,
        clienteLng: typeof data.clienteLng === 'number' ? data.clienteLng : null,
        clienteTelefono: (data.clienteTelefono as string) || '',
        total: (data.total as number) || 0,
        propina: (data.propina as number) || 0,
        codigoVerificacion: (data.codigoVerificacion as string) || '',
        estado: mapEstado((data.estado as string) || 'asignado'),
        hora: (data.hora as string) || '',
        distancia: (data.distancia as string) || '—',
        items: Array.isArray(data.items) ? (data.items as string[]) : [],
        batchId: (data.batchId as string) ?? null,
        batchIndex: (data.batchIndex as number) ?? null,
        timestamp: (data.timestamp as number) ?? 0,
        paymentMethod: (data.paymentMethod as 'efectivo' | 'transferencia') || undefined,
        costoEnvio: typeof data.serviceCost === 'number' && !Number.isNaN(data.serviceCost as number) ? (data.serviceCost as number) : undefined,
      };
    });

    const carreras = allCarreras.filter((c) => c.estado !== 'entregada');
    const historial = allCarreras.filter((c) => c.estado === 'entregada');

    return NextResponse.json({ carreras, historial });
  } catch (e) {
    console.error('GET /api/rider', e);
    return NextResponse.json({ error: 'Error al cargar carreras' }, { status: 500 });
  }
}
