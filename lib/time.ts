'use client';

/**
 * Helpers de tiempo para Andina (zona horaria Ecuador).
 */

/**
 * Devuelve true si la hora actual en Ecuador (America/Guayaquil)
 * está entre 23:00 y 07:00 (modo nocturno).
 *
 * Acepta un Date opcional para tests; si no se pasa, usa la hora actual.
 */
export function isNightMode(baseDate?: Date): boolean {
  const date = baseDate ?? new Date();
  try {
    const formatter = new Intl.DateTimeFormat('es-EC', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'America/Guayaquil',
    });
    const parts = formatter.formatToParts(date);
    const hourStr = parts.find((p) => p.type === 'hour')?.value;
    const hour = hourStr != null ? Number(hourStr) : date.getUTCHours();
    if (Number.isNaN(hour)) return false;
    return hour >= 23 || hour < 7;
  } catch {
    // fallback: usar hora local del dispositivo
    const h = date.getHours();
    return h >= 23 || h < 7;
  }
}

