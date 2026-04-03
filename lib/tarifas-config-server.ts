import { getAdminFirestore } from '@/lib/firebase-admin';
import type { TarifaTier } from '@/lib/geo';

const DOC_ID = 'tarifasEnvio';

const TIERS_DEFAULT: TarifaTier[] = [
  { kmMax: 2.5, tarifa: 1.5 },
  { kmMax: 5, tarifa: 2.5 },
  { kmMax: null, tarifa: 3.5 },
];

/** Tiers de envío desde Firestore (misma fuente que GET /api/config/tarifas). */
export async function getTarifasEnvioTiersAdmin(): Promise<TarifaTier[]> {
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
    return tiers.length > 0 ? tiers : TIERS_DEFAULT;
  } catch {
    return TIERS_DEFAULT;
  }
}

/** Tarifa mínima del primer tramo (fallback si no hay distancia). */
export function tarifaMinimaFromTiers(tiers: TarifaTier[]): number {
  if (tiers.length === 0) return 1.5;
  const first = tiers[0];
  return typeof first.tarifa === 'number' && !Number.isNaN(first.tarifa) ? first.tarifa : 1.5;
}
