import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/api-auth';

const DOC_ID = 'transferenciaAndina';

/** GET /api/config/transferencia → maestro: full; local/central: cuenta, banco, whatsappAdmin para panel */
export async function GET(request: Request) {
  let auth: { uid: string; rol: string };
  try {
    auth = await requireAuth(request, ['maestro', 'local', 'central']);
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
  try {
    const db = getAdminFirestore();
    const snap = await db.collection('config').doc(DOC_ID).get();
    const data = snap.exists ? snap.data() ?? {} : {};
    const full = {
      cuenta: data.cuenta ?? '',
      banco: data.banco ?? '',
      qr: data.qr ?? '',
      whatsappAdmin: data.whatsappAdmin ?? '',
      cycleDays: typeof data.cycleDays === 'number' ? data.cycleDays : 15,
      programStartDate: typeof data.programStartDate === 'string' ? data.programStartDate : '',
    };
    if (auth.rol === 'maestro') {
      return NextResponse.json(full);
    }
    return NextResponse.json({
      cuenta: full.cuenta,
      banco: full.banco,
      whatsappAdmin: full.whatsappAdmin,
    });
  } catch (e) {
    console.error('GET /api/config/transferencia', e);
    return NextResponse.json({ error: 'Error al cargar config' }, { status: 500 });
  }
}

/** PATCH /api/config/transferencia → actualizar config (solo maestro) */
export async function PATCH(request: Request) {
  try {
    await requireAuth(request, ['maestro']);
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
  try {
    const body = await request.json() as {
      cuenta?: string;
      banco?: string;
      qr?: string;
      whatsappAdmin?: string;
      cycleDays?: number;
      programStartDate?: string;
    };
    const db = getAdminFirestore();
    const updates: Record<string, string | number> = {};
    if (body.cuenta !== undefined) updates.cuenta = String(body.cuenta).trim();
    if (body.banco !== undefined) updates.banco = String(body.banco).trim();
    if (body.qr !== undefined) updates.qr = String(body.qr).trim();
    if (body.whatsappAdmin !== undefined) updates.whatsappAdmin = String(body.whatsappAdmin).trim();
    if (typeof body.cycleDays === 'number' && [7, 15, 30].includes(body.cycleDays)) {
      updates.cycleDays = body.cycleDays;
    }
    if (typeof body.programStartDate === 'string') {
      updates.programStartDate = body.programStartDate.trim();
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: true });
    }

    await db.collection('config').doc(DOC_ID).set(
      { ...updates, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('PATCH /api/config/transferencia', e);
    return NextResponse.json({ error: 'Error al guardar config' }, { status: 500 });
  }
}
