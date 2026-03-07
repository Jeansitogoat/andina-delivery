import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';

export const dynamic = 'force-dynamic';
import type { Local, MenuItem } from '@/lib/data';
import { getLocalesFromFirestore, getExistingLocalIdsFromFirestore, setLocalInFirestore } from '@/lib/locales-firestore';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/api-auth';
import { slugify, ensureUniqueLocalId } from '@/lib/slugify';
import { normalizeDataUrl, isValidImageUrl } from '@/lib/validImageUrl';

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

async function fetchLocalesData(incluirSuspendidos: boolean) {
  const { locales, menus } = await getLocalesFromFirestore();
  const reviews: Record<string, import('@/lib/data').Review[]> = {};
  let localesResult = locales.map((loc) => loc).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  if (!incluirSuspendidos) {
    localesResult = localesResult.filter((loc) => loc.status !== 'suspended');
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
  return { locales: localesResult, menus, reviews };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const incluirSuspendidos = searchParams.get('incluirSuspendidos') === '1';

    const getCached = unstable_cache(
      () => fetchLocalesData(incluirSuspendidos),
      ['locales', incluirSuspendidos ? 'suspendidos' : 'activos'],
      { revalidate: CACHE_REVALIDATE, tags: ['locales'] }
    );
    const data = await getCached();

    const headers = new Headers();
    headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
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
    const body = (await request.json()) as {
      name?: string;
      address?: string;
      telefono?: string;
      time?: string;
      logo?: string;
      cover?: string;
      ownerName?: string;
      ownerPhone?: string;
      ownerEmail?: string;
      lat?: number;
      lng?: number;
    };
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return NextResponse.json({ error: 'name es obligatorio' }, { status: 400 });
    }

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
    const logoRaw = typeof body.logo === 'string' ? body.logo : '';
    const coverRaw = typeof body.cover === 'string' ? body.cover : '';
    const logo = logoRaw.startsWith('data:') ? normalizeDataUrl(logoRaw) : logoRaw;
    const cover = coverRaw.startsWith('data:') ? normalizeDataUrl(coverRaw) : coverRaw;

    const newLocal: Local = {
      id: localId,
      name,
      rating: 4.5,
      reviews: 0,
      time: typeof body.time === 'string' && body.time.trim() ? body.time.trim() : '20-35 min',
      shipping: 1.5,
      type: ['Restaurantes'],
      distance: '—',
      destacado: false,
      logo,
      cover,
      address: typeof body.address === 'string' && body.address.trim() ? body.address.trim() : undefined,
      lat: typeof body.lat === 'number' && !Number.isNaN(body.lat) ? body.lat : undefined,
      lng: typeof body.lng === 'number' && !Number.isNaN(body.lng) ? body.lng : undefined,
      minOrder: 5,
      categories: ['Más pedidos'],
      ownerName: typeof body.ownerName === 'string' && body.ownerName.trim() ? body.ownerName.trim() : undefined,
      ownerPhone: typeof body.ownerPhone === 'string' && body.ownerPhone.trim() ? body.ownerPhone.trim() : undefined,
      ownerEmail: typeof body.ownerEmail === 'string' && body.ownerEmail.trim() ? body.ownerEmail.trim() : undefined,
      telefono: typeof body.telefono === 'string' && body.telefono.trim() ? body.telefono.trim() : undefined,
      commissionStartDate,
    };

    const menuInicial: MenuItem[] = [
      {
        id: `${localId}-1`,
        name: 'Menú (próximamente)',
        price: 0,
        description: 'El negocio cargará su menú desde el panel.',
        category: 'Más pedidos',
      },
    ];

    await setLocalInFirestore(localId, newLocal, menuInicial);

    return NextResponse.json({ ok: true, localId });
  } catch (e) {
    console.error('POST /api/locales', e);
    const message = e instanceof Error ? e.message : 'Error al crear local';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
