/**
 * Normaliza un número de teléfono para Ecuador (formato internacional).
 * Delega en lib/utils/phone para evitar duplicidad de lógica.
 * @example normalizePhoneEcuador('09 8123 4567') => '593981234567'
 */
export { normalizePhoneForWhatsApp as normalizePhoneEcuador } from '@/lib/utils/phone';
