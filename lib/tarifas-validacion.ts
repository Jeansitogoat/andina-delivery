/** Límite de filas en config/tarifasEnvio para no inflar el documento. */
export const MAX_TARIFA_TIERS = 25;

/**
 * Valida tiers de envío: un solo tramo final sin km (resto), km estrictamente crecientes.
 */
export function validateTarifaTiers(
  tiers: Array<{ kmMax: number | null; tarifa: number }>
): { ok: true } | { ok: false; error: string } {
  if (tiers.length < 1) {
    return { ok: false, error: 'Debe haber al menos un tramo' };
  }
  if (tiers.length > MAX_TARIFA_TIERS) {
    return { ok: false, error: `Máximo ${MAX_TARIFA_TIERS} tramos` };
  }
  const last = tiers[tiers.length - 1];
  if (last.kmMax != null) {
    return { ok: false, error: 'El último tramo debe ser “resto” (sin límite de km)' };
  }
  const nullIdx = tiers.findIndex((t) => t.kmMax == null);
  if (nullIdx !== tiers.length - 1) {
    return { ok: false, error: 'Solo el último tramo puede tener km sin límite' };
  }
  const bounded = tiers.slice(0, -1) as Array<{ kmMax: number; tarifa: number }>;
  for (let i = 0; i < bounded.length; i++) {
    const km = bounded[i].kmMax;
    if (typeof km !== 'number' || Number.isNaN(km) || km < 0) {
      return { ok: false, error: 'Cada tramo intermedio necesita “hasta km” mayor o igual a 0' };
    }
    if (typeof bounded[i].tarifa !== 'number' || bounded[i].tarifa < 0) {
      return { ok: false, error: 'Las tarifas deben ser números mayores o iguales a 0' };
    }
  }
  if (typeof last.tarifa !== 'number' || last.tarifa < 0) {
    return { ok: false, error: 'Las tarifas deben ser números mayores o iguales a 0' };
  }
  for (let i = 1; i < bounded.length; i++) {
    if (bounded[i].kmMax <= bounded[i - 1].kmMax) {
      return { ok: false, error: 'Los límites de km deben ir en orden estrictamente creciente' };
    }
  }
  return { ok: true };
}
