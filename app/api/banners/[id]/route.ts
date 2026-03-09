import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/api-auth';
import { sanitizeForFirestore } from '@/lib/firestoreUtils';

type BannerLinkType = 'category' | 'route' | 'url';

/** PATCH /api/banners/[id] → actualizar banner (solo maestro) */
export async function PATCH(
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
    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }
    const body = await request.json() as {
      imageUrl?: string;
      alt?: string;
      linkType?: BannerLinkType;
      linkValue?: string;
      order?: number;
      active?: boolean;
    };
    const db = getAdminFirestore();
    const ref = db.collection('banners').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Banner no encontrado' }, { status: 404 });
    }
    const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (typeof body.imageUrl === 'string') updates.imageUrl = body.imageUrl.trim();
    if (typeof body.alt === 'string') updates.alt = body.alt.trim().slice(0, 200);
    if (['category', 'route', 'url'].includes(body.linkType ?? '')) updates.linkType = body.linkType;
    if (typeof body.linkValue === 'string') updates.linkValue = body.linkValue.trim().slice(0, 500);
    if (typeof body.order === 'number') updates.order = body.order;
    if (typeof body.active === 'boolean') updates.active = body.active;

    await ref.update(sanitizeForFirestore(updates));
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('PATCH /api/banners/[id]', e);
    return NextResponse.json({ error: 'Error al actualizar banner' }, { status: 500 });
  }
}

/** DELETE /api/banners/[id] → eliminar banner (solo maestro) */
export async function DELETE(
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
    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }
    const db = getAdminFirestore();
    const ref = db.collection('banners').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Banner no encontrado' }, { status: 404 });
    }
    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/banners/[id]', e);
    return NextResponse.json({ error: 'Error al eliminar banner' }, { status: 500 });
  }
}
