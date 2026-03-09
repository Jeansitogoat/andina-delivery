'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { ConfigTarifas, BannerItemPublic } from '@/lib/types/config';

const TIERS_DEFAULT = [
  { kmMax: 2.5, tarifa: 1.5 },
  { kmMax: 5, tarifa: 2.5 },
  { kmMax: null, tarifa: 3.5 },
] as ConfigTarifas['tiers'];
const POR_PARADA_DEFAULT = 0.25;

export type PublicConfigState = {
  tarifas: ConfigTarifas;
  banners: BannerItemPublic[];
  intervalSeconds: number;
  loading: boolean;
  error: boolean;
};

const initialState: PublicConfigState = {
  tarifas: { tiers: TIERS_DEFAULT, porParadaAdicional: POR_PARADA_DEFAULT },
  banners: [],
  intervalSeconds: 4,
  loading: true,
  error: false,
};

const PublicConfigContext = createContext<PublicConfigState | null>(null);

async function fetchFallback(): Promise<{
  tarifas: ConfigTarifas;
  banners: BannerItemPublic[];
  intervalSeconds: number;
}> {
  const [tarifasRes, bannersRes] = await Promise.all([
    fetch('/api/config/tarifas'),
    fetch('/api/banners'),
  ]);
  const tarifasData = tarifasRes.ok ? await tarifasRes.json() : null;
  const bannersData = bannersRes.ok ? await bannersRes.json() : null;
  const tiers = Array.isArray(tarifasData?.tiers) && tarifasData.tiers.length > 0
    ? tarifasData.tiers
    : TIERS_DEFAULT;
  const porParadaAdicional =
    typeof tarifasData?.porParadaAdicional === 'number' ? tarifasData.porParadaAdicional : POR_PARADA_DEFAULT;
  const banners = Array.isArray(bannersData?.banners) ? bannersData.banners : [];
  const intervalSeconds =
    typeof bannersData?.intervalSeconds === 'number' && bannersData.intervalSeconds >= 2 && bannersData.intervalSeconds <= 60
      ? Math.round(bannersData.intervalSeconds)
      : 4;
  return {
    tarifas: { tiers, porParadaAdicional },
    banners,
    intervalSeconds,
  };
}

export function PublicConfigProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PublicConfigState>(initialState);
  const fetchStartedRef = useRef(false);

  useEffect(() => {
    if (fetchStartedRef.current) return;
    fetchStartedRef.current = true;

    let cancelled = false;
    fetch('/api/config/all')
      .then((res) => {
        if (cancelled) return null;
        if (res.ok) return res.json();
        return null;
      })
      .then(async (data) => {
        if (cancelled) return;
        if (data?.tarifas && data?.banners) {
          const tiers = Array.isArray(data.tarifas.tiers) && data.tarifas.tiers.length > 0
            ? data.tarifas.tiers
            : TIERS_DEFAULT;
          const porParadaAdicional =
            typeof data.tarifas.porParadaAdicional === 'number' ? data.tarifas.porParadaAdicional : POR_PARADA_DEFAULT;
          const banners = Array.isArray(data.banners.banners) ? data.banners.banners : [];
          const intervalSeconds =
            typeof data.banners.intervalSeconds === 'number' && data.banners.intervalSeconds >= 2 && data.banners.intervalSeconds <= 60
              ? Math.round(data.banners.intervalSeconds)
              : 4;
          setState({
            tarifas: { tiers, porParadaAdicional },
            banners,
            intervalSeconds,
            loading: false,
            error: false,
          });
          return;
        }
        const fallback = await fetchFallback();
        if (!cancelled) {
          setState({
            ...fallback,
            loading: false,
            error: false,
          });
        }
      })
      .catch(async () => {
        if (cancelled) return;
        try {
          const fallback = await fetchFallback();
          if (!cancelled) {
            setState({
              ...fallback,
              loading: false,
              error: false,
            });
          }
        } catch {
          if (!cancelled) {
            setState((s) => ({
              ...s,
              loading: false,
              error: true,
            }));
          }
        }
      });

    return () => { cancelled = true; };
  }, []);

  return (
    <PublicConfigContext.Provider value={state}>
      {children}
    </PublicConfigContext.Provider>
  );
}

export function usePublicConfig(): PublicConfigState {
  const ctx = useContext(PublicConfigContext);
  return ctx ?? initialState;
}
