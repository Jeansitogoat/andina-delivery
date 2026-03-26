import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/api-auth';
import { dayKeyGuayaquil, startOfDayGuayaquil } from '@/lib/guayaquil-time';

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
    const now = Date.now();
    const hoyTs = startOfDayGuayaquil(now);
    const hoyInicio = new Date(hoyTs);
    const semanaAtras = now - 7 * 24 * 60 * 60 * 1000;
    const mesAtras = now - 30 * 24 * 60 * 60 * 1000;
    const dayMs = 24 * 60 * 60 * 1000;

    const dayKeys: string[] = [];
    for (let i = 0; i < 30; i++) {
      dayKeys.push(dayKeyGuayaquil(now - i * dayMs));
    }
    const dayRefs = dayKeys.map((key) => db.collection('locales').doc(localId).collection('stats_daily').doc(key));
    const daySnaps = await db.getAll(...dayRefs);
    const dailyMap = new Map<string, { pedidos: number; ingresos: number }>();
    daySnaps.forEach((snap) => {
      if (!snap.exists) return;
      const d = snap.data() || {};
      dailyMap.set(snap.id, {
        pedidos: Number(d.pedidosEntregados ?? 0),
        ingresos: Number(d.ingresosEntregados ?? 0),
      });
    });

    const startOfWeek = new Date(hoyInicio);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1); // Lunes
    const startOfWeekTs = startOfWeek.getTime();

    const datosHoyPedidos = [0, 0, 0, 0, 0, 0, 0];
    const datosHoyIngresos = [0, 0, 0, 0, 0, 0, 0];
    const diasSemana: number[] = [0, 0, 0, 0, 0, 0, 0];
    const ingresosSemana: number[] = [0, 0, 0, 0, 0, 0, 0];
    const semanasMes: number[] = [0, 0, 0, 0];
    const ingresosMes: number[] = [0, 0, 0, 0];

    let hoyPedidos = 0;
    let hoyIngresos = 0;
    let semanaPedidos = 0;
    let semanaIngresos = 0;
    let mesPedidos = 0;
    let mesIngresos = 0;

    for (let i = 0; i < 30; i++) {
      const ts = now - i * dayMs;
      const key = dayKeyGuayaquil(ts);
      const row = dailyMap.get(key) ?? { pedidos: 0, ingresos: 0 };
      if (ts >= hoyTs) {
        hoyPedidos += row.pedidos;
        hoyIngresos += row.ingresos;
      }
      if (ts >= semanaAtras) {
        semanaPedidos += row.pedidos;
        semanaIngresos += row.ingresos;
      }
      if (ts >= mesAtras) {
        mesPedidos += row.pedidos;
        mesIngresos += row.ingresos;
      }
      const dayIndexWeek = Math.floor((ts - startOfWeekTs) / dayMs);
      if (dayIndexWeek >= 0 && dayIndexWeek < 7) {
        diasSemana[dayIndexWeek] += row.pedidos;
        ingresosSemana[dayIndexWeek] += row.ingresos;
      }
      const startOfMonth = new Date(hoyInicio.getFullYear(), hoyInicio.getMonth(), 1).getTime();
      const weekIndex = Math.min(3, Math.floor((ts - startOfMonth) / (7 * dayMs)));
      if (weekIndex >= 0 && weekIndex < 4) {
        semanasMes[weekIndex] += row.pedidos;
        ingresosMes[weekIndex] += row.ingresos;
      }
    }

    const dayOfWeek = (hoyInicio.getDay() + 6) % 7; // Lun=0, Dom=6
    datosHoyPedidos[dayOfWeek] = hoyPedidos;
    datosHoyIngresos[dayOfWeek] = Math.round(hoyIngresos * 100) / 100;

    const clientesSnap = await db
      .collection('pedidos')
      .where('localId', '==', localId)
      .where('estado', '==', 'entregado')
      .orderBy('timestamp', 'desc')
      .limit(200)
      .get();
    const clientesHoy = new Set<string>();
    const clientesSemana = new Set<string>();
    const clientesMes = new Set<string>();
    clientesSnap.docs.forEach((d) => {
      const data = d.data();
      const cid = typeof data.clienteId === 'string' ? data.clienteId : null;
      const ts = Number(data.timestamp ?? 0);
      if (!cid) return;
      if (ts >= hoyTs) clientesHoy.add(cid);
      if (ts >= semanaAtras) clientesSemana.add(cid);
      if (ts >= mesAtras) clientesMes.add(cid);
    });

    const topItemsSnap = await db
      .collection('locales')
      .doc(localId)
      .collection('stats_items')
      .orderBy('cantidad', 'desc')
      .limit(10)
      .get();
    const topItems = topItemsSnap.docs.map((d) => {
      const data = d.data();
      return {
        nombre: typeof data.nombre === 'string' ? data.nombre : d.id,
        cantidad: Number(data.cantidad ?? 0),
      };
    });

    return NextResponse.json({
      hoy: {
        totalPedidos: hoyPedidos,
        totalIngresos: Math.round(hoyIngresos * 100) / 100,
        clientesUnicos: clientesHoy.size,
        datosPedidos: datosHoyPedidos,
        datosIngresos: datosHoyIngresos,
      },
      semana: {
        totalPedidos: semanaPedidos,
        totalIngresos: Math.round(semanaIngresos * 100) / 100,
        clientesUnicos: clientesSemana.size,
        datosPedidos: diasSemana,
        datosIngresos: ingresosSemana.map((v) => Math.round(v * 100) / 100),
      },
      mes: {
        totalPedidos: mesPedidos,
        totalIngresos: Math.round(mesIngresos * 100) / 100,
        clientesUnicos: clientesMes.size,
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
