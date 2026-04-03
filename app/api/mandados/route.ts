import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/api-auth';
import { mandadoPostSchema } from '@/lib/schemas/mandado';
import { sanitizeForFirestore } from '@/lib/firestoreUtils';
import { haversineKm, getTarifaEnvioPorDistancia } from '@/lib/geo';
import { getTarifasEnvioTiersAdmin } from '@/lib/tarifas-config-server';
import { sendFCMToRole } from '@/lib/fcm-send-server';

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

  const tiers = await getTarifasEnvioTiersAdmin();
  const kmRaw = haversineKm(b.desdeLat, b.desdeLng, b.hastaLat, b.hastaLng);
  const distanciaKm = Math.round(kmRaw * 1000) / 1000;
  const tarifaEnvio = getTarifaEnvioPorDistancia(distanciaKm, tiers);
  const pagoRider = tarifaEnvio;
  const retencionCentral = 0;

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
      desdeLat: b.desdeLat,
      desdeLng: b.desdeLng,
      hastaLat: b.hastaLat,
      hastaLng: b.hastaLng,
      distanciaKm,
      tarifaEnvio,
      pagoRider,
      retencionCentral,
      estado: 'pendiente',
      riderId: null,
      riderNombre: null,
      timestamp: Date.now(),
      hora,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
  );

  void sendFCMToRole(
    'central',
    'Nuevo mandado',
    `${String(clienteNombre).slice(0, 40)}: ${b.descripcion.trim().slice(0, 80)}`,
    { tipo: 'mandado', mandadoId: ref.id }
  ).catch(() => {});

  return NextResponse.json({ id: ref.id });
}
