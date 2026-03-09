'use client';

import { useState, useEffect, useCallback } from 'react';
import { getTarifaEnvioPorDistancia, type TarifaTier } from '@/lib/geo';
import { usePublicConfig } from '@/lib/PublicConfigContext';

const TIERS_DEFAULT: TarifaTier[] = [
  { kmMax: 2.5, tarifa: 1.5 },
  { kmMax: 5, tarifa: 2.5 },
  { kmMax: null, tarifa: 3.5 },
];

export type UseTarifasEnvioResult = {
  tiers: TarifaTier[];
  porParadaAdicional: number;
  tarifaMinima: number;
  loading: boolean;
  getTarifaEnvioPorDistancia: (km: number) => number;
};

export function useTarifasEnvio(): UseTarifasEnvioResult {
  const { tarifas: configTarifas, loading: configLoading } = usePublicConfig();
  const [fallbackTiers, setFallbackTiers] = useState<TarifaTier[]>([]);
  const [fallbackPorParada, setFallbackPorParada] = useState(0.25);
  const [fallbackLoading, setFallbackLoading] = useState(true);

  useEffect(() => {
    if (configLoading || (configTarifas.tiers.length > 0)) return;
    let cancelled = false;
    setFallbackLoading(true);
    fetch('/api/config/tarifas')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (cancelled || !data) return;
        if (Array.isArray(data.tiers) && data.tiers.length > 0) {
          setFallbackTiers(data.tiers);
        } else {
          setFallbackTiers(TIERS_DEFAULT);
        }
        setFallbackPorParada(
          typeof data.porParadaAdicional === 'number' ? data.porParadaAdicional : 0.25
        );
      })
      .catch(() => {
        if (!cancelled) {
          setFallbackTiers(TIERS_DEFAULT);
          setFallbackPorParada(0.25);
        }
      })
      .finally(() => {
        if (!cancelled) setFallbackLoading(false);
      });
    return () => { cancelled = true; };
  }, [configLoading, configTarifas.tiers.length]);

  const useConfig = !configLoading && configTarifas.tiers.length > 0;
  const tiers = useConfig ? configTarifas.tiers : (fallbackTiers.length > 0 ? fallbackTiers : TIERS_DEFAULT);
  const porParadaAdicional = useConfig ? configTarifas.porParadaAdicional : fallbackPorParada;
  const loading = useConfig ? false : (configLoading || fallbackLoading);

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
