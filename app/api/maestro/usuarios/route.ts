import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/api-auth';
import type { UserRole } from '@/lib/useAuth';
import { FieldValue } from 'firebase-admin/firestore';

/** POST /api/maestro/usuarios — Crear usuario (central o local). Solo maestro. */
export async function POST(request: Request) {
  try {
    await requireAuth(request, ['maestro']);
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
  try {
    const body = await request.json();
    const { email, password, rol, displayName, localId } = body as {
      email?: string;
      password?: string;
      rol?: string;
      displayName?: string;
      localId?: string;
    };
    if (!email || typeof email !== 'string' || !email.trim()) {
      return NextResponse.json({ error: 'email requerido' }, { status: 400 });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: 'password mínimo 6 caracteres' }, { status: 400 });
    }
    const role = rol === 'central' || rol === 'local' ? rol : 'local';
    const auth = getAdminAuth();
    const db = getAdminFirestore();

    const userRecord = await auth.createUser({
      email: email.trim(),
      password,
      displayName: displayName?.trim() || undefined,
    });

    const docData = {
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: displayName?.trim() || userRecord.displayName || null,
      rol: role as UserRole,
      localId: role === 'local' && localId ? String(localId).trim() : null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    await db.collection('users').doc(userRecord.uid).set(docData);

    return NextResponse.json({
      ok: true,
      uid: userRecord.uid,
      email: userRecord.email,
      rol: role,
      localId: docData.localId,
      message: 'Usuario creado. Entrega estas credenciales al usuario.',
    });
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    if (err.code === 'auth/email-already-exists') {
      return NextResponse.json({ error: 'Ese correo ya está registrado' }, { status: 400 });
    }
    console.error('POST /api/maestro/usuarios', e);
    return NextResponse.json({ error: 'Error al crear usuario' }, { status: 500 });
  }
}
