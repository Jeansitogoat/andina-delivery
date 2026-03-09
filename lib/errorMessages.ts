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
        message: 'Revisá tu conexión e intentá de nuevo.',
        action: 'reload',
      };
    }

    // Timeout
    if (msg.includes('timeout') || msg.includes('timed out')) {
      return {
        message: 'La solicitud tardó demasiado. Revisá tu conexión e intentá de nuevo.',
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
        message: 'Tu sesión venció. Volvé a iniciar sesión.',
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
        message: 'No tenés permiso para esta acción.',
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
        message: 'Demasiadas solicitudes. Esperá un momento e intentá de nuevo.',
        action: 'reload',
      };
    }

    // Firestore: documento no encontrado
    if (msg.includes('not-found') || msg.includes('document not found')) {
      return {
        message: 'No se encontró lo que buscás. Probablemente fue eliminado.',
        action: 'home',
      };
    }
  }

  // Genérico
  return {
    message: 'Algo salió mal. Intentá recargar o volvé al inicio.',
    action: 'reload',
  };
}
