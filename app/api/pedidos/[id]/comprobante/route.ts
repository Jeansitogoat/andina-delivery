import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAuth } from '@/lib/api-auth';
import { normalizeDataUrl } from '@/lib/validImageUrl';
import { comprobantePostSchema } from '@/lib/schemas/comprobante';

/** POST /api/pedidos/[id]/comprobante → subir comprobante de transferencia (cliente). */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request, ['cliente', 'rider', 'maestro']);
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
  try {
    const { id } = await params;
    const body = await request.json();
    const parse = comprobantePostSchema.safeParse(body);
    if (!parse.success) {
      const flat = parse.error.flatten().fieldErrors;
      const firstMessage = Object.values(flat).flat().find(Boolean) || 'Datos inválidos';
      return NextResponse.json({ error: String(firstMessage), fieldErrors: flat }, { status: 400 });
    }
    const bodyData = parse.data;
    const db = getAdminFirestore();
    const ref = db.collection('pedidos').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }
    const comprobanteNormalized = bodyData.comprobanteBase64.startsWith('data:')
      ? normalizeDataUrl(bodyData.comprobanteBase64)
      : bodyData.comprobanteBase64;
    await ref.update({
      comprobanteBase64: comprobanteNormalized,
      comprobanteFileName: bodyData.fileName ?? null,
      comprobanteMimeType: bodyData.mimeType ?? null,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('POST /api/pedidos/[id]/comprobante', e);
    return NextResponse.json({ error: 'Error al subir comprobante' }, { status: 500 });
  }
}
