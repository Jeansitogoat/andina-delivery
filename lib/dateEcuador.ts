/**
 * Fechas y horas en zona Ecuador (America/Guayaquil), independiente del huso del dispositivo.
 * Para horarios de locales, `getEstadoAbierto` / `abiertoAhora` siguen usando la hora local del cliente salvo que se unifique explícitamente con `nowInEcuadorParts`.
 */

export const ECUADOR_TIMEZONE = 'America/Guayaquil';
const LOCALE = 'es-EC';

const fmtTime = new Intl.DateTimeFormat(LOCALE, {
  timeZone: ECUADOR_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
});

const fmtWeekdayDay = new Intl.DateTimeFormat(LOCALE, {
  timeZone: ECUADOR_TIMEZONE,
  weekday: 'short',
  day: 'numeric',
});

const fmtDateShort = new Intl.DateTimeFormat(LOCALE, {
  timeZone: ECUADOR_TIMEZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const fmtDateTime = new Intl.DateTimeFormat(LOCALE, {
  timeZone: ECUADOR_TIMEZONE,
  dateStyle: 'short',
  timeStyle: 'short',
});

/** Clave YYYY-MM-DD del calendario en Ecuador (para comparar “hoy” / “ayer”). */
export function dateKeyEcuador(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ECUADOR_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function formatTimeEcuador(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  return fmtTime.format(d);
}

export function formatWeekdayDayEcuador(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  return fmtWeekdayDay.format(d);
}

export function formatDateShortEcuador(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  return fmtDateShort.format(d);
}

export function formatDateTimeEcuador(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  return fmtDateTime.format(d);
}

/**
 * Alias para tickets y resúmenes: fecha y hora en Ecuador (Piñas / America/Guayaquil).
 * Preferir esto donde el cliente deba ver “a qué hora pidió” en hora civil local.
 */
export function formatEcuador(date: Date | number): string {
  return formatDateTimeEcuador(date);
}

/** Solo hora (12 h) en Ecuador — útil para una línea tipo “Pediste a las 7:00 p. m.” */
export function formatTime12hEcuador(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: ECUADOR_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}
