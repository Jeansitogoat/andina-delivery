/**
 * Rate limiter in-memory por IP.
 * En serverless cada instancia tiene su propia memoria; el límite aplica por instancia.
 * Para escalar: migrar a Upstash Redis.
 */

const WINDOW_MS = 15 * 60 * 1000; // 15 minutos

const PRESETS: Record<string, { max: number }> = {
  solicitudes: { max: 5 },
  default: { max: 30 },
};

const store = new Map<string, { count: number; resetAt: number }>();

function cleanup(): void {
  const now = Date.now();
  for (const [key, val] of store.entries()) {
    if (val.resetAt < now) store.delete(key);
  }
}

export function checkRateLimit(
  ip: string,
  slug: keyof typeof PRESETS = 'solicitudes'
): { ok: boolean; remaining: number } {
  const { max: MAX_REQUESTS } = PRESETS[slug] ?? PRESETS.default;
  const key = `${slug}:${ip}`;
  const now = Date.now();
  const entry = store.get(key);

  if (!entry) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    if (store.size > 2000) cleanup();
    return { ok: true, remaining: MAX_REQUESTS - 1 };
  }

  if (entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, remaining: MAX_REQUESTS - 1 };
  }

  entry.count += 1;
  const remaining = Math.max(0, MAX_REQUESTS - entry.count);
  return { ok: entry.count <= MAX_REQUESTS, remaining };
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  if (forwarded) return forwarded.split(',')[0].trim();
  if (realIp) return realIp.trim();
  return '127.0.0.1';
}

/** Devuelve true si el request excede el límite. slug: 'solicitudes' (5/15min) | 'default' (30/15min). */
export function isRateLimited(request: Request, slug: keyof typeof PRESETS = 'default'): boolean {
  const ip = getClientIp(request);
  const { ok } = checkRateLimit(ip, slug);
  return !ok;
}
