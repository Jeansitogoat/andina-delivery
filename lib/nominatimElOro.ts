/**
 * Nominatim (OpenStreetMap) — búsqueda acotada a El Oro.
 * Respetar políticas de uso: User-Agent identificable; no más de ~1 req/s en producción.
 */

import { haversineKm } from '@/lib/geo';

/** Centro de referencia para ordenar resultados (Piñas). */
export const PIÑAS_CENTER = { lat: -3.681, lng: -79.681 };

export const VIEWBOX_EL_ORO = '-80.0,-4.0,-79.0,-3.0';

const SUFFIX_EL_ORO = ', El Oro, Ecuador';

export const NOMINATIM_HEADERS = {
  'Accept-Language': 'es',
  'User-Agent': 'AndinaDelivery/1.0 (contact: https://andina-delivery.web.app)',
} as const;

/** Añade ", El Oro, Ecuador" si el usuario no lo escribió ya. */
export function buildNominatimQuery(raw: string): string {
  const t = raw.trim();
  if (!t) return `Piñas${SUFFIX_EL_ORO}`;
  const lower = t.toLowerCase();
  if (lower.includes('el oro') && lower.includes('ecuador')) return t;
  return `${t}${SUFFIX_EL_ORO}`;
}

export type NominatimSearchHit = {
  lat: number;
  lng: number;
  displayName: string;
};

/** Ordena por distancia creciente a un punto de referencia (siempre PIÑAS_CENTER en ranking principal). */
export function sortNominatimHitsByProximity(
  hits: NominatimSearchHit[],
  refLat: number,
  refLng: number
): NominatimSearchHit[] {
  return [...hits].sort(
    (a, b) =>
      haversineKm(refLat, refLng, a.lat, a.lng) - haversineKm(refLat, refLng, b.lat, b.lng)
  );
}

/** Prioridad por nombre local (evita homónimos en otras provincias). */
function hasLocalTextBoost(displayName: string): boolean {
  const lower = displayName.toLowerCase();
  return (
    lower.includes('piñas') ||
    lower.includes('pinas') ||
    lower.includes('zaruma') ||
    lower.includes('portovelo')
  );
}

/**
 * Text boost: resultados que mencionan Piñas / Zaruma / Portovelo primero;
 * dentro de cada grupo, orden por Haversine desde PIÑAS_CENTER (sin usar GPS del usuario).
 */
export function rankNominatimHitsForAndina(hits: NominatimSearchHit[]): NominatimSearchHit[] {
  const boosted = hits.filter((h) => hasLocalTextBoost(h.displayName));
  const rest = hits.filter((h) => !hasLocalTextBoost(h.displayName));
  const byPiñas = (arr: NominatimSearchHit[]) =>
    sortNominatimHitsByProximity(arr, PIÑAS_CENTER.lat, PIÑAS_CENTER.lng);
  return [...byPiñas(boosted), ...byPiñas(rest)];
}

/**
 * Búsqueda con bounded=1 y viewbox regional; si no hay resultados, reintenta sin bounded.
 * Orden: text boost local + distancia siempre anclada a PIÑAS_CENTER.
 */
export async function searchNominatimElOro(query: string): Promise<NominatimSearchHit[]> {
  const q = buildNominatimQuery(query);
  const params = new URLSearchParams({
    q,
    format: 'json',
    limit: '15',
    countrycodes: 'ec',
    addressdetails: '1',
    viewbox: VIEWBOX_EL_ORO,
    bounded: '1',
  });
  let res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: NOMINATIM_HEADERS,
  });
  let data: Array<{ lat: string; lon: string; display_name?: string }> = await res.json();
  if (!Array.isArray(data) || data.length === 0) {
    const fallback = new URLSearchParams({
      q,
      format: 'json',
      limit: '15',
      countrycodes: 'ec',
      addressdetails: '1',
    });
    res = await fetch(`https://nominatim.openstreetmap.org/search?${fallback.toString()}`, {
      headers: NOMINATIM_HEADERS,
    });
    data = await res.json();
  }
  if (!Array.isArray(data)) return [];
  const mapped = data
    .map((row) => ({
      lat: parseFloat(row.lat),
      lng: parseFloat(row.lon),
      displayName: String(row.display_name ?? '').trim() || `${row.lat}, ${row.lon}`,
    }))
    .filter((r) => !Number.isNaN(r.lat) && !Number.isNaN(r.lng));
  const ranked = rankNominatimHitsForAndina(mapped);
  return ranked.slice(0, 8);
}

export async function reverseNominatimElOro(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: NOMINATIM_HEADERS }
    );
    const data = await res.json();
    const name = data?.display_name && String(data.display_name).trim();
    return name || null;
  } catch {
    return null;
  }
}
