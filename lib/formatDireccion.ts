/**
 * Para mostrar en pantalla: quita código postal, provincia y país.
 * El motorizado sigue recibiendo la dirección completa; solo se acorta la vista.
 */
export function formatDireccionCorta(direccion: string | null | undefined): string {
  if (!direccion || typeof direccion !== 'string') return '';
  let s = direccion.trim();
  if (!s) return '';
  // Quitar ", Ecuador" al final
  s = s.replace(/,?\s*ecuador\s*$/i, '');
  // Quitar ", El Oro"
  s = s.replace(/,?\s*el\s+oro\s*$/i, '');
  // Quitar código postal (solo dígitos, ej. 070034)
  s = s.replace(/,?\s*\d{5,}\s*,?\s*$/i, '');
  s = s.replace(/,?\s*\d{5,}\s*,/gi, ',');
  return s.replace(/\s*,\s*$/, '').trim() || direccion.trim();
}
