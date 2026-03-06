import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import type { MenuItem } from '@/lib/data';
import { requireAuth } from '@/lib/api-auth';
import { getLocalFromFirestore, setMenuInFirestore } from '@/lib/locales-firestore';
import { normalizeDataUrl, isValidImageUrl } from '@/lib/validImageUrl';

/** PATCH /api/locales/[id]/menu → guarda el menú completo del local (solo Firestore). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request, ['local', 'maestro']);
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
  try {
    const { id } = await params;
    const body = (await request.json()) as { items: MenuItem[] };

    if (!Array.isArray(body.items)) {
      return NextResponse.json({ error: 'items requerido (array)' }, { status: 400 });
    }

    const fromFirestore = await getLocalFromFirestore(id);
    if (!fromFirestore) {
      return NextResponse.json({ error: 'Local no encontrado' }, { status: 404 });
    }
    const items: MenuItem[] = body.items.map((item) => {
      const it = { ...item };
      if (typeof it.image === 'string' && it.image.startsWith('data:')) {
        const normalized = normalizeDataUrl(it.image);
        it.image = isValidImageUrl(normalized) ? normalized : '';
      } else if (typeof it.image === 'string' && !isValidImageUrl(it.image)) {
        it.image = '';
      }
      return it;
    });
    await setMenuInFirestore(id, items);

    revalidatePath(`/restaurante/${id}`);
    revalidatePath(`/api/locales/${id}`);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('PATCH /api/locales/[id]/menu', e);
    return NextResponse.json({ error: 'Error al guardar menú' }, { status: 500 });
  }
}
