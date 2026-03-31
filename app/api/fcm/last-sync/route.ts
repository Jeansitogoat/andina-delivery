import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getAdminFirestore } from '@/lib/firebase-admin';

const FCM_TOKENS_COLLECTION = 'fcm_tokens';

/**
 * Convierte Timestamp de Admin, Date, string ISO, número (s o ms) u objeto { seconds, nanoseconds } a milisegundos.
 * Nunca lanza; devuelve null si el valor no es interpretable.
 */
function toMillisSafe(value: unknown): number | null {
  if (value == null) return null;
  try {
    if (typeof value === 'object' && value !== null && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
      const t = (value as { toMillis: () => number }).toMillis();
      return typeof t === 'number' && Number.isFinite(t) ? t : null;
    }
    if (value instanceof Date) {
      const t = value.getTime();
      return Number.isNaN(t) ? null : t;
    }
    if (typeof value === 'string') {
      const t = Date.parse(value);
      return Number.isNaN(t) ? null : t;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      // < ~ año 2001 en ms → tratar como segundos unix
      return value < 1e11 ? Math.round(value * 1000) : Math.round(value);
    }
    if (typeof value === 'object' && value !== null && 'seconds' in value) {
      const sec = Number((value as { seconds: unknown }).seconds);
      const nanos = Number((value as { nanoseconds?: unknown }).nanoseconds ?? 0);
      if (!Number.isFinite(sec)) return null;
      return sec * 1000 + Math.floor(nanos / 1e6);
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
    if (err instanceof Response) return err;
    throw err;
  }
  try {
    const db = getAdminFirestore();
    const snap = await db
      .collection(FCM_TOKENS_COLLECTION)
      .orderBy('updatedAt', 'desc')
      .limit(1)
      .get();
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
