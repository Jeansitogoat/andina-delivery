const GUAYAQUIL_OFFSET_HOURS = -5;
const GUAYAQUIL_OFFSET_MS = GUAYAQUIL_OFFSET_HOURS * 60 * 60 * 1000;

export function startOfDayGuayaquil(ts = Date.now()): number {
  const shifted = new Date(ts + GUAYAQUIL_OFFSET_MS);
  return Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
    0,
    0,
    0,
    0
  ) - GUAYAQUIL_OFFSET_MS;
}

export function dayKeyGuayaquil(ts = Date.now()): string {
  const shifted = new Date(ts + GUAYAQUIL_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
