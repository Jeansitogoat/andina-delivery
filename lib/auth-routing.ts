import type { UserRole } from '@/lib/useAuth';

/**
 * Ruta por defecto según rol: paneles operativos o "/" para cliente.
 */
export function getPanelPathForRole(rol: string, localId?: string | null): string {
  switch (rol as UserRole) {
    case 'rider':
      return '/panel/rider';
    case 'central':
      return '/panel/central';
    case 'maestro':
      return '/panel/maestro';
    case 'local':
      return localId ? `/panel/restaurante/${localId}` : '/panel/restaurante';
    case 'cliente':
    default:
      return '/';
  }
}

/** Evita open redirects: solo rutas internas relativas (path + query opcional). */
export function isSafeInternalRedirectPath(path: string): boolean {
  if (typeof path !== 'string') return false;
  const t = path.trim();
  if (!t.startsWith('/') || t.startsWith('//')) return false;
  if (t.includes('://')) return false;
  if (t.length > 2048) return false;
  return true;
}
