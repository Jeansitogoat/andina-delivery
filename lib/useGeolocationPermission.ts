'use client';

import { useCallback, useEffect, useState } from 'react';

export type GeoPermissionState = 'loading' | 'granted' | 'prompt' | 'denied' | 'unsupported';

export function useGeolocationPermission(): GeoPermissionState {
  const [s, setS] = useState<GeoPermissionState>('loading');

  const probe = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
      setS('unsupported');
      return;
    }
    let cancelled = false;
    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((r) => {
        if (cancelled) return;
        setS(r.state === 'granted' ? 'granted' : r.state === 'denied' ? 'denied' : 'prompt');
        r.addEventListener('change', () => {
          if (!cancelled)
            setS(r.state === 'granted' ? 'granted' : r.state === 'denied' ? 'denied' : 'prompt');
        });
      })
      .catch(() => {
        if (!cancelled) setS('unsupported');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const cleanup = probe();
    return cleanup;
  }, [probe]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') probe();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [probe]);

  return s;
}
