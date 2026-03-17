import { NextResponse } from 'next/server';
import type { Local, MenuItem } from '@/lib/data';
import { requireAuth } from '@/lib/api-auth';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import {
  getExistingLocalIdsFromFirestore,
  setLocalInFirestore,
} from '@/lib/locales-firestore';
import { slugify, ensureUniqueLocalId } from '@/lib/slugify';
import { normalizeDataUrl } from '@/lib/validImageUrl';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request, ['maestro']);
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
  try {
    const { id } = await params;
    const db = getAdminFirestore();
    const solRef = db.collection('solicitudes').doc(id);
    const solSnap = await solRef.get();
    if (!solSnap.exists) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }
    const solData = solSnap.data() as Record<string, unknown>;
    const status = solData.status as string;
    if (status === 'approved') {
      return NextResponse.json({ error: 'Ya está aprobada', localId: solData.localId }, { status: 400 });
    }

    const sol = {
      nombreLocal: String(solData.nombreLocal ?? ''),
      tipoNegocio: String(solData.tipoNegocio ?? ''),
      logoBase64: solData.logoBase64 as string | undefined,
      bannerBase64: solData.bannerBase64 as string | undefined,
      direccion: String(solData.direccion ?? ''),
    };

    const existingIds = await getExistingLocalIdsFromFirestore();
    const baseSlug = slugify(sol.nombreLocal);
    const localId = ensureUniqueLocalId(baseSlug, existingIds);

    const tipoMap: Record<string, string[]> = {
      Restaurante: ['Restaurantes'],
      Café: ['Cafes', 'Restaurantes'],
      Cafe: ['Cafes', 'Restaurantes'],
      Market: ['Market'],
      Farmacia: ['Farmacias'],
      Otro: ['Restaurantes'],
    };
    const type = tipoMap[sol.tipoNegocio] ?? ['Restaurantes'];

    let programStartDate = '';
    try {
      const configSnap = await db.collection('config').doc('transferenciaAndina').get();
      const d = configSnap.data();
      if (typeof d?.programStartDate === 'string') programStartDate = d.programStartDate;
    } catch {
      // ignorar
    }
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const commissionStartDate = !programStartDate
      ? today
      : now.getTime() < new Date(programStartDate.slice(0, 10)).getTime()
        ? programStartDate.slice(0, 10)
        : today;

    const logoRaw = (solData.logoBase64 as string) || '/logos/rhk.png';
    const coverRaw = (solData.bannerBase64 as string) || '/food/food-pollo-brasa-mitad.png';
    const logo = logoRaw.startsWith('data:') ? normalizeDataUrl(logoRaw) : logoRaw;
    const cover = coverRaw.startsWith('data:') ? normalizeDataUrl(coverRaw) : coverRaw;

    const newLocal: Local = {
      id: localId,
      name: String(solData.nombreLocal ?? ''),
      rating: 0,
      reviews: 0,
      time: '20-35 min',
      shipping: 1.5,
      type,
      distance: '—',
      destacado: false,
      isFeatured: false,
      featuredUntil: null,
      logo,
      cover,
      address: String(solData.direccion ?? ''),
      minOrder: 5,
      categories: ['Más pedidos'],
      commissionStartDate,
    };

    const menuInicial: MenuItem[] = [];

    await setLocalInFirestore(localId, newLocal, menuInicial);

    await solRef.update({
      status: 'approved',
      localId,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true, localId });
  } catch (e) {
    console.error('POST /api/solicitudes/[id]/aprobar', e);
    return NextResponse.json({ error: 'Error al aprobar' }, { status: 500 });
  }
}
