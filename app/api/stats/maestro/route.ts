import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/api-auth';
import { getLocalesFromFirestoreCached } from '@/lib/locales-firestore';

interface ComisionDoc {
  id: string;
  localId: string;
  montoComision: number;
  fecha: number;
  pagado: boolean;
}

/** GET /api/stats/maestro → estadísticas de comisiones (maestro) */
export async function GET(request: Request) {
  try {
    await requireAuth(request, ['maestro']);
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }

  try {
    const db = getAdminFirestore();
    const snap = await db.collection('comisiones').orderBy('fecha', 'desc').limit(300).get();

    const comisiones: ComisionDoc[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        localId: data.localId ?? '',
        montoComision: data.montoComision ?? 0,
        fecha: data.fecha?.toMillis?.() ?? 0,
        pagado: data.pagado ?? false,
      };
    });

    const now = Date.now();
    const hoyInicio = new Date();
    hoyInicio.setHours(0, 0, 0, 0);
    const hoyTs = hoyInicio.getTime();
    const semanaAtras = now - 7 * 24 * 60 * 60 * 1000;
    const mesAtras = now - 30 * 24 * 60 * 60 * 1000;

    const filtroHoy = (c: ComisionDoc) => c.fecha >= hoyTs;
    const filtroSemana = (c: ComisionDoc) => c.fecha >= semanaAtras;
    const filtroMes = (c: ComisionDoc) => c.fecha >= mesAtras;

    const sumarPendiente = (arr: ComisionDoc[]) =>
      Math.round(arr.filter((c) => !c.pagado).reduce((s, c) => s + c.montoComision, 0) * 100) / 100;
    const sumarPagado = (arr: ComisionDoc[]) =>
      Math.round(arr.filter((c) => c.pagado).reduce((s, c) => s + c.montoComision, 0) * 100) / 100;

    const totalPendiente = sumarPendiente(comisiones);
    const totalPagado = sumarPagado(comisiones);

    const hoy = comisiones.filter(filtroHoy);
    const semana = comisiones.filter(filtroSemana);
    const mes = comisiones.filter(filtroMes);

    const porLocal: Record<
      string,
      { localId: string; pendiente: number; pagado: number; total: number }
    > = {};
    for (const c of comisiones) {
      if (!porLocal[c.localId]) {
        porLocal[c.localId] = { localId: c.localId, pendiente: 0, pagado: 0, total: 0 };
      }
      const entry = porLocal[c.localId];
      if (c.pagado) {
        entry.pagado += c.montoComision;
      } else {
        entry.pendiente += c.montoComision;
      }
      entry.total += c.montoComision;
    }
    for (const v of Object.values(porLocal)) {
      v.pendiente = Math.round(v.pendiente * 100) / 100;
      v.pagado = Math.round(v.pagado * 100) / 100;
      v.total = Math.round(v.total * 100) / 100;
    }

    const fromFirestore = await getLocalesFromFirestoreCached();
    const localesMap: Record<string, string> = {};
    fromFirestore.locales.forEach((loc) => {
      localesMap[loc.id] = loc.name;
    });

    const porLocalArray = Object.values(porLocal).map((l) => ({
      ...l,
      nombre: localesMap[l.localId] ?? l.localId,
    }));

    return NextResponse.json({
      totalPendiente,
      totalPagado,
      total: Math.round((totalPendiente + totalPagado) * 100) / 100,
      hoy: { pendiente: sumarPendiente(hoy), pagado: sumarPagado(hoy), total: sumarPendiente(hoy) + sumarPagado(hoy) },
      semana: { pendiente: sumarPendiente(semana), pagado: sumarPagado(semana), total: sumarPendiente(semana) + sumarPagado(semana) },
      mes: { pendiente: sumarPendiente(mes), pagado: sumarPagado(mes), total: sumarPendiente(mes) + sumarPagado(mes) },
      porLocal: porLocalArray,
    });
  } catch (e) {
    console.error('GET /api/stats/maestro', e);
    return NextResponse.json({ error: 'Error al cargar estadísticas' }, { status: 500 });
  }
}
