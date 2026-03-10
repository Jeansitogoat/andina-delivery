/**
 * Rate limit simple en memoria por IP.
 * Ventana en segundos y máximo de peticiones por ventana.
 * Para rutas críticas (claim, etc.) y mitigar ráfagas de fuerza bruta.
 */

const store = new Map<
  string,
  { count: number; resetAt: number }
>();

const WINDOW_SEC = 15;
const MAX_REQUESTS = 10;

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? request.headers.get('x-vercel-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return 'unknown';
}

/**
 * Devuelve true si la petición debe ser bloqueada (demasiadas solicitudes).
 * Si no se bloquea, incrementa el contador para esta IP.
 */
export function isRateLimited(request: Request): boolean {
  const ip = getClientIp(request);
  const now = Date.now();
  const resetAt = now + WINDOW_SEC * 1000;

  let entry = store.get(ip);
  if (!entry) {
    store.set(ip, { count: 1, resetAt });
    return false;
  }
  if (now >= entry.resetAt) {
    entry = { count: 1, resetAt };
    store.set(ip, entry);
    return false;
  }
  entry.count += 1;
  if (entry.count > MAX_REQUESTS) {
    return true;
  }
  return false;
}

/** Limpia entradas vencidas (opcional, para no crecer sin límite). */
export function pruneRateLimitStore(): void {
  const now = Date.now();
  for (const [key, value] of store.entries()) {
    if (now >= value.resetAt) store.delete(key);
  }
}
