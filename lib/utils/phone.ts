/**
 * Normaliza un número de teléfono para enlaces wa.me (Ecuador: código 593).
 * Elimina caracteres no numéricos y aplica formato internacional sin el símbolo +.
 */
export function normalizePhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 0) return '';
  if (digits.length === 9 && digits.startsWith('0')) {
    return '593' + digits.slice(1);
  }
  if (digits.length === 9 && !digits.startsWith('0')) {
    return '593' + digits;
  }
  if (digits.length === 12 && digits.startsWith('593')) {
    return digits;
  }
  return digits;
}
