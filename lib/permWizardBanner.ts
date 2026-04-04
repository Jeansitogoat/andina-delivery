import { loadPermWizard } from '@/lib/permWizardStorage';
import { isWebPushEnvironment } from '@/lib/useNotifications';
import type { GeoPermissionState } from '@/lib/useGeolocationPermission';

/** Cliente con paso de notificaciones a pantalla completa aún activo. */
export function isClienteNotifWizardBlocking(rol: string | undefined, notifPerm: NotificationPermission): boolean {
  return rol === 'cliente' && notifPerm === 'default' && isWebPushEnvironment();
}

export function needGeoStep(geoState: GeoPermissionState): boolean {
  return (
    geoState !== 'loading' &&
    geoState !== 'granted' &&
    geoState !== 'unsupported' &&
    (geoState === 'prompt' || geoState === 'denied')
  );
}

/**
 * El asistente de ubicación a pantalla completa sigue activo (no usar banners encima).
 */
export function isGeoFullScreenBlocking(
  uid: string | undefined | null,
  geoState: GeoPermissionState,
  notifPerm: NotificationPermission,
  rol: string | undefined
): boolean {
  if (!uid) return false;
  if (!needGeoStep(geoState)) return false;
  const persist = loadPermWizard(uid);
  if (persist.geoHandled) return false;
  const op = rol === 'local' || rol === 'rider' || rol === 'central' || rol === 'maestro';
  if (op) {
    return notifPerm === 'granted';
  }
  if (rol === 'cliente') {
    return notifPerm === 'granted' || notifPerm === 'denied';
  }
  return false;
}

/** Banners secundarios (notif / ubicación backup) solo tras despejar el asistente post-login. */
export function isPostLoginWizardClearForBanners(
  uid: string | undefined | null,
  geoState: GeoPermissionState,
  notifPerm: NotificationPermission,
  rol: string | undefined
): boolean {
  if (!uid) return false;
  if (isClienteNotifWizardBlocking(rol, notifPerm)) return false;
  if (isGeoFullScreenBlocking(uid, geoState, notifPerm, rol)) return false;
  return true;
}
