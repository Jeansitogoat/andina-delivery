/**
 * Validación y mensajes de error de Firebase para cambio de contraseña (reauth + updatePassword).
 * Reutilizable en paneles (restaurante, rider, central).
 */

import type { User } from 'firebase/auth';

/** true si el usuario puede usar reauth por contraseña (cuenta email/contraseña). */
export function hasEmailPasswordProvider(user: User | null): boolean {
  return user?.providerData?.some((p) => p.providerId === 'password') ?? false;
}

export type PasswordChangeFields = {
  passwordActual: string;
  passwordNueva: string;
  passwordNuevaConfirm: string;
};

export type PasswordValidationResult =
  | { ok: true }
  | { ok: false; message: string };

const MIN_LEN = 6;

export function validatePasswordChangeFields(fields: PasswordChangeFields): PasswordValidationResult {
  const { passwordActual, passwordNueva, passwordNuevaConfirm } = fields;
  if (!passwordActual.trim()) {
    return { ok: false, message: 'Ingresa tu contraseña actual.' };
  }
  if (passwordNueva.length < MIN_LEN) {
    return { ok: false, message: `La nueva contraseña debe tener al menos ${MIN_LEN} caracteres.` };
  }
  if (passwordNueva !== passwordNuevaConfirm) {
    return { ok: false, message: 'La nueva contraseña y la confirmación no coinciden.' };
  }
  return { ok: true };
}

export function mapFirebasePasswordError(err: unknown): string {
  if (!err || typeof err !== 'object') return 'Error al cambiar contraseña.';
  const code = 'code' in err ? String((err as { code?: string }).code) : '';
  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
    return 'Contraseña actual incorrecta.';
  }
  if (code === 'auth/weak-password') {
    return 'La contraseña es demasiado débil.';
  }
  if (code === 'auth/requires-recent-login') {
    return 'Por seguridad, vuelve a iniciar sesión e intenta de nuevo.';
  }
  const msg = 'message' in err && typeof (err as { message?: string }).message === 'string'
    ? (err as { message: string }).message
    : '';
  return msg || 'Error al cambiar contraseña.';
}
