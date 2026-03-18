/**
 * Normaliza un número de teléfono para enlaces wa.me (Ecuador: código 593).
 * Solo dígitos, quitar 0 inicial si existe, anteponer 593 si no está.
 */
export function normalizePhoneForWhatsApp(phone: string | null | undefined): string {
  if (phone == null) return '';
  let clean = String(phone).replace(/\D/g, '');
  if (clean.startsWith('0')) clean = clean.substring(1);
  if (!clean.startsWith('593')) clean = '593' + clean;
  return clean || '';
}

/** Devuelve el href de wa.me listo para usar; vacío si no hay número válido. */
export function formatWhatsAppLink(telefono: string | null | undefined): string {
  const num = normalizePhoneForWhatsApp(telefono);
  return num ? `https://wa.me/${num}` : '';
}
