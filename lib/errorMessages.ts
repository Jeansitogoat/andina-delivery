/**
 * Mapeo de errores técnicos a mensajes amigables para el usuario.
 * Cada error se traduce a un mensaje humano con opción de acción.
 */
export interface ErrorUserMessage {
  message: string;
  action?: 'reload' | 'login' | 'home';
}

export function mapErrorToUserMessage(error: unknown): ErrorUserMessage {
  if (error instanceof Error) {
    const msg = (error.message || '').toLowerCase();
    const name = (error.name || '').toLowerCase();

    // Errores de red
    if (
      msg.includes('fetch') ||
      msg.includes('network') ||
      msg.includes('failed to fetch') ||
      msg.includes('networkerror') ||
      msg.includes('load failed') ||
      name === 'typeerror' && msg.includes('fetch')
    ) {
      return {
        message: 'Revisa tu conexión e intenta de nuevo.',
        action: 'reload',
      };
    }

    // Timeout
    if (msg.includes('timeout') || msg.includes('timed out')) {
      return {
        message: 'La solicitud tardó demasiado. Revisa tu conexión e intenta de nuevo.',
        action: 'reload',
      };
    }

    // Firebase Auth: token expirado / no autorizado
    if (
      msg.includes('auth/id-token-expired') ||
      msg.includes('auth/argument-error') ||
      msg.includes('auth/session-expired') ||
      msg.includes('unauthenticated') ||
      msg.includes('token expired') ||
      msg.includes('401') ||
      msg.includes('403')
    ) {
      return {
        message: 'Tu sesión venció. Vuelve a iniciar sesión.',
        action: 'login',
      };
    }

    // Firestore: permisos
    if (
      msg.includes('permission-denied') ||
      msg.includes('missing or insufficient permissions') ||
      msg.includes('permission_denied')
    ) {
      return {
        message: 'No tienes permiso para esta acción.',
        action: 'home',
      };
    }

    // Firestore: cuota / resource-exhausted
    if (
      msg.includes('resource-exhausted') ||
      msg.includes('quota') ||
      msg.includes('rate limit') ||
      msg.includes('too many requests')
    ) {
      return {
        message: 'Demasiadas solicitudes. Espera un momento e intenta de nuevo.',
        action: 'reload',
      };
    }

    // Firestore: documento no encontrado
    if (msg.includes('not-found') || msg.includes('document not found')) {
      return {
        message: 'No se encontró lo que buscas. Probablemente fue eliminado.',
        action: 'home',
      };
    }
  }

  // Genérico
  return {
    message: 'Algo salió mal. Intenta recargar o vuelve al inicio.',
    action: 'reload',
  };
}
