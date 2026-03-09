import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/api-auth';
import { revalidatePath } from 'next/cache';

const DOC_ID = 'tarifasEnvio';

export type TarifaTier = {
  kmMax: number | null;
  tarifa: number;
};

const TIERS_DEFAULT: TarifaTier[] = [
  { kmMax: 2.5, tarifa: 1.5 },
  { kmMax: 5, tarifa: 2.5 },
  { kmMax: null, tarifa: 3.5 },
];
const POR_PARADA_DEFAULT = 0.25;

/** GET /api/config/tarifas — leer tarifas de envío (pública para la app) */
export async function GET() {
  try {
    const db = getAdminFirestore();
    const snap = await db.collection('config').doc(DOC_ID).get();
    const data = snap.exists ? snap.data() ?? {} : {};
    const rawTiers = Array.isArray(data.tiers) ? data.tiers : TIERS_DEFAULT;
    const tiers: TarifaTier[] = rawTiers
      .filter((t: unknown) => t && typeof t === 'object' && typeof (t as TarifaTier).tarifa === 'number')
      .map((t: TarifaTier) => ({
        kmMax: typeof (t as TarifaTier).kmMax === 'number' ? (t as TarifaTier).kmMax : null,
        tarifa: Number((t as TarifaTier).tarifa),
      }))
      .sort((a, b) => {
        if (a.kmMax == null) return 1;
        if (b.kmMax == null) return -1;
        return a.kmMax - b.kmMax;
      });
    if (tiers.length === 0) {
      return NextResponse.json({ tiers: TIERS_DEFAULT, porParadaAdicional: POR_PARADA_DEFAULT });
    }
    const porParadaAdicional =
      typeof data.porParadaAdicional === 'number' && !Number.isNaN(data.porParadaAdicional)
        ? data.porParadaAdicional
        : POR_PARADA_DEFAULT;
    return NextResponse.json({ tiers, porParadaAdicional });
  } catch (e) {
    console.error('GET /api/config/tarifas', e);
    return NextResponse.json(
      { tiers: TIERS_DEFAULT, porParadaAdicional: POR_PARADA_DEFAULT }
    );
  }
}

/** PATCH /api/config/tarifas — actualizar tarifas (solo central o maestro) */
export async function PATCH(request: Request) {
  try {
    await requireAuth(request, ['central', 'maestro']);
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
  try {
    const body = await request.json() as {
      tiers?: TarifaTier[];
      porParadaAdicional?: number;
    };
    const db = getAdminFirestore();

    const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (Array.isArray(body.tiers) && body.tiers.length > 0) {
      const valid = body.tiers.every(
        (t) => t && typeof t === 'object' && typeof t.tarifa === 'number' && (t.kmMax == null || typeof t.kmMax === 'number')
      );
      if (!valid) {
        return NextResponse.json({ error: 'tiers inválido' }, { status: 400 });
      }
      updates.tiers = body.tiers
        .map((t) => ({ kmMax: t.kmMax ?? null, tarifa: Number(t.tarifa) }))
        .sort((a, b) => {
          if (a.kmMax == null) return 1;
          if (b.kmMax == null) return -1;
          return a.kmMax - b.kmMax;
        });
    }
    if (typeof body.porParadaAdicional === 'number' && !Number.isNaN(body.porParadaAdicional) && body.porParadaAdicional >= 0) {
      updates.porParadaAdicional = body.porParadaAdicional;
    }
    if (Object.keys(updates).length > 1) {
      await db.collection('config').doc(DOC_ID).set(updates, { merge: true });
    }

    revalidatePath('/');
    revalidatePath('/panel/central');
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('PATCH /api/config/tarifas', e);
    return NextResponse.json({ error: 'Error al guardar tarifas' }, { status: 500 });
  }
}
