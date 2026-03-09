import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import type { ConfigAllResponse, ConfigTarifas, BannerItemPublic } from '@/lib/types/config';
import type { TarifaTier } from '@/lib/geo';

const TIERS_DEFAULT: TarifaTier[] = [
  { kmMax: 2.5, tarifa: 1.5 },
  { kmMax: 5, tarifa: 2.5 },
  { kmMax: null, tarifa: 3.5 },
];
const POR_PARADA_DEFAULT = 0.25;

interface BannerDoc {
  imageUrl?: string;
  alt?: string;
  linkType?: string;
  linkValue?:  string;
  order?: number;
  active?: boolean;
}

function parseTarifas(data: Record<string, unknown> | undefined): ConfigTarifas {
  const raw = data ?? {};
  const rawTiers = Array.isArray(raw.tiers) ? raw.tiers : TIERS_DEFAULT;
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
  const porParadaAdicional =
    typeof raw.porParadaAdicional === 'number' && !Number.isNaN(raw.porParadaAdicional)
      ? raw.porParadaAdicional
      : POR_PARADA_DEFAULT;
  return {
    tiers: tiers.length === 0 ? TIERS_DEFAULT : tiers,
    porParadaAdicional,
  };
}

function parseIntervalSeconds(data: Record<string, unknown> | undefined): number {
  const n = data?.intervalSeconds;
  if (typeof n === 'number' && n >= 2 && n <= 60) return Math.round(n);
  return 4;
}

async function fetchBannersPublic(db: ReturnType<typeof getAdminFirestore>): Promise<BannerItemPublic[]> {
  const coll = db.collection('banners');
  try {
    const snap = await coll.where('active', '==', true).orderBy('order', 'asc').get();
    return snap.docs.map((d) => {
      const data = d.data() as BannerDoc;
      return {
        id: d.id,
        imageUrl: data.imageUrl ?? '',
        alt: data.alt ?? '',
        linkType: data.linkType ?? 'url',
        linkValue: data.linkValue ?? '',
        order: typeof data.order === 'number' ? data.order : 0,
      };
    });
  } catch (indexErr: unknown) {
    const err = indexErr as { code?: number; details?: string; message?: string };
    const msg = typeof err.details === 'string' ? err.details : (typeof err.message === 'string' ? err.message : '');
    const needsIndex = err.code === 9 || msg.includes('index') || msg.includes('FAILED_PRECONDITION');
    if (!needsIndex) throw indexErr;
    const all = await coll.get();
    const docs = all.docs
      .map((d) => ({ id: d.id, data: d.data() as BannerDoc }))
      .filter(({ data }) => data.active === true)
      .sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));
    return docs.map(({ id, data }) => ({
      id,
      imageUrl: data.imageUrl ?? '',
      alt: data.alt ?? '',
      linkType: data.linkType ?? 'url',
      linkValue: data.linkValue ?? '',
      order: typeof data.order === 'number' ? data.order : 0,
    }));
  }
}

/** GET /api/config/all — config pública unificada (tarifas + banners + carrusel). Cacheable. */
export async function GET() {
  try {
    const db = getAdminFirestore();
    const [tarifasSnap, carruselSnap, bannersList] = await Promise.all([
      db.collection('config').doc('tarifasEnvio').get(),
      db.collection('config').doc('carrusel').get(),
      fetchBannersPublic(db),
    ]);

    const tarifas = parseTarifas(tarifasSnap.data());
    const intervalSeconds = parseIntervalSeconds(carruselSnap.data());

    const body: ConfigAllResponse = {
      tarifas,
      banners: { banners: bannersList, intervalSeconds },
    };

    const res = NextResponse.json(body);
    res.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return res;
  } catch (e) {
    console.error('GET /api/config/all', e);
    const fallback: ConfigAllResponse = {
      tarifas: { tiers: TIERS_DEFAULT, porParadaAdicional: POR_PARADA_DEFAULT },
      banners: { banners: [], intervalSeconds: 4 },
    };
    const res = NextResponse.json(fallback);
    res.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return res;
  }
}
