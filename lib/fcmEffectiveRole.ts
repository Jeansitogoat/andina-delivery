import type { AndinaUser } from '@/lib/useAuth';
import type { NotificationRole } from '@/lib/useNotifications';

/**
 * Rol FCM para registro de tokens: riders pendientes de aprobación usan `user`
 * hasta que la Central los aprueba; entonces `rider`.
 */
export function effectiveNotificationRole(user: AndinaUser | null | undefined): NotificationRole {
  if (!user) return 'user';
  if (user.rol === 'local') return 'local';
  if (user.rol === 'rider') {
    return user.riderStatus === 'approved' ? 'rider' : 'user';
  }
  if (user.rol === 'central' || user.rol === 'maestro') return 'central';
  return 'user';
}

/** True si el rider aún no puede operar en panel (misma regla que FCM como user). */
export function isRiderPendingApproval(user: AndinaUser | null | undefined): boolean {
  return Boolean(user?.rol === 'rider' && user.riderStatus !== 'approved');
}
