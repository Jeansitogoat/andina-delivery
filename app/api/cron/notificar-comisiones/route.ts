import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebase-admin';

const CONFIG_DOC_ID = 'transferenciaAndina';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** GET /api/cron/notificar-comisiones
 * Llamado por Vercel Cron (ej. 23:59 domingos). Verifica CRON_SECRET.
 * Usa programStartDate y cycleDays para periodos por local; genera resumen con cuenta y whatsappAdmin.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getAdminFirestore();
    const now = Date.now();
    const semanaAtras = now - 7 * MS_PER_DAY;

    let config: { cuenta?: string; banco?: string; qr?: string; programStartDate?: string; cycleDays?: number; whatsappAdmin?: string } = {};
    try {
      const configSnap = await db.collection('config').doc(CONFIG_DOC_ID).get();
      if (configSnap.exists) {
        config = configSnap.data() ?? {};
      }
    } catch {
      // ignorar
    }

    const programStartDate = typeof config.programStartDate === 'string' ? config.programStartDate : '';
    const cycleDays = typeof config.cycleDays === 'number' && [7, 15, 30].includes(config.cycleDays) ? config.cycleDays : 15;

    const snap = await db
      .collection('comisiones')
      .where('pagado', '==', false)
      .get();

    const comisiones = snap.docs.map((d) => {
      const data = d.data();
      const fecha = data.fecha?.toMillis?.() ?? 0;
      return {
        localId: data.localId as string,
        fecha,
        montoComision: data.montoComision ?? 0,
      };
    });

    const comisionesSemana = comisiones.filter((c) => c.fecha >= semanaAtras);
    const totalSemana =
      Math.round(comisionesSemana.reduce((s, c) => s + c.montoComision, 0) * 100) / 100;

    const localesSnap = await db.collection('locales').get();
    const localesMap = new Map<string, { name: string; commissionStartDate: string }>();
    localesSnap.docs.forEach((d) => {
      const data = d.data();
      const commissionStartDate =
        typeof data.commissionStartDate === 'string'
          ? data.commissionStartDate
          : programStartDate || new Date().toISOString().slice(0, 10);
      localesMap.set(d.id, {
        name: String(data.name ?? d.id),
        commissionStartDate: commissionStartDate.slice(0, 10),
      });
    });

    const localesResumen: { localId: string; nombre: string; periodoFin: string; totalPendiente: number }[] = [];
    const startTime = programStartDate ? new Date(programStartDate.slice(0, 10)).getTime() : 0;

    localesMap.forEach((loc, localId) => {
      const commissionStartTime = new Date(loc.commissionStartDate).getTime();
      if (startTime > 0 && commissionStartTime < startTime) return;
      const cycleMs = cycleDays * MS_PER_DAY;
      let periodEnd = commissionStartTime;
      while (periodEnd <= now) {
        periodEnd += cycleMs;
      }
      periodEnd -= cycleMs;
      if (now < periodEnd) return;
      const periodEndStr = new Date(periodEnd).toISOString().slice(0, 10);
      const periodStart = periodEnd - cycleMs;
      const totalPendiente =
        Math.round(
          comisiones
            .filter((c) => c.localId === localId && c.fecha >= periodStart && c.fecha < periodEnd + MS_PER_DAY)
            .reduce((s, c) => s + c.montoComision, 0) * 100
        ) / 100;
      localesResumen.push({
        localId,
        nombre: loc.name,
        periodoFin: periodEndStr,
        totalPendiente,
      });
    });

    const resumen = {
      totalPendienteSemana: totalSemana,
      cantidadComisiones: comisionesSemana.length,
      cuenta: config.cuenta ?? '—',
      banco: config.banco ?? '—',
      qr: config.qr ?? null,
      whatsappAdmin: config.whatsappAdmin ?? '',
      cycleDays,
      programStartDate: programStartDate || null,
      locales: localesResumen,
      fecha: new Date().toISOString(),
    };

    await db.collection('config').doc('ultimoResumenComisiones').set({
      ...resumen,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      ok: true,
      mensaje: `Comisiones pendientes semana: $${totalSemana.toFixed(2)} (${comisionesSemana.length} pedidos)`,
      resumen,
    });
  } catch (e) {
    console.error('Cron notificar-comisiones', e);
    return NextResponse.json(
      { error: 'Error al procesar comisiones' },
      { status: 500 }
    );
  }
}
