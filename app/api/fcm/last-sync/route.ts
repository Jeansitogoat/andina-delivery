import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { requireAuth } from '@/lib/api-auth';
import { getAdminFirestore } from '@/lib/firebase-admin';

const FCM_TOKENS_COLLECTION = 'fcm_tokens';

/**
 * Milisegundos desde un campo de fecha Firestore/JS. Prioriza Timestamp Admin; luego toMillis si existe;
 * luego Date (incl. ISO string / número). Sin lanzar; sin usar Date.now() como sustituto de fecha ausente.
 */
function toMillisSafe(value: unknown): number | null {
  if (value == null) return null;
  try {
    if (value instanceof Timestamp && typeof value.toMillis === 'function') {
      return value.toMillis();
    }
    const viaOpt =
      typeof value === 'object' && value !== null
        ? (value as { toMillis?: () => number }).toMillis?.()
        : undefined;
    if (typeof viaOpt === 'number' && Number.isFinite(viaOpt)) {
      return viaOpt;
    }
    if (value instanceof Date) {
      const t = value.getTime();
      return Number.isNaN(t) ? null : t;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      const t = new Date(value).getTime();
      return Number.isNaN(t) ? null : t;
    }
    if (typeof value === 'object' && value !== null) {
      const o = value as Record<string, unknown>;
      if ('seconds' in o) {
        const sec = Number(o.seconds);
        const nanos = Number(o.nanoseconds ?? 0);
        if (Number.isFinite(sec)) return sec * 1000 + Math.floor(nanos / 1e6);
      }
      if ('_seconds' in o) {
        const sec = Number(o._seconds);
        const nanos = Number(o._nanoseconds ?? 0);
        if (Number.isFinite(sec)) return sec * 1000 + Math.floor(nanos / 1e6);
      }
    }
  } catch {
    return null;
  }
  return null;
}

export async function GET(request: Request) {
  try {
    await requireAuth(request, ['maestro', 'central']);
  } catch (e) {
    const err = e as unknown;
    if (err instanceof Response) {
      console.warn('GET /api/fcm/last-sync: auth no válida, respondiendo 200 con lastSync null');
      return NextResponse.json({ lastSync: null });
    }
    console.error('GET /api/fcm/last-sync auth', e);
    return NextResponse.json({ lastSync: null });
  }
  try {
    const db = getAdminFirestore();
    let snap;
    try {
      snap = await db
        .collection(FCM_TOKENS_COLLECTION)
        .orderBy('updatedAt', 'desc')
        .limit(1)
        .get();
    } catch (qe) {
      console.error('GET /api/fcm/last-sync query orderBy', qe);
      return NextResponse.json({ lastSync: null });
    }
    if (snap.empty) {
      return NextResponse.json({ lastSync: null });
    }
    const data = snap.docs[0].data() as Record<string, unknown>;
    const ts = data.updatedAt ?? data.lastUpdated;
    const lastSync = toMillisSafe(ts);
    return NextResponse.json({ lastSync });
  } catch (e) {
    console.error('GET /api/fcm/last-sync', e);
    return NextResponse.json({ lastSync: null });
  }
}
