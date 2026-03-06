/**
 * Genera un slug a partir de un nombre (para IDs de locales).
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'local';
}

/**
 * Devuelve un id único añadiendo sufijo numérico si ya existe.
 */
export function ensureUniqueLocalId(baseId: string, existingIds: Set<string>): string {
  let id = baseId;
  let n = 1;
  while (existingIds.has(id)) {
    id = `${baseId}-${n}`;
    n++;
  }
  return id;
}
