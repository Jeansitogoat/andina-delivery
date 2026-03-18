import { NextResponse } from 'next/server';
import type { Solicitud } from '@/lib/socios-types';
import { requireAuth } from '@/lib/api-auth';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { solicitudPostSchema } from '@/lib/schemas/solicitudPost';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';

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
    // Fase 1: incluir campos URL
    logoUrl: data.logoUrl as string | undefined,
    bannerUrl: data.bannerUrl as string | undefined,
    menuFotosUrls: data.menuFotosUrls as string[] | undefined,
    // Legacy
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
    const { searchParams } = new URL(request.url);
    const limitParam = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 100);
    const cursor = searchParams.get('cursor') || null;

    const db = getAdminFirestore();
    let query = db
      .collection(SOLICITUDES_COLLECTION)
      .orderBy('createdAt', 'desc')
      .limit(limitParam);

    if (cursor) {
      const cursorSnap = await db.collection(SOLICITUDES_COLLECTION).doc(cursor).get();
      if (cursorSnap.exists) query = query.startAfter(cursorSnap);
    }

    const snap = await query.get();
    const list: Solicitud[] = snap.docs.map((d) => toSolicitud(d.data() as Record<string, unknown>, d.id));
    const nextCursor = snap.docs.length === limitParam ? snap.docs[snap.docs.length - 1].id : null;
    return NextResponse.json({ solicitudes: list, nextCursor });
  } catch (e) {
    console.error('GET /api/solicitudes', e);
    return NextResponse.json({ error: 'Error al leer solicitudes' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const { ok } = checkRateLimit(ip, 'solicitudes');
    if (!ok) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes. Intenta en unos minutos.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parse = solicitudPostSchema.safeParse(body);
    if (!parse.success) {
      const flat = parse.error.flatten().fieldErrors;
      const firstMessage = Object.values(flat).flat().find(Boolean) || 'Datos inválidos';
      return NextResponse.json(
        { error: String(firstMessage), fieldErrors: flat },
        { status: 400 }
      );
    }
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
      // Fase 1: URLs de Storage (preferido)
      logoUrl,
      bannerUrl,
      menuFotosUrls,
      // Legacy Base64 (compatibilidad con clientes antiguos)
      logoBase64,
      bannerBase64,
      menuFotosBase64,
    } = parse.data;

    const solicitud: Solicitud = {
      id: generateId(),
      status: 'pending',
      createdAt: new Date().toISOString(),
      nombreLocal: nombreLocal.trim(),
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      email: email.trim(),
      telefono: telefono.trim(),
      telefonoLocal: telefonoLocal.trim(),
      direccion: direccion.trim(),
      tipoNegocio: tipoNegocio,
      localACalle: Boolean(localACalle),
      // Preferir URLs de Storage; fallback a Base64 legacy
      logoBase64: logoUrl ? undefined : (logoBase64 ?? undefined),
      bannerBase64: bannerUrl ? undefined : (bannerBase64 ?? undefined),
      menuFotosBase64: menuFotosUrls?.length ? undefined : (Array.isArray(menuFotosBase64) ? menuFotosBase64 : undefined),
    };

    const db = getAdminFirestore();
    // Construir el documento excluyendo campos undefined para Firestore
    const docPayload: Record<string, unknown> = { ...solicitud, updatedAt: FieldValue.serverTimestamp() };
    // Agregar campos URL si los hay
    if (logoUrl) docPayload.logoUrl = logoUrl;
    if (bannerUrl) docPayload.bannerUrl = bannerUrl;
    if (menuFotosUrls?.length) docPayload.menuFotosUrls = menuFotosUrls.filter(Boolean);
    // Eliminar campos undefined
    Object.keys(docPayload).forEach((k) => {
      if (docPayload[k] === undefined) delete docPayload[k];
    });
    await db.collection(SOLICITUDES_COLLECTION).doc(solicitud.id).set(docPayload);

    return NextResponse.json({ ok: true, id: solicitud.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error al crear solicitud';
    console.error('POST /api/solicitudes', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
