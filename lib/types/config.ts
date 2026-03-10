/**
 * Tipos para la config pública unificada (GET /api/config/all).
 * Alineados con las respuestas de /api/config/tarifas y /api/banners.
 */
import type { TarifaTier } from '@/lib/geo';

export type { TarifaTier };

export interface ConfigTarifas {
  tiers: TarifaTier[];
  porParadaAdicional: number;
}

export interface BannerItemPublic {
  id: string;
  imageUrl: string;
  alt: string;
  linkType: string;
  linkValue: string;
  order: number;
}

export interface ConfigBanners {
  banners: BannerItemPublic[];
  intervalSeconds: number;
}

export interface ConfigAllResponse {
  tarifas: ConfigTarifas;
  banners: ConfigBanners;
}

// Versión liviana de Local para contextos globales (AndinaContext, paneles, etc.)
export interface LocaleLight {
  id: string;
  name: string;
  /** URL segura del logo ya normalizada */
  logoUrl: string;
  /** true si el local está operativo (no suspendido) */
  estadoAbierto: boolean;
}
