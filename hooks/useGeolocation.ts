'use client';

import { useCallback, useState } from 'react';
import type { LatLng } from '@/lib/location-utils';

export type GeoStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'error';

export function useGeolocation() {
  const [status, setStatus] = useState<GeoStatus>('idle');
  const [location, setLocation] = useState<LatLng | null>(null);

  const requestLocation = useCallback(async (): Promise<LatLng | null> => {
    if (typeof window === 'undefined' || !navigator?.geolocation) {
      setStatus('error');
      return null;
    }

    setStatus('requesting');
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          const next = {
            lat: latitude,
            lng: longitude,
          };
          setLocation(next);
          setStatus('granted');
          resolve(next);
        },
        (err) => {
          // Denied / unavailable: fallback silencioso; el caller decide qué hacer
          console.warn('[Geo] getCurrentPosition failed:', err?.code ?? err);
          setStatus(err?.code === 1 ? 'denied' : 'error');
          resolve(null);
        },
        {
          timeout: 10000,
          maximumAge: 300000,
          enableHighAccuracy: true,
        }
      );
    });
  }, []);

  return { status, location, requestLocation };
}

