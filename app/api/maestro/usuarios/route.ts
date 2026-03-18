import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore, setUserClaims } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/api-auth';
import type { UserRole } from '@/lib/useAuth';
import { FieldValue } from 'firebase-admin/firestore';
import { maestroUsuariosPostSchema } from '@/lib/schemas/maestroUsuarios';

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
    const parse = maestroUsuariosPostSchema.safeParse(body);
    if (!parse.success) {
      const flat = parse.error.flatten().fieldErrors;
      const firstMessage = Object.values(flat).flat().find(Boolean) || 'Datos inválidos';
      return NextResponse.json({ error: String(firstMessage), fieldErrors: flat }, { status: 400 });
    }
    const { email, password, rol, displayName, localId } = parse.data;
    const role = rol === 'central' || rol === 'local' ? rol : 'local';
    const auth = getAdminAuth();
    const db = getAdminFirestore();

    const userRecord = await auth.createUser({
      email: email.trim(),
      password,
      displayName: displayName?.trim() || undefined,
    });

    const resolvedLocalId = role === 'local' && localId ? String(localId).trim() : null;
    const docData = {
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: displayName?.trim() || userRecord.displayName || null,
      rol: role as UserRole,
      localId: resolvedLocalId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    await db.collection('users').doc(userRecord.uid).set(docData);

    // Fijar custom claim para que requireAuth no necesite leer Firestore en cada request.
    await setUserClaims(userRecord.uid, { rol: role, localId: resolvedLocalId });

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
