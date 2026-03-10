/**
 * Normaliza un número de teléfono para Ecuador (formato internacional).
 * - Quita espacios, guiones y caracteres no numéricos.
 * - Quita el cero inicial si existe (ej. 09...).
 * - Si no empieza por 593, agrega el prefijo de Ecuador.
 * @example normalizePhoneEcuador('09 8123 4567') => '593981234567'
 * @example normalizePhoneEcuador('981234567') => '593981234567'
 */
export function normalizePhoneEcuador(phone: string | null | undefined): string {
  if (!phone || typeof phone !== 'string') return '';
  const digits = phone.replace(/\D/g, '');
  if (!digits.length) return '';
  const withoutLeadingZero = digits.replace(/^0+/, '');
  if (!withoutLeadingZero.length) return '593';
  if (withoutLeadingZero.startsWith('593')) return withoutLeadingZero;
  return '593' + withoutLeadingZero;
}
