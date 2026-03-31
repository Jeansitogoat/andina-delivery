import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAuth } from '@/lib/api-auth';
import { getAdminFirestore } from '@/lib/firebase-admin';
import type { UserRole } from '@/lib/useAuth';
import { sanitizeForFirestore } from '@/lib/firestoreUtils';
import { fcmRegisterSchema } from '@/lib/schemas/fcmRegister';

const FCM_TOKENS_COLLECTION = 'fcm_tokens';

function stringArraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export async function POST(request: Request) {
  let auth: { uid: string; rol: UserRole; localId: string | null };
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

    if (roleStr === 'local' && auth.rol !== 'local') {
      return NextResponse.json(
        { error: 'Solo cuentas de restaurante pueden registrar notificaciones de local' },
        { status: 403 }
      );
    }

    // Anti-spoofing: si el cliente envía uid, debe coincidir exactamente con el del JWT
    if (bodyUid && bodyUid.trim() !== auth.uid) {
      console.warn('[FCM] Intento de registrar token con uid ajeno:', { claim: auth.uid, bodyUid });
      return NextResponse.json({ error: 'uid no coincide con el usuario autenticado' }, { status: 403 });
    }

    const db = getAdminFirestore();
    /**
     * Para local: hace falta persistir `localId` en fcm_tokens porque sendFCMToRestaurantByLocalId
     * filtra con where('localId','==', pedido.localId). Si users.localId está vacío (datos viejos)
     * pero el panel envía el id del restaurante y el usuario es rol local, usamos ese valor;
     * si ambos existen deben coincidir (anti-spoofing).
     */
    let localId: string | null = null;
    if (roleStr === 'local') {
      const userSnap = await db.collection('users').doc(auth.uid).get();
      const userData = userSnap.data();
      const fromDb =
        typeof userData?.localId === 'string' && userData.localId.trim() ? userData.localId.trim() : null;
      const fromClaim =
        typeof auth.localId === 'string' && auth.localId.trim() ? auth.localId.trim() : null;
      const trustedLocalId = fromDb || fromClaim;
      const candidateLocalId = typeof bodyLocalId === 'string' && bodyLocalId.trim() ? bodyLocalId.trim() : null;
      if (candidateLocalId && trustedLocalId && candidateLocalId !== trustedLocalId) {
        console.warn('[FCM] Intento de registrar token con localId ajeno:', {
          uid: auth.uid,
          candidate: candidateLocalId,
          trusted: trustedLocalId,
        });
        return NextResponse.json({ error: 'localId no coincide con el usuario autenticado' }, { status: 403 });
      }
      if (trustedLocalId) {
        localId = trustedLocalId;
      } else if (candidateLocalId) {
        localId = candidateLocalId;
        console.warn('[FCM] Register: sin localId en perfil/JWT; usando localId del cliente para', auth.uid);
      } else {
        localId = null;
      }
      if (!localId) {
        return NextResponse.json(
          {
            error:
              'Tu cuenta de restaurante no tiene un local asignado en el sistema. Contacta a soporte o vuelve a iniciar sesión desde el enlace de tu local.',
          },
          { status: 400 }
        );
      }
    }

    const docId = `${auth.uid}_${roleStr}`;
    const ref = db.collection(FCM_TOKENS_COLLECTION).doc(docId);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const prev = snap.data() as
        | { tokens?: unknown; token?: unknown; localId?: unknown }
        | undefined;
      const previousTokens = Array.isArray(prev?.tokens)
        ? (prev?.tokens as unknown[]).filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
        : [];
      // Compat legacy: si todavía existe `token` en docs viejos, lo absorbemos al array.
      const legacyToken = typeof prev?.token === 'string' && prev.token.trim() ? prev.token.trim() : null;
      const base = legacyToken ? [...previousTokens, legacyToken] : previousTokens;
      // Token actual al final para mantener los más recientes.
      const dedup = base.filter((t) => t !== trimmedToken);
      const nextTokens = [...dedup, trimmedToken].slice(-10);

      const prevLocalId = typeof prev?.localId === 'string' && prev.localId.trim() ? prev.localId.trim() : null;
      const targetLocalId = roleStr === 'local' && localId ? localId.trim() : null;
      const localIdSinCambio =
        roleStr !== 'local' || (targetLocalId ?? null) === (prevLocalId ?? null);

      if (
        snap.exists &&
        !legacyToken &&
        stringArraysEqual(nextTokens, previousTokens) &&
        localIdSinCambio
      ) {
        return;
      }

      const docData: Record<string, unknown> = {
        tokens: nextTokens,
        role: roleStr,
        uid: auth.uid,
        updatedAt: FieldValue.serverTimestamp(),
        token: FieldValue.delete(),
      };
      if (roleStr === 'local' && localId) docData.localId = localId;
      tx.set(ref, sanitizeForFirestore(docData), { merge: true });
    });
    console.log('[FCM] Token registered', docId, roleStr === 'local' && localId ? `localId=${localId}` : '');
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('POST /api/fcm/register error interno:', e);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
