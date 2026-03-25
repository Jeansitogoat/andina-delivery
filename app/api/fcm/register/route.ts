import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAuth } from '@/lib/api-auth';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { sanitizeForFirestore } from '@/lib/firestoreUtils';
import { fcmRegisterSchema } from '@/lib/schemas/fcmRegister';

const FCM_TOKENS_COLLECTION = 'fcm_tokens';

export async function POST(request: Request) {
  let auth: { uid: string };
  try {
    auth = await requireAuth(request, ['central', 'rider', 'local', 'maestro', 'cliente']);
  } catch (e) {
    const err = e as unknown;
    if (err instanceof Response) return err;
    throw err;
  }
  try {
    const body = await request.json();

    // Log de caja negra: ayuda a diagnosticar qué campo llega vacío en dispositivos nuevos (Vercel logs)
    console.log('[FCM] DEBUG Register payload:', {
      tokenTrunc: typeof body?.token === 'string' && body.token.length > 0
        ? body.token.slice(0, 10) + '...'
        : '(vacío o ausente)',
      role: body?.role ?? '(ausente)',
      localId: body?.localId ?? '(no enviado)',
      uid: auth.uid,
    });

    const parseResult = fcmRegisterSchema.safeParse(body);
    if (!parseResult.success) {
      const fieldErrors = parseResult.error.flatten().fieldErrors;
      console.error('[FCM] Register validación Zod fallida:', JSON.stringify(fieldErrors));
      const firstMsg = Object.values(fieldErrors).flat()[0] ?? 'Datos inválidos';
      return NextResponse.json({ error: firstMsg, fieldErrors }, { status: 400 });
    }
    const { token: rawToken, role: roleStr, uid: bodyUid, localId: bodyLocalId } = parseResult.data;
    const trimmedToken = rawToken.trim();

    // Anti-spoofing: si el cliente envía uid, debe coincidir exactamente con el del JWT
    if (bodyUid && bodyUid.trim() !== auth.uid) {
      console.warn('[FCM] Intento de registrar token con uid ajeno:', { claim: auth.uid, bodyUid });
      return NextResponse.json({ error: 'uid no coincide con el usuario autenticado' }, { status: 403 });
    }

    const db = getAdminFirestore();
    // Para local: el localId siempre se toma de la identidad autenticada (Firestore), nunca del body sin validar
    let localId: string | null = null;
    if (roleStr === 'local') {
      const userSnap = await db.collection('users').doc(auth.uid).get();
      const trustedLocalId = userSnap.data()?.localId ?? null;
      // Si el body trae localId, debe coincidir con el del usuario autenticado
      const candidateLocalId = typeof bodyLocalId === 'string' && bodyLocalId.trim() ? bodyLocalId.trim() : null;
      if (candidateLocalId && trustedLocalId && candidateLocalId !== trustedLocalId) {
        console.warn('[FCM] Intento de registrar token con localId ajeno:', { uid: auth.uid, candidate: candidateLocalId, trusted: trustedLocalId });
        return NextResponse.json({ error: 'localId no coincide con el usuario autenticado' }, { status: 403 });
      }
      localId = trustedLocalId;
    }

    const docId = `${auth.uid}_${roleStr}`;
    const docData: Record<string, unknown> = {
      token: trimmedToken,
      role: roleStr,       // campo 'role' para compatibilidad con queries existentes
      uid: auth.uid,
      lastUpdated: FieldValue.serverTimestamp(),
    };
    if (roleStr === 'local' && localId) docData.localId = localId;
    await db.collection(FCM_TOKENS_COLLECTION).doc(docId).set(sanitizeForFirestore(docData), { merge: true });
    console.log('[FCM] Token registered', docId, roleStr === 'local' && localId ? `localId=${localId}` : '');
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('POST /api/fcm/register error interno:', e);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
