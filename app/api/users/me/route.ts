import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAuth } from '@/lib/api-auth';
import { getAdminFirestore, getAdminAuth } from '@/lib/firebase-admin';
import { userMePatchSchema } from '@/lib/schemas/userMePatch';

/**
 * PATCH /api/users/me — actualiza perfil del usuario autenticado en `users/{uid}` con `updatedAt`.
 * También sincroniza `displayName` en Firebase Auth (admin).
 */
export async function PATCH(request: Request) {
  let auth: { uid: string; rol: string; localId: string | null };
  try {
    auth = await requireAuth(request, ['cliente', 'rider', 'central', 'local', 'maestro']);
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }

  try {
    const body = await request.json();
    const parse = userMePatchSchema.safeParse(body);
    if (!parse.success) {
      const flat = parse.error.flatten().fieldErrors;
      const firstMessage = Object.values(flat).flat().find(Boolean) || 'Datos inválidos';
      return NextResponse.json({ error: String(firstMessage), fieldErrors: flat }, { status: 400 });
    }
    const { displayName, telefono } = parse.data;

    if (displayName === undefined && telefono === undefined) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const ref = db.collection('users').doc(auth.uid);
    const payload: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (displayName !== undefined) payload.displayName = displayName.trim();
    if (telefono !== undefined) payload.telefono = telefono ?? null;

    await ref.set(payload, { merge: true });

    if (displayName !== undefined) {
      try {
        await getAdminAuth().updateUser(auth.uid, { displayName: displayName.trim() });
      } catch (e) {
        console.error('[PATCH /api/users/me] updateUser displayName', e);
        // Firestore ya guardó; no fallar la petición si Auth falla.
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('PATCH /api/users/me', e);
    return NextResponse.json({ error: 'Error al actualizar perfil' }, { status: 500 });
  }
}
