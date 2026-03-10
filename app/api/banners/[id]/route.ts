import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/api-auth';
import { sanitizeForFirestore } from '@/lib/firestoreUtils';
import { revalidatePath } from 'next/cache';
import { bannerPatchSchema } from '@/lib/schemas/banner';

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
    const body = await request.json();
    const parse = bannerPatchSchema.safeParse(body);
    if (!parse.success) {
      const flat = parse.error.flatten().fieldErrors;
      const firstMessage = Object.values(flat).flat().find(Boolean) || 'Datos inválidos';
      return NextResponse.json({ error: String(firstMessage), fieldErrors: flat }, { status: 400 });
    }
    const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    const data = parse.data;
    if (data.imageUrl !== undefined) updates.imageUrl = data.imageUrl.trim();
    if (data.alt !== undefined) updates.alt = data.alt.trim().slice(0, 200);
    if (data.linkType !== undefined) updates.linkType = data.linkType;
    if (data.linkValue !== undefined) updates.linkValue = data.linkValue.trim().slice(0, 500);
    if (data.order !== undefined) updates.order = data.order;
    if (data.active !== undefined) updates.active = data.active;

    const db = getAdminFirestore();
    const ref = db.collection('banners').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Banner no encontrado' }, { status: 404 });
    }
    await ref.update(sanitizeForFirestore(updates));
    revalidatePath('/');
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
    revalidatePath('/');
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/banners/[id]', e);
    return NextResponse.json({ error: 'Error al eliminar banner' }, { status: 500 });
  }
}
