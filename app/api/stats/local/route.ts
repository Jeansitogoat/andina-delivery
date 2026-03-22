import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/api-auth';

/** GET /api/stats/local?localId=xxx → estadísticas del local (pedidos, ingresos, clientes) */
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
      return NextResponse.json({ error: 'No autorizado para ver las estadísticas de este local' }, { status: 403 });
    }

    const db = getAdminFirestore();
    // Filtrar por los últimos 90 días para evitar full-scans históricos ilimitados.
    // El período de 90 días cubre hoy + semana + mes (30d) con margen amplio.
    const noventaDiasAtras = Date.now() - 90 * 24 * 60 * 60 * 1000;
    let snap;
    try {
      snap = await db
        .collection('pedidos')
        .where('localId', '==', localId)
        .where('timestamp', '>=', noventaDiasAtras)
        .orderBy('timestamp', 'desc')
        .limit(2000)
        .get();
    } catch (err) {
      const msg = (err as Error)?.message ?? '';
      if (msg.includes('index') || msg.includes('Index')) {
        // Fallback sin índice compuesto: filtro solo por localId, límite de 2000
        snap = await db
          .collection('pedidos')
          .where('localId', '==', localId)
          .orderBy('timestamp', 'desc')
          .limit(2000)
          .get();
      } else {
        throw err;
      }
    }

    interface PedidoRow {
      total: number;
      timestamp: number;
      clienteId?: string | null;
      estado?: string;
      items: string[];
    }

    const pedidos: PedidoRow[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        total: data.total ?? 0,
        timestamp: data.timestamp ?? 0,
        clienteId: data.clienteId ?? null,
        estado: data.estado ?? '',
        items: Array.isArray(data.items) ? (data.items as string[]) : [],
      };
    });

    const pedidosEntregados = pedidos.filter((p) => p.estado === 'entregado');

    const now = Date.now();
    const hoyInicio = new Date();
    hoyInicio.setHours(0, 0, 0, 0);
    const hoyTs = hoyInicio.getTime();
    const semanaAtras = now - 7 * 24 * 60 * 60 * 1000;
    const mesAtras = now - 30 * 24 * 60 * 60 * 1000;

    const filtroHoy = (p: PedidoRow) => p.timestamp >= hoyTs;
    const filtroSemana = (p: PedidoRow) => p.timestamp >= semanaAtras;
    const filtroMes = (p: PedidoRow) => p.timestamp >= mesAtras;

    const sumarTotal = (arr: PedidoRow[]) =>
      Math.round(arr.reduce((s, p) => s + p.total, 0) * 100) / 100;
    const unicos = (arr: PedidoRow[]) =>
      new Set(arr.map((p) => p.clienteId).filter(Boolean)).size;

    const hoy = pedidos.filter(filtroHoy);
    const semana = pedidos.filter(filtroSemana);
    const mes = pedidos.filter(filtroMes);

    const dayMs = 24 * 60 * 60 * 1000;
    const startOfWeek = new Date(hoyInicio);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1); // Lunes
    const startOfWeekTs = startOfWeek.getTime();

    // Hoy: poner count en el índice del día actual (0=Lun, 6=Dom)
    const dayOfWeek = (hoyInicio.getDay() + 6) % 7; // Lun=0, Dom=6
    const datosHoyPedidos = [0, 0, 0, 0, 0, 0, 0];
    const datosHoyIngresos = [0, 0, 0, 0, 0, 0, 0];
    datosHoyPedidos[dayOfWeek] = hoy.length;
    datosHoyIngresos[dayOfWeek] = Math.round(sumarTotal(hoy) * 100) / 100;

    // Semana: datos por día
    const diasSemana: number[] = [0, 0, 0, 0, 0, 0, 0];
    const ingresosSemana: number[] = [0, 0, 0, 0, 0, 0, 0];
    semana.forEach((p) => {
      const dayIndex = Math.floor((p.timestamp - startOfWeekTs) / dayMs);
      if (dayIndex >= 0 && dayIndex < 7) {
        diasSemana[dayIndex]++;
        ingresosSemana[dayIndex] += p.total;
      }
    });

    const semanasMes: number[] = [0, 0, 0, 0];
    const ingresosMes: number[] = [0, 0, 0, 0];
    const startOfMonth = new Date(hoyInicio.getFullYear(), hoyInicio.getMonth(), 1);
    const startOfMonthTs = startOfMonth.getTime();
    mes.forEach((p) => {
      const weekIndex = Math.min(
        3,
        Math.floor((p.timestamp - startOfMonthTs) / (7 * dayMs))
      );
      if (weekIndex >= 0) {
        semanasMes[weekIndex]++;
        ingresosMes[weekIndex] += p.total;
      }
    });

    // Top productos vendidos (pedidos entregados)
    const itemCount = new Map<string, number>();
    pedidosEntregados.forEach((p) => {
      (p.items || []).forEach((line) => {
        const match = line.match(/^(\d+)\s*×\s*(.+)$/) || line.match(/^(.+)$/);
        const qty = match && match[1] ? parseInt(match[1], 10) : 1;
        const name = (match && match[2] ? match[2] : line).trim();
        if (!name) return;
        itemCount.set(name, (itemCount.get(name) || 0) + qty);
      });
    });
    const topItems = Array.from(itemCount.entries())
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 10);

    return NextResponse.json({
      hoy: {
        totalPedidos: hoy.length,
        totalIngresos: sumarTotal(hoy),
        clientesUnicos: unicos(hoy),
        datosPedidos: datosHoyPedidos,
        datosIngresos: datosHoyIngresos,
      },
      semana: {
        totalPedidos: semana.length,
        totalIngresos: sumarTotal(semana),
        clientesUnicos: unicos(semana),
        datosPedidos: diasSemana,
        datosIngresos: ingresosSemana.map((v) => Math.round(v * 100) / 100),
      },
      mes: {
        totalPedidos: mes.length,
        totalIngresos: sumarTotal(mes),
        clientesUnicos: unicos(mes),
        datosPedidos: semanasMes,
        datosIngresos: ingresosMes.map((v) => Math.round(v * 100) / 100),
      },
      topItems,
    });
  } catch (e) {
    console.error('GET /api/stats/local', e);
    return NextResponse.json({ error: 'Error al cargar estadísticas' }, { status: 500 });
  }
}
