import { getFCMToken } from '@/lib/fcm-client';

const TOKEN_PREFIX = 'andina_fcm_token_';
const PENDING_PREFIX = 'andina_fcm_pending_';

/**
 * Token FCM del dispositivo actual para desregistrarlo en logout.
 * Prioriza localStorage; si no hay entrada, intenta getFCMToken() con permiso ya concedido.
 */
export async function resolveFCMTokenForUnregister(storageKey: string): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (!('Notification' in window) || Notification.permission !== 'granted') return null;
  try {
    const s = localStorage.getItem(storageKey)?.trim();
    if (s) return s;
  } catch {
    /* modo privado */
  }
  return getFCMToken();
}

/** Elimina todas las claves andina_fcm_token_* y andina_fcm_pending_* del origen actual. */
export function clearAllFcmLocalStorageKeys(): void {
  if (typeof window === 'undefined') return;
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith(TOKEN_PREFIX) || k.startsWith(PENDING_PREFIX)) toRemove.push(k);
    }
    toRemove.forEach((key) => localStorage.removeItem(key));
  } catch {
    /* silencioso */
  }
}
