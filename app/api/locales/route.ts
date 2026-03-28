import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';

export const dynamic = 'force-dynamic';
import type { Local, MenuItem } from '@/lib/data';
import {
  getLocalesFromFirestore,
  getLocalesForHomeFilter,
  getExistingLocalIdsFromFirestore,
  setLocalInFirestore,
} from '@/lib/locales-firestore';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/api-auth';
import { slugify, ensureUniqueLocalId } from '@/lib/slugify';
import { normalizeDataUrl, isValidImageUrl } from '@/lib/validImageUrl';
import { localPostSchema } from '@/lib/schemas/localPost';
import { DISCOVERY_CATEGORY_SET } from '@/lib/discovery-categorias';

const CONFIG_DOC_ID = 'transferenciaAndina';

function getCommissionStartDate(programStartDate: string): string {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  if (!programStartDate) return today;
  const startTime = new Date(programStartDate.slice(0, 10)).getTime();
  if (now.getTime() < startTime) return programStartDate.slice(0, 10);
  return today;
}

const CACHE_REVALIDATE = 60;

/** En light=1 omitimos horarios si el payload sería grande (ahorro de ancho de banda en Home). */
const LIGHT_HORARIOS_MAX_DIAS = 7;
const LIGHT_HORARIOS_MAX_JSON_CHARS = 1200;

function isHorariosHeavyForLight(horarios: unknown): boolean {
  if (!Array.isArray(horarios)) return false;
  if (horarios.length > LIGHT_HORARIOS_MAX_DIAS) return true;
  try {
    return JSON.stringify(horarios).length > LIGHT_HORARIOS_MAX_JSON_CHARS;
  } catch {
    return true;
  }
}

async function fetchLocalesData(incluirSuspendidos: boolean, categoria: string | null) {
  // Fase 2: getLocalesFromFirestore() ya no descarga los menús (subcolección productos).
  // Con `categoria`: filtro en backend (array-contains + fallback legacy).
  let localesResult: Local[];
  if (categoria) {
    const { locales } = await getLocalesForHomeFilter(categoria, incluirSuspendidos);
    localesResult = locales;
  } else {
    const { locales } = await getLocalesFromFirestore();
    localesResult = locales.slice().sort((a, b) => a.name.localeCompare(b.name, 'es'));
    if (!incluirSuspendidos) {
      localesResult = localesResult.filter((loc) => loc.status !== 'suspended');
    }
  }
  // Sanitizar logo y cover para que la home no reciba data URLs inválidos (evita ERR_INVALID_URL)
  localesResult = localesResult.map((loc) => {
    const logoRaw = typeof loc.logo === 'string' ? loc.logo : '';
    const coverRaw = typeof loc.cover === 'string' ? loc.cover : '';
    const logoNorm = logoRaw.startsWith('data:') ? normalizeDataUrl(logoRaw) : logoRaw;
    const coverNorm = coverRaw.startsWith('data:') ? normalizeDataUrl(coverRaw) : coverRaw;
    const logo = logoNorm && isValidImageUrl(logoNorm) ? logoNorm : '';
    const cover = coverNorm && isValidImageUrl(coverNorm) ? coverNorm : '';
    return { ...loc, logo, cover };
  });
  return { locales: localesResult };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const incluirSuspendidos = searchParams.get('incluirSuspendidos') === '1';
    const light = searchParams.get('light') === '1' || searchParams.get('light') === 'true';
    const rawCat = searchParams.get('categoria') ?? searchParams.get('category');
    const categoria = rawCat && DISCOVERY_CATEGORY_SET.has(rawCat) ? rawCat : null;

    const getCached = unstable_cache(
      () => fetchLocalesData(incluirSuspendidos, categoria),
      ['locales', incluirSuspendidos ? 'suspendidos' : 'activos', categoria ?? 'all'],
      { revalidate: CACHE_REVALIDATE, tags: ['locales'] }
    );
    const data = await getCached();

    const headers = new Headers();
    headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

    if (light) {
      // Respuesta ligera para Home y contexto: sin menús ni reviews.
      const localesLight = (data.locales as Local[]).map((loc) => ({
        id: loc.id,
        name: loc.name,
        logoUrl: loc.logo ?? '',
        estadoAbierto: loc.status !== 'suspended',
        type: Array.isArray(loc.type) ? loc.type : ['Restaurantes'],
        categorias:
          Array.isArray(loc.categorias) && loc.categorias.length > 0
            ? loc.categorias
            : Array.isArray(loc.type)
              ? loc.type
              : ['cafes'],
        status: loc.status,
        lat: typeof loc.lat === 'number' ? loc.lat : undefined,
        lng: typeof loc.lng === 'number' ? loc.lng : undefined,
        isFeatured: Boolean(loc.isFeatured ?? loc.destacado),
        time: String(loc.time ?? '20-35 min'),
        rating: Number(loc.rating ?? 0),
        reviews: Number(loc.reviews ?? 0),
        horarios:
          Array.isArray(loc.horarios) && !isHorariosHeavyForLight(loc.horarios) ? loc.horarios : undefined,
        cerradoHasta: loc.cerradoHasta != null ? String(loc.cerradoHasta) : undefined,
      }));
      return NextResponse.json({ locales: localesLight }, { headers });
    }

    return NextResponse.json(data, { headers });
  } catch (e) {
    console.error('GET /api/locales', e);
    return NextResponse.json({ error: 'Error al cargar locales' }, { status: 500 });
  }
}

/** POST /api/locales — Crear local (solo maestro). Para casos WhatsApp / registro manual. */
export async function POST(request: Request) {
  try {
    await requireAuth(request, ['maestro']);
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
  try {
    const body = await request.json();
    const parse = localPostSchema.safeParse(body);
    if (!parse.success) {
      const flat = parse.error.flatten().fieldErrors;
      const firstMessage = Object.values(flat).flat().find(Boolean) || 'Datos inválidos';
      return NextResponse.json({ error: String(firstMessage), fieldErrors: flat }, { status: 400 });
    }
    const bodyData = parse.data;
    const name = bodyData.name.trim();

    const existingIds = await getExistingLocalIdsFromFirestore();
    const baseSlug = slugify(name);
    const localId = ensureUniqueLocalId(baseSlug, existingIds);

    let programStartDate = '';
    try {
      const configSnap = await getAdminFirestore().collection('config').doc(CONFIG_DOC_ID).get();
      const d = configSnap.data();
      if (typeof d?.programStartDate === 'string') programStartDate = d.programStartDate;
    } catch {
      // ignorar
    }
    const commissionStartDate = getCommissionStartDate(programStartDate);
    const logoRaw = typeof bodyData.logo === 'string' ? bodyData.logo : '';
    const coverRaw = typeof bodyData.cover === 'string' ? bodyData.cover : '';
    const logo = logoRaw.startsWith('data:') ? normalizeDataUrl(logoRaw) : logoRaw;
    const cover = coverRaw.startsWith('data:') ? normalizeDataUrl(coverRaw) : coverRaw;

    const newLocal: Local = {
      id: localId,
      name,
      rating: 0,
      reviews: 0,
      time: typeof bodyData.time === 'string' && bodyData.time.trim() ? bodyData.time.trim() : '20-35 min',
      shipping: 1.5,
      type: ['Restaurantes'],
      categorias: ['cafes'],
      categoriasFromFirestore: true,
      distance: '—',
      destacado: false,
      isFeatured: false,
      featuredUntil: null,
      logo,
      cover,
      address: typeof bodyData.address === 'string' && bodyData.address.trim() ? bodyData.address.trim() : undefined,
      lat: typeof bodyData.lat === 'number' && !Number.isNaN(bodyData.lat) ? bodyData.lat : undefined,
      lng: typeof bodyData.lng === 'number' && !Number.isNaN(bodyData.lng) ? bodyData.lng : undefined,
      minOrder: 5,
      categories: ['Más pedidos'],
      ivaPermitidoMaestro: false,
      ivaEnabled: false,
      ownerName: typeof bodyData.ownerName === 'string' && bodyData.ownerName.trim() ? bodyData.ownerName.trim() : undefined,
      ownerPhone: typeof bodyData.ownerPhone === 'string' && bodyData.ownerPhone.trim() ? bodyData.ownerPhone.trim() : undefined,
      ownerEmail: typeof bodyData.ownerEmail === 'string' && bodyData.ownerEmail.trim() ? bodyData.ownerEmail.trim() : undefined,
      telefono: typeof bodyData.telefono === 'string' && bodyData.telefono.trim() ? bodyData.telefono.trim() : undefined,
      commissionStartDate,
    };

    const menuInicial: MenuItem[] = [];

    await setLocalInFirestore(localId, newLocal, menuInicial);

    return NextResponse.json({ ok: true, localId });
  } catch (e) {
    console.error('POST /api/locales', e);
    const message = e instanceof Error ? e.message : 'Error al crear local';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
