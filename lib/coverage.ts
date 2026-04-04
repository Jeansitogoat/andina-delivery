/**
 * Zona operativa Andina Delivery (alineado con VIEWBOX Nominatim El Oro).
 * minLon=-80, maxLat=-3, maxLon=-79, minLat=-4
 */

export const COVERAGE_MIN_LAT = -4.0;
export const COVERAGE_MAX_LAT = -3.0;
export const COVERAGE_MIN_LNG = -80.0;
export const COVERAGE_MAX_LNG = -79.0;

/**
 * Indica si las coordenadas están dentro del rectángulo operativo (Piñas, Portovelo, Zaruma y entorno).
 */
export function isWithinCoverage(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return (
    lat >= COVERAGE_MIN_LAT &&
    lat <= COVERAGE_MAX_LAT &&
    lng >= COVERAGE_MIN_LNG &&
    lng <= COVERAGE_MAX_LNG
  );
}
