/**
 * Geocoding usando Nominatim (OpenStreetMap).
 * Respetar límites de uso: máx 1 req/s, User-Agent identificable.
 */

export interface GeocodeResult {
  lat: number;
  lng: number;
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'AndinaDelivery/1.0 (Piñas, Ecuador; contacto@andina.app)';

/**
 * Geocodifica una dirección y devuelve lat/lng o null si no encuentra.
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const q = (address || '').trim();
  if (!q) return null;
  const search = `${q}, Piñas, Ecuador`;
  try {
    const params = new URLSearchParams({
      q: search,
      format: 'json',
      limit: '1',
      countrycodes: 'ec',
    });
    const res = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: { 'Accept-Language': 'es', 'User-Agent': USER_AGENT },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const first = data[0] as { lat?: string; lon?: string };
    const lat = parseFloat(first?.lat ?? '');
    const lng = parseFloat(first?.lon ?? '');
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}
