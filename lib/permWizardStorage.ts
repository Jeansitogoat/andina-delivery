/**
 * Estado persistido del asistente post-login (notificaciones + ubicación).
 * Clave: andina_perm_wizard_v1_${uid}
 */

export type PermWizardV1 = {
  /** Usuario cerró el paso de ubicación (Más tarde) o se guardó tras éxito. */
  geoHandled?: boolean;
};

export function permWizardKey(uid: string): string {
  return `andina_perm_wizard_v1_${uid}`;
}

export function loadPermWizard(uid: string): PermWizardV1 {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(permWizardKey(uid));
    if (!raw) return {};
    const p = JSON.parse(raw) as PermWizardV1;
    return typeof p === 'object' && p !== null ? p : {};
  } catch {
    return {};
  }
}

export function savePermWizardPatch(uid: string, patch: Partial<PermWizardV1>): void {
  if (typeof window === 'undefined') return;
  try {
    const prev = loadPermWizard(uid);
    const next = { ...prev, ...patch };
    localStorage.setItem(permWizardKey(uid), JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('andina-perm-wizard-done'));
  } catch {
    /* */
  }
}

/** Limpia todas las claves andina_perm_wizard_v1_* (p. ej. al cerrar sesión). */
export function clearAllPermWizardLocalStorageKeys(): void {
  if (typeof window === 'undefined') return;
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('andina_perm_wizard_v1_')) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* */
  }
}
