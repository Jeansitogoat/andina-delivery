import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/api-auth';
import { bannerPostSchema } from '@/lib/schemas/banner';

export type BannerLinkType = 'category' | 'route' | 'url';

export interface BannerDoc {
  imageUrl: string;
  alt: string;
  linkType: BannerLinkType;
  linkValue: string;
  order: number;
  active: boolean;
}

/** GET /api/banners → público: solo activos. GET /api/banners?admin=1 + Bearer maestro → todos */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const admin = searchParams.get('admin') === '1';

  let isMaestro = false;
  if (admin) {
    try {
      await requireAuth(request, ['maestro']);
      isMaestro = true;
    } catch (r) {
      if (r instanceof Response) return r;
      throw r;
    }
  }

  try {
    const db = getAdminFirestore();
    const coll = db.collection('banners');
    let intervalSeconds = 4;
    try {
      const configSnap = await db.collection('config').doc('carrusel').get();
      const n = configSnap.data()?.intervalSeconds;
      if (typeof n === 'number' && n >= 2 && n <= 60) intervalSeconds = Math.round(n);
    } catch {
      // ignorar, usar 4
    }
    let snap;
    try {
      const query = isMaestro
        ? coll.orderBy('order', 'asc')
        : coll.where('active', '==', true).orderBy('order', 'asc');
      snap = await query.get();
    } catch (indexErr: unknown) {
      const err = indexErr as { code?: number; details?: string; message?: string };
      const msg = typeof err.details === 'string' ? err.details : (typeof err.message === 'string' ? err.message : '');
      const needsIndex = err.code === 9 || msg.includes('index') || msg.includes('FAILED_PRECONDITION');
      if (needsIndex) {
        // Índice compuesto no desplegado: traer todos y filtrar/ordenar en memoria
        const all = await coll.get();
        const docs = all.docs
          .map((d) => ({ id: d.id, data: d.data() as BannerDoc }))
          .filter(({ data }) => isMaestro || data.active === true)
          .sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));
        const banners = docs.map(({ id, data }) => ({
          id,
          imageUrl: data.imageUrl ?? '',
          alt: data.alt ?? '',
          linkType: data.linkType ?? 'url',
          linkValue: data.linkValue ?? '',
          order: typeof data.order === 'number' ? data.order : 0,
          ...(isMaestro ? { active: !!data.active } : {}),
        }));
        return NextResponse.json({ banners, intervalSeconds });
      }
      throw indexErr;
    }
    const banners = snap.docs.map((d) => {
      const data = d.data() as BannerDoc;
      return {
        id: d.id,
        imageUrl: data.imageUrl ?? '',
        alt: data.alt ?? '',
        linkType: data.linkType ?? 'url',
        linkValue: data.linkValue ?? '',
        order: typeof data.order === 'number' ? data.order : 0,
        ...(isMaestro ? { active: !!data.active } : {}),
      };
    });
    return NextResponse.json({ banners, intervalSeconds });
  } catch (e) {
    console.error('GET /api/banners', e);
    return NextResponse.json({ banners: [], intervalSeconds: 4 });
  }
}

/** POST /api/banners → crear banner (solo maestro) */
export async function POST(request: Request) {
  try {
    await requireAuth(request, ['maestro']);
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
  try {
    const body = await request.json();
    const parse = bannerPostSchema.safeParse(body);
    if (!parse.success) {
      const flat = parse.error.flatten().fieldErrors;
      const firstMessage = Object.values(flat).flat().find(Boolean) || 'Datos inválidos';
      return NextResponse.json({ error: String(firstMessage), fieldErrors: flat }, { status: 400 });
    }
    const data = parse.data;
    const doc = {
      imageUrl: data.imageUrl.trim(),
      alt: (data.alt ?? '').trim().slice(0, 200),
      linkType: data.linkType ?? 'url',
      linkValue: (data.linkValue ?? '').trim().slice(0, 500),
      order: typeof data.order === 'number' ? data.order : 0,
      active: data.active !== false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    const db = getAdminFirestore();
    const ref = await db.collection('banners').add(doc);
    return NextResponse.json({ id: ref.id, ok: true });
  } catch (e) {
    console.error('POST /api/banners', e);
    return NextResponse.json({ error: 'Error al crear banner' }, { status: 500 });
  }
}
