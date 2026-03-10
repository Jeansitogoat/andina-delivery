'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import type {
  ConfigTarifas,
  BannerItemPublic,
  ConfigAllResponse,
  LocaleLight,
} from '@/lib/types/config';

type AndinaConfigValue = {
  tarifas: ConfigTarifas;
  banners: BannerItemPublic[];
  intervalSeconds: number;
};

type AndinaState = {
  config: AndinaConfigValue;
  localesLight: LocaleLight[];
  loading: boolean;
  error: boolean;
  refreshConfig: () => Promise<void>;
};

const DEFAULT_CONFIG: AndinaConfigValue = {
  tarifas: {
    tiers: [],
    porParadaAdicional: 0.25,
  },
  banners: [],
  intervalSeconds: 4,
};

const AndinaContext = createContext<AndinaState | undefined>(undefined);

async function fetchAndinaConfig(): Promise<{
  config: AndinaConfigValue;
  localesLight: LocaleLight[];
}> {
  const [configRes, localesRes] = await Promise.all([
    fetch('/api/config/all'),
    fetch('/api/locales?light=1'),
  ]);

  let config: AndinaConfigValue = DEFAULT_CONFIG;
  if (configRes.ok) {
    const data = (await configRes.json()) as ConfigAllResponse;
    const tarifas = data.tarifas;
    const banners = Array.isArray(data.banners?.banners) ? data.banners.banners : [];
    const intervalSeconds =
      typeof data.banners?.intervalSeconds === 'number'
        ? data.banners.intervalSeconds
        : 4;
    config = { tarifas, banners, intervalSeconds };
  }

  let localesLight: LocaleLight[] = [];
  if (localesRes.ok) {
    const json = await localesRes.json();
    const raw = Array.isArray(json?.locales) ? json.locales : [];
    localesLight = raw.map((loc: any) => ({
      id: String(loc.id),
      name: String(loc.name ?? ''),
      logoUrl: typeof loc.logoUrl === 'string' ? loc.logoUrl : typeof loc.logo === 'string' ? loc.logo : '',
      estadoAbierto:
        typeof loc.estadoAbierto === 'boolean'
          ? loc.estadoAbierto
          : loc.status !== 'suspended',
    }));
  }

  return { config, localesLight };
}

export function AndinaProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AndinaConfigValue>(DEFAULT_CONFIG);
  const [localesLight, setLocalesLight] = useState<LocaleLight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const { config: cfg, localesLight: locs } = await fetchAndinaConfig();
      setConfig(cfg);
      setLocalesLight(locs);
      setLoading(false);
      setError(false);
    } catch {
      setLoading(false);
      setError(true);
    }
  }, []);

  useEffect(() => {
    // Carga inicial
    load();
  }, [load]);

  const value = useMemo<AndinaState>(
    () => ({
      config,
      localesLight,
      loading,
      error,
      refreshConfig: load,
    }),
    [config, localesLight, loading, error, load]
  );

  return (
    <AndinaContext.Provider value={value}>{children}</AndinaContext.Provider>
  );
}

export function useAndinaConfig(): AndinaState {
  const ctx = useContext(AndinaContext);
  if (!ctx) {
    throw new Error('useAndinaConfig debe usarse dentro de AndinaProvider');
  }
  return ctx;
}

