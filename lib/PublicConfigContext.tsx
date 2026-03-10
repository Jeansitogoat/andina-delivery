'use client';

import React, { createContext, useContext } from 'react';
import type { ConfigTarifas, BannerItemPublic } from '@/lib/types/config';
import { useAndinaConfig } from '@/lib/AndinaContext';

export type PublicConfigState = {
  tarifas: ConfigTarifas;
  banners: BannerItemPublic[];
  intervalSeconds: number;
  loading: boolean;
  error: boolean;
};

const PublicConfigContext = createContext<PublicConfigState | null>(null);

export function PublicConfigProvider({ children }: { children: React.ReactNode }) {
  const { config, loading, error } = useAndinaConfig();

  const value: PublicConfigState = {
    tarifas: config.tarifas,
    banners: config.banners,
    intervalSeconds: config.intervalSeconds,
    loading,
    error,
  };

  return (
    <PublicConfigContext.Provider value={value}>
      {children}
    </PublicConfigContext.Provider>
  );
}

export function usePublicConfig(): PublicConfigState {
  const ctx = useContext(PublicConfigContext);
  if (!ctx) {
    throw new Error('usePublicConfig debe usarse dentro de PublicConfigProvider');
  }
  return ctx;
}
