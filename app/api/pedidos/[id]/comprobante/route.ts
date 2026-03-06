import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAuth } from '@/lib/api-auth';
import { normalizeDataUrl } from '@/lib/validImageUrl';

/** POST /api/pedidos/[id]/comprobante → subir comprobante de transferencia (cliente). */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request, ['cliente', 'maestro']);
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
  try {
    const { id } = await params;
    const body = await request.json() as {
      comprobanteBase64: string;
      fileName?: string;
      mimeType?: string;
    };
    if (!body.comprobanteBase64 || typeof body.comprobanteBase64 !== 'string') {
      return NextResponse.json({ error: 'comprobanteBase64 requerido' }, { status: 400 });
    }
    const db = getAdminFirestore();
    const ref = db.collection('pedidos').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }
    const comprobanteNormalized = body.comprobanteBase64.startsWith('data:')
      ? normalizeDataUrl(body.comprobanteBase64)
      : body.comprobanteBase64;
    await ref.update({
      comprobanteBase64: comprobanteNormalized,
      comprobanteFileName: body.fileName ?? null,
      comprobanteMimeType: body.mimeType ?? null,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('POST /api/pedidos/[id]/comprobante', e);
    return NextResponse.json({ error: 'Error al subir comprobante' }, { status: 500 });
  }
}
