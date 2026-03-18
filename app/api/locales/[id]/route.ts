import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getLocalFromFirestore, updateLocalInFirestore } from '@/lib/locales-firestore';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { normalizeDataUrl, isValidImageUrl } from '@/lib/validImageUrl';
import { revalidateTag, revalidatePath } from 'next/cache';
import { localPatchSchema } from '@/lib/schemas/localPatch';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const fromFirestore = await getLocalFromFirestore(id);
    if (!fromFirestore) {
      return NextResponse.json({ error: 'Local no encontrado' }, { status: 404 });
    }
    const { local, menu } = fromFirestore;
    const db = getAdminFirestore();
    let reviewsSnap;
    try {
      reviewsSnap = await db.collection('reviews').where('localId', '==', id).orderBy('createdAt', 'desc').limit(30).get();
    } catch {
      const raw = await db.collection('reviews').where('localId', '==', id).limit(30).get();
      const sorted = raw.docs.sort((a, b) => {
        const ta = a.data().createdAt;
        const tb = b.data().createdAt;
        const ma = ta?.toMillis?.() ?? (typeof ta === 'number' ? ta : 0);
        const mb = tb?.toMillis?.() ?? (typeof tb === 'number' ? tb : 0);
        return mb - ma;
      });
      reviewsSnap = { docs: sorted };
    }
    const reviews = reviewsSnap.docs.map((doc) => {
      const d = doc.data();
      return {
        author: d.author || 'Cliente',
        rating: typeof d.rating === 'number' ? d.rating : 5,
        comment: d.comment || '',
      };
    }) as import('@/lib/data').Review[];

    const localOut = { ...local };
    if (typeof localOut.logo === 'string' && localOut.logo.startsWith('data:')) {
      const normalized = normalizeDataUrl(localOut.logo);
      localOut.logo = isValidImageUrl(normalized) ? normalized : '';
    } else if (typeof localOut.logo === 'string' && !isValidImageUrl(localOut.logo)) {
      localOut.logo = '';
    }
    if (typeof localOut.cover === 'string' && localOut.cover.startsWith('data:')) {
      const normalized = normalizeDataUrl(localOut.cover);
      localOut.cover = isValidImageUrl(normalized) ? normalized : '';
    } else if (typeof localOut.cover === 'string' && !isValidImageUrl(localOut.cover)) {
      localOut.cover = '';
    }
    const menuOut = menu.map((item) => {
      const it = { ...item };
      if (typeof it.image === 'string' && it.image.startsWith('data:')) {
        const normalized = normalizeDataUrl(it.image);
        it.image = isValidImageUrl(normalized) ? normalized : '';
      } else if (typeof it.image === 'string' && !isValidImageUrl(it.image)) {
        it.image = '';
      }
      return it;
    });

    const headers = new Headers();
    headers.set('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=60');
    return NextResponse.json({ local: localOut, menu: menuOut, reviews }, { headers });
  } catch (e) {
    console.error('GET /api/locales/[id]', e);
    return NextResponse.json({ error: 'Error al cargar local' }, { status: 500 });
  }
}

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

    // Verificar que el usuario 'local' solo modifique su propio local
    if (auth.rol === 'local' && auth.localId !== id) {
      return NextResponse.json({ error: 'No autorizado para modificar este local' }, { status: 403 });
    }
    const body = await request.json();
    const parse = localPatchSchema.safeParse(body);
    if (!parse.success) {
      const flat = parse.error.flatten().fieldErrors;
      const firstMessage = Object.values(flat).flat().find(Boolean) || 'Datos inválidos';
      return NextResponse.json({ error: String(firstMessage), fieldErrors: flat }, { status: 400 });
    }
    const bodyData = parse.data;
    const transferencia = bodyData.transferencia;
    const status = bodyData.status;
    const name = bodyData.name;
    const address = bodyData.address;
    const telefono = bodyData.telefono;
    const time = bodyData.time;
    const shipping = bodyData.shipping;
    const logo = bodyData.logo;
    const cover = bodyData.cover;
    const horarios = bodyData.horarios;
    const cerradoHasta = bodyData.cerradoHasta;
    const categories = bodyData.categories;
    const lat = bodyData.lat;
    const lng = bodyData.lng;
    const isFeatured = bodyData.isFeatured;

    const fromFirestore = await getLocalFromFirestore(id);
    if (!fromFirestore) {
      return NextResponse.json({ error: 'Local no encontrado' }, { status: 404 });
    }
    const updates: Parameters<typeof updateLocalInFirestore>[1] = {};
    if (name !== undefined) updates.name = name;
    if (address !== undefined) updates.address = address;
    if (telefono !== undefined) updates.telefono = telefono;
    if (status !== undefined) updates.status = status;
    if (time !== undefined) updates.time = time;
    if (shipping !== undefined) updates.shipping = shipping;
    if (logo !== undefined) updates.logo = logo.startsWith('data:') ? normalizeDataUrl(logo) : logo;
    if (cover !== undefined) updates.cover = cover.startsWith('data:') ? normalizeDataUrl(cover) : cover;
    if (horarios !== undefined && Array.isArray(horarios)) updates.horarios = horarios;
    if (cerradoHasta !== undefined) updates.cerradoHasta = cerradoHasta === '' ? undefined : cerradoHasta;
    if (categories !== undefined && Array.isArray(categories)) updates.categories = categories;
    if (lat !== undefined) updates.lat = lat;
    if (lng !== undefined) updates.lng = lng;
    if (isFeatured !== undefined) (updates as any).isFeatured = Boolean(isFeatured);
    if (transferencia !== undefined) {
      updates.transferencia =
        transferencia === null
          ? undefined
          : {
              numeroCuenta: transferencia.numeroCuenta ?? '',
              cooperativa: transferencia.cooperativa ?? '',
              titular: transferencia.titular,
              tipoCuenta: transferencia.tipoCuenta,
              // Fase 1: guardar URL de Storage preferentemente; legacy Base64 para compatibilidad
              codigoUrl: (transferencia as { codigoUrl?: string }).codigoUrl,
              codigoBase64: !(transferencia as { codigoUrl?: string }).codigoUrl
                ? transferencia.codigoBase64
                : undefined,
              codigoMimeType: transferencia.codigoMimeType,
            };
    }
    if (Object.keys(updates).length > 0) {
      await updateLocalInFirestore(id, updates);
    }

    revalidatePath(`/restaurante/${id}`);
    revalidatePath(`/panel/restaurante/${id}`);
    revalidatePath('/');
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('PATCH /api/locales/[id]', e);
    return NextResponse.json({ error: 'Error al actualizar local' }, { status: 500 });
  }
}

/** DELETE /api/locales/[id] → eliminar local (solo maestro). Solo Firestore. */
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
    const db = getAdminFirestore();
    const ref = db.collection('locales').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Local no encontrado' }, { status: 404 });
    }
    await ref.delete();
    revalidateTag('locales');
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/locales/[id]', e);
    return NextResponse.json({ error: 'Error al eliminar local' }, { status: 500 });
  }
}
