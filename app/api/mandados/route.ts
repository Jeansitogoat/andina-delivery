import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/api-auth';
import { mandadoPostSchema } from '@/lib/schemas/mandado';
import { sanitizeForFirestore } from '@/lib/firestoreUtils';

/** POST /api/mandados — crea mandado (solo cliente). Escritura vía Admin SDK. */
export async function POST(request: Request) {
  let auth: { uid: string; rol: string };
  try {
    auth = await requireAuth(request, ['cliente']);
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }

  let bodyRaw: unknown;
  try {
    bodyRaw = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const parsed = mandadoPostSchema.safeParse(bodyRaw);
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors;
    const msg = Object.values(first).flat()[0] ?? 'Datos inválidos';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  const b = parsed.data;

  const db = getAdminFirestore();
  const userSnap = await db.collection('users').doc(auth.uid).get();
  const u = userSnap.data();
  const clienteNombre =
    (typeof u?.displayName === 'string' && u.displayName.trim()) ||
    (typeof u?.email === 'string' ? u.email.split('@')[0] : '') ||
    'Cliente';

  const ref = db.collection('mandados').doc();
  const hora = new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });

  await ref.set(
    sanitizeForFirestore({
      clienteId: auth.uid,
      clienteNombre: String(clienteNombre).slice(0, 120),
      clienteTelefono:
        b.clienteTelefono?.trim() || (typeof u?.telefono === 'string' ? u.telefono : '') || '',
      categoria: (b.categoria || '').slice(0, 80),
      descripcion: b.descripcion.trim(),
      desdeTexto: b.desdeTexto.trim(),
      hastaTexto: b.hastaTexto.trim(),
      desdeLat: typeof b.desdeLat === 'number' ? b.desdeLat : null,
      desdeLng: typeof b.desdeLng === 'number' ? b.desdeLng : null,
      hastaLat: typeof b.hastaLat === 'number' ? b.hastaLat : null,
      hastaLng: typeof b.hastaLng === 'number' ? b.hastaLng : null,
      estado: 'pendiente',
      riderId: null,
      riderNombre: null,
      timestamp: Date.now(),
      hora,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
  );

  return NextResponse.json({ id: ref.id });
}
