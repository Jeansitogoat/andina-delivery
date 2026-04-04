'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
} from 'react';
import useSWR from 'swr';
import type {
  ConfigTarifas,
  BannerItemPublic,
  ConfigAllResponse,
  LocaleLightHome,
} from '@/lib/types/config';

type AndinaConfigValue = {
  tarifas: ConfigTarifas;
  banners: BannerItemPublic[];
  intervalSeconds: number;
};

type AndinaState = {
  config: AndinaConfigValue;
  localesLight: LocaleLightHome[];
  loading: boolean;
  error: boolean;
  refreshConfig: () => Promise<void>;
  /** Filtro discovery (Restaurantes | Market | Farmacias); null = todos. */
  setLocalesCategoryFilter: (categoria: string | null) => void;
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

const STORAGE_KEY = 'andina_locales_light_v1';

function readStoredLocales(): LocaleLightHome[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.every((x) => x && typeof (x as { id?: unknown }).id === 'string');
    return valid ? (parsed as LocaleLightHome[]) : [];
  } catch {
    return [];
  }
}

async function fetchAndinaConfig(localesCategoryFilter: string | null): Promise<{
  config: AndinaConfigValue;
  localesLight: LocaleLightHome[];
}> {
  const localesUrl =
    localesCategoryFilter && localesCategoryFilter !== 'all'
      ? `/api/locales?light=1&categoria=${encodeURIComponent(localesCategoryFilter)}`
      : '/api/locales?light=1';
  const [configRes, localesRes] = await Promise.all([fetch('/api/config/all'), fetch(localesUrl)]);

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

  let localesLight: LocaleLightHome[] = [];
  if (localesRes.ok) {
    const json = await localesRes.json();
    const raw = Array.isArray(json?.locales) ? json.locales : [];
    localesLight = raw.map((loc: Record<string, unknown>): LocaleLightHome => ({
      id: String(loc.id ?? ''),
      name: String(loc.name ?? ''),
      logoUrl: typeof loc.logoUrl === 'string' ? loc.logoUrl : typeof loc.logo === 'string' ? (loc.logo as string) : '',
      estadoAbierto: typeof loc.estadoAbierto === 'boolean' ? loc.estadoAbierto : loc.status !== 'suspended',
      type: Array.isArray(loc.type) ? (loc.type as string[]) : ['Restaurantes'],
      categorias: Array.isArray(loc.categorias)
        ? (loc.categorias as string[])
        : Array.isArray(loc.type)
          ? (loc.type as string[])
          : ['Restaurantes'],
      status: loc.status === 'active' || loc.status === 'suspended' ? loc.status : undefined,
      lat: typeof loc.lat === 'number' ? loc.lat : undefined,
      lng: typeof loc.lng === 'number' ? loc.lng : undefined,
      isFeatured: Boolean(loc.isFeatured),
      time: String(loc.time ?? '20-35 min'),
      rating: Number(loc.rating ?? 0),
      reviews: Number(loc.reviews ?? 0),
      horarios: Array.isArray(loc.horarios) ? (loc.horarios as LocaleLightHome['horarios']) : undefined,
      cerradoHasta: loc.cerradoHasta != null ? String(loc.cerradoHasta) : undefined,
    }));
  }

  return { config, localesLight };
}

export function AndinaProvider({ children }: { children: React.ReactNode }) {
  const [localesCategoryFilter, setLocalesCategoryFilter] = useState<string | null>(null);
  const [seedLocales] = useState<LocaleLightHome[]>(() =>
    typeof window !== 'undefined' ? readStoredLocales() : []
  );

  const swrKey = ['andina-config', localesCategoryFilter ?? 'all'] as const;
  const { data, error, isLoading, mutate } = useSWR(
    swrKey,
    () => fetchAndinaConfig(localesCategoryFilter),
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
      keepPreviousData: true,
    }
  );

  useEffect(() => {
    if (data?.localesLight?.length) {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data.localesLight));
      } catch {
        /* storage lleno o privado */
      }
    }
  }, [data?.localesLight]);

  const config = data?.config ?? DEFAULT_CONFIG;
  const localesLight =
    data?.localesLight && data.localesLight.length > 0 ? data.localesLight : seedLocales;
  const loading = isLoading && !data;
  const fetchError = Boolean(error);

  const value = useMemo<AndinaState>(
    () => ({
      config,
      localesLight,
      loading,
      error: fetchError,
      refreshConfig: async () => {
        await mutate();
      },
      setLocalesCategoryFilter,
    }),
    [config, localesLight, loading, fetchError, mutate]
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

