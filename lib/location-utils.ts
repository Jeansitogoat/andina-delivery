import { haversineKm } from '@/lib/geo';

export type LatLng = { lat: number; lng: number };

export function distanceKm(a: LatLng, b: LatLng): number {
  return haversineKm(a.lat, a.lng, b.lat, b.lng);
}

export function isOutsideCoverage(params: {
  pin: LatLng;
  locals: Array<LatLng>;
  radiusKm: number;
}): boolean {
  const { pin, locals, radiusKm } = params;
  if (!Array.isArray(locals) || locals.length === 0) return false;
  return locals.some((l) => distanceKm(pin, l) > radiusKm);
}

export function isFarFromGps(params: {
  pin: LatLng;
  gps: LatLng;
  minDistanceKm: number;
}): boolean {
  const { pin, gps, minDistanceKm } = params;
  return distanceKm(pin, gps) > minDistanceKm;
}

