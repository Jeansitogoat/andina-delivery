import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import type { MenuItem } from '@/lib/data';
import { requireAuth } from '@/lib/api-auth';
import { getLocalFromFirestore, setMenuInFirestore } from '@/lib/locales-firestore';
import { normalizeDataUrl, isValidImageUrl } from '@/lib/validImageUrl';
import { menuPatchSchema } from '@/lib/schemas/menuPatch';

/** PATCH /api/locales/[id]/menu → guarda el menú completo del local (solo Firestore). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let auth: { uid: string; rol: string; localId: string | null };
  try {
    auth = await requireAuth(request, ['local', 'maestro']);
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
  try {
    const { id } = await params;

    // Verificar que el usuario 'local' solo modifique el menú de su propio local
    if (auth.rol === 'local' && auth.localId !== id) {
      return NextResponse.json({ error: 'No autorizado para modificar el menú de este local' }, { status: 403 });
    }
    const body = await request.json();
    const parse = menuPatchSchema.safeParse(body);
    if (!parse.success) {
      const flat = parse.error.flatten().fieldErrors;
      const firstMessage = Object.values(flat).flat().find(Boolean) || 'Datos inválidos';
      return NextResponse.json({ error: String(firstMessage), fieldErrors: flat }, { status: 400 });
    }
    const itemsRaw = parse.data.items;

    const fromFirestore = await getLocalFromFirestore(id);
    if (!fromFirestore) {
      return NextResponse.json({ error: 'Local no encontrado' }, { status: 404 });
    }
    const items: MenuItem[] = itemsRaw.map((item) => {
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
