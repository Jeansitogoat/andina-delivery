import { NextResponse } from 'next/server';
import type { Solicitud } from '@/lib/socios-types';
import { requireAuth } from '@/lib/api-auth';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const SOLICITUDES_COLLECTION = 'solicitudes';

function generateId(): string {
  return `sol-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function toSolicitud(data: Record<string, unknown>, id: string): Solicitud {
  return {
    id,
    status: (data.status as Solicitud['status']) ?? 'pending',
    createdAt: (data.createdAt as string) ?? '',
    nombreLocal: String(data.nombreLocal ?? ''),
    nombre: String(data.nombre ?? ''),
    apellido: String(data.apellido ?? ''),
    email: String(data.email ?? ''),
    telefono: String(data.telefono ?? ''),
    telefonoLocal: String(data.telefonoLocal ?? ''),
    direccion: String(data.direccion ?? ''),
    tipoNegocio: String(data.tipoNegocio ?? ''),
    localACalle: Boolean(data.localACalle),
    logoBase64: data.logoBase64 as string | undefined,
    bannerBase64: data.bannerBase64 as string | undefined,
    menuFotosBase64: data.menuFotosBase64 as string[] | undefined,
    localId: data.localId as string | undefined,
  };
}

export async function GET(request: Request) {
  try {
    await requireAuth(request, ['maestro']);
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
  try {
    const db = getAdminFirestore();
    const snap = await db.collection(SOLICITUDES_COLLECTION).orderBy('createdAt', 'desc').get();
    const list: Solicitud[] = snap.docs.map((d) => toSolicitud(d.data() as Record<string, unknown>, d.id));
    return NextResponse.json(list);
  } catch (e) {
    console.error('GET /api/solicitudes', e);
    return NextResponse.json({ error: 'Error al leer solicitudes' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      nombreLocal,
      nombre,
      apellido,
      email,
      telefono,
      telefonoLocal,
      direccion,
      tipoNegocio,
      localACalle,
      logoBase64,
      bannerBase64,
      menuFotosBase64,
    } = body;

    if (!nombreLocal?.trim() || !nombre?.trim() || !apellido?.trim() || !email?.trim() || !telefono?.trim() || !telefonoLocal?.trim() || !direccion?.trim() || !tipoNegocio) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios: nombreLocal, nombre, apellido, email, telefono, telefonoLocal, direccion, tipoNegocio' },
        { status: 400 }
      );
    }

    const solicitud: Solicitud = {
      id: generateId(),
      status: 'pending',
      createdAt: new Date().toISOString(),
      nombreLocal: String(nombreLocal).trim(),
      nombre: String(nombre).trim(),
      apellido: String(apellido).trim(),
      email: String(email).trim(),
      telefono: String(telefono).trim(),
      telefonoLocal: String(telefonoLocal).trim(),
      direccion: String(direccion).trim(),
      tipoNegocio: String(tipoNegocio),
      localACalle: Boolean(localACalle),
      logoBase64: logoBase64 ?? undefined,
      bannerBase64: bannerBase64 ?? undefined,
      menuFotosBase64: Array.isArray(menuFotosBase64) ? menuFotosBase64 : undefined,
    };

    const db = getAdminFirestore();
    await db.collection(SOLICITUDES_COLLECTION).doc(solicitud.id).set({
      ...solicitud,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true, id: solicitud.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error al crear solicitud';
    console.error('POST /api/solicitudes', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
