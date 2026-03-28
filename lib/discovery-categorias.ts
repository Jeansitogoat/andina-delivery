export const DISCOVERY_CATEGORIES = [
  { key: 'cafes', label: 'Cafés' },
  { key: 'marisquerias', label: 'Marisquerías' },
  { key: 'heladerias_postres', label: 'Heladerías y postres' },
  { key: 'comida_rapida', label: 'Comida rápida' },
  { key: 'parrillas', label: 'Parrillas' },
  { key: 'pizzas', label: 'Pizzas' },
  { key: 'pastas', label: 'Pastas' },
  { key: 'sushi', label: 'Sushi' },
  { key: 'mexicana', label: 'Mexicana' },
  { key: 'china', label: 'China' },
  { key: 'market', label: 'Comisariatos' },
  { key: 'farmacias', label: 'Farmacias' },
] as const;

export type DiscoveryCategoryKey = (typeof DISCOVERY_CATEGORIES)[number]['key'];

export const DISCOVERY_CATEGORY_KEYS: DiscoveryCategoryKey[] = DISCOVERY_CATEGORIES.map((c) => c.key);
export const DISCOVERY_CATEGORY_SET = new Set<string>(DISCOVERY_CATEGORY_KEYS);

export function isDiscoveryCategoryKey(value: string): value is DiscoveryCategoryKey {
  return DISCOVERY_CATEGORY_SET.has(value);
}

export function mapLegacyTypeToDiscoveryCategory(typeValue: string): DiscoveryCategoryKey | null {
  if (typeValue === 'Cafes') return 'cafes';
  if (typeValue === 'Market') return 'market';
  if (typeValue === 'Farmacias') return 'farmacias';
  return null;
}

export function getLegacyTypeFromDiscoveryCategory(key: string): string {
  if (key === 'market') return 'Market';
  if (key === 'farmacias') return 'Farmacias';
  return 'Restaurantes';
}

export function matchesLegacyTypeForDiscoveryCategory(key: string, legacyType: string): boolean {
  if (key === 'cafes') return legacyType === 'Cafes';
  if (key === 'market') return legacyType === 'Market';
  if (key === 'farmacias') return legacyType === 'Farmacias';
  return false;
}
