'use client';

import { getFirebaseAuth } from '@/lib/firebase/client';

/** Obtiene el token de Firebase del usuario actual para enviar en Authorization a las APIs.
 * Si el token expiró, el SDK lo renueva automáticamente con el refresh token. */
export async function getIdToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch {
    return null;
  }
}

/** Fuerza la renovación del token (útil tras un 401 para reintentar). */
export async function getIdTokenForceRefresh(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken(true);
  } catch {
    return null;
  }
}

/** Devuelve los headers de autorización con token fresco. Usar justo antes de cada fetch. */
export async function getAuthHeaders(): Promise<Record<string, string> | null> {
  const token = await getIdToken();
  if (!token) return null;
  return { Authorization: `Bearer ${token}` };
}
