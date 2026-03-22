import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/api-auth';
import type { PedidoCentral, RiderCentral } from '@/lib/types';

const RIDER_COLORS = [
  'bg-blue-600', 'bg-purple-600', 'bg-green-600',
  'bg-orange-500', 'bg-red-600', 'bg-teal-600',
];

export async function GET(request: Request) {
  try {
    await requireAuth(request, ['central', 'maestro']);
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

    const pedidosSnap = await db
      .collection('pedidos')
      .where('timestamp', '>=', desde)
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();

    const pedidos: PedidoCentral[] = pedidosSnap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          restaurante: data.restaurante || '—',
          restauranteDireccion: data.restauranteDireccion || '—',
          clienteNombre: data.clienteNombre || 'Cliente',
          clienteDireccion: data.clienteDireccion || '—',
          clienteTelefono: data.clienteTelefono || '',
          items: data.items || [],
          total: data.total || 0,
          estado: data.estado || 'esperando_rider',
          riderId: data.riderId || null,
          hora: data.hora || '',
          timestamp: data.timestamp || 0,
          distancia: data.distancia || '—',
          localId: data.localId || null,
          codigoVerificacion: data.codigoVerificacion || '',
          propina: data.propina || 0,
          deliveryType: (data.deliveryType === 'pickup' ? 'pickup' : 'delivery') as 'delivery' | 'pickup',
          batchId: data.batchId || null,
          batchIndex: data.batchIndex ?? null,
          batchLeaderLocalId: data.batchLeaderLocalId || null,
        };
      })
      .filter((p) => p.deliveryType !== 'pickup')
      .sort((a, b) => b.timestamp - a.timestamp);

    // Riders aprobados desde Firestore
    const ridersSnap = await db
      .collection('users')
      .where('rol', '==', 'rider')
      .where('riderStatus', '==', 'approved')
      .get();

    const riders: RiderCentral[] = ridersSnap.docs.map((d, i) => {
      const data = d.data();
      const nombre = data.displayName || data.email || 'Rider';
      const carrerasHoy = pedidos.filter(
        (p) => p.riderId === d.id && p.estado === 'entregado'
      ).length;
      const tieneCarreraActiva = pedidos.some(
        (p) => p.riderId === d.id && p.estado !== 'entregado'
      );
      const estadoManual = (data.estadoRider as 'disponible' | 'ausente' | 'fuera_servicio') || 'disponible';
      const estado: RiderCentral['estado'] = tieneCarreraActiva ? 'ocupado' : estadoManual;
      const calificacion = data.ratingPromedio != null ? Number(data.ratingPromedio) : 0;
      return {
        id: d.id,
        nombre,
        inicial: nombre.charAt(0).toUpperCase(),
        telefono: data.telefono || '',
        estado,
        carrerasHoy,
        calificacion,
        color: RIDER_COLORS[i % RIDER_COLORS.length],
        photoURL: data.photoURL || null,
      };
    });

    return NextResponse.json({ pedidos, riders });
  } catch (e) {
    console.error('GET /api/central', e);
    return NextResponse.json({ error: 'Error al cargar central' }, { status: 500 });
  }
}
