/**
 * Utilidades para Firestore.
 * Firestore no acepta undefined; esta función elimina claves con valor undefined
 * para evitar errores en .set() y .update().
 */
export function sanitizeForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map((v) => sanitizeForFirestore(v)) as T;
  if (typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) out[k] = sanitizeForFirestore(v);
    }
    return out as T;
  }
  return obj;
}
