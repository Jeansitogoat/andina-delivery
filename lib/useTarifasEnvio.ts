'use client';

import { useState, useEffect, useCallback } from 'react';
import { getTarifaEnvioPorDistancia, type TarifaTier } from '@/lib/geo';

export type UseTarifasEnvioResult = {
  tiers: TarifaTier[];
  porParadaAdicional: number;
  tarifaMinima: number;
  loading: boolean;
  getTarifaEnvioPorDistancia: (km: number) => number;
};

export function useTarifasEnvio(): UseTarifasEnvioResult {
  const [tiers, setTiers] = useState<TarifaTier[]>([]);
  const [porParadaAdicional, setPorParadaAdicional] = useState(0.25);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/config/tarifas')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (cancelled || !data) return;
        if (Array.isArray(data.tiers) && data.tiers.length > 0) {
          setTiers(data.tiers);
        } else {
          setTiers([
            { kmMax: 2.5, tarifa: 1.5 },
            { kmMax: 5, tarifa: 2.5 },
            { kmMax: null, tarifa: 3.5 },
          ]);
        }
        setPorParadaAdicional(
          typeof data.porParadaAdicional === 'number' ? data.porParadaAdicional : 0.25
        );
      })
      .catch(() => {
        if (!cancelled) {
          setTiers([
            { kmMax: 2.5, tarifa: 1.5 },
            { kmMax: 5, tarifa: 2.5 },
            { kmMax: null, tarifa: 3.5 },
          ]);
          setPorParadaAdicional(0.25);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const getTarifa = useCallback(
    (km: number) => getTarifaEnvioPorDistancia(km, tiers.length > 0 ? tiers : undefined),
    [tiers]
  );

  const tarifaMinima = tiers.length > 0 ? tiers[0].tarifa : 1.5;

  return {
    tiers,
    porParadaAdicional,
    tarifaMinima,
    loading,
    getTarifaEnvioPorDistancia: getTarifa,
  };
}
