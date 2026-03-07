/**
 * Distancia entre dos puntos (Haversine) en kilómetros.
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // radio de la Tierra en km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export type TarifaTier = { kmMax: number | null; tarifa: number };

const TIERS_DEFAULT: TarifaTier[] = [
  { kmMax: 2.5, tarifa: 1.5 },
  { kmMax: 5, tarifa: 2.5 },
  { kmMax: null, tarifa: 3.5 },
];

/**
 * Obtiene la tarifa de envío por distancia (km) usando tiers.
 * Si tiers está vacío o km inválido, devuelve la tarifa mínima por defecto (1.50).
 */
export function getTarifaEnvioPorDistancia(
  km: number,
  tiers: TarifaTier[] = TIERS_DEFAULT
): number {
  if (tiers.length === 0) return 1.5;
  if (typeof km !== 'number' || Number.isNaN(km) || km < 0) return tiers[0]?.tarifa ?? 1.5;
  for (const t of tiers) {
    if (t.kmMax == null) return t.tarifa;
    if (km <= t.kmMax) return t.tarifa;
  }
  return tiers[tiers.length - 1]?.tarifa ?? 1.5;
}

/**
 * Formatea distancia en km a texto corto: "XXX m" o "X.X km".
 */
export function formatDistanceKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  const str = km.toFixed(1);
  return str.endsWith('.0') ? `${str.slice(0, -2)} km` : `${str} km`;
}
