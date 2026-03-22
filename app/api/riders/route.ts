import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/api-auth';
import type { RiderStatus } from '@/lib/useAuth';

export interface RiderDoc {
  uid: string;
  email: string | null;
  displayName?: string | null;
  rol: 'rider';
  riderStatus?: RiderStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

/** GET /api/riders?estado=pendiente|aprobados|suspended|todos → lista de riders (solo central o maestro) */
export async function GET(request: Request) {
  try {
    await requireAuth(request, ['central', 'maestro']);
  } catch (r) {
    if (r instanceof Response) return r;
    throw r;
  }
  try {
    const { searchParams } = new URL(request.url);
    const estado = searchParams.get('estado') ?? 'todos';
    const db = getAdminFirestore();
    const snap = await db.collection('users').where('rol', '==', 'rider').limit(100).get();
    let list: RiderDoc[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        uid: d.id,
        email: data.email ?? null,
        displayName: data.displayName ?? null,
        rol: 'rider',
        riderStatus: data.riderStatus ?? 'pending',
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    });
    if (estado === 'pendiente') list = list.filter((r) => r.riderStatus === 'pending');
    else if (estado === 'aprobados') list = list.filter((r) => r.riderStatus === 'approved');
    else if (estado === 'suspended') list = list.filter((r) => r.riderStatus === 'suspended');
    return NextResponse.json({ riders: list });
  } catch (e) {
    console.error('GET /api/riders', e);
    return NextResponse.json({ error: 'Error al listar riders' }, { status: 500 });
  }
}
