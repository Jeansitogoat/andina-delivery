import type { Local, MenuItem, Review } from '@/lib/data';

export type SolicitudStatus = 'pending' | 'approved' | 'rejected';

export interface Solicitud {
  id: string;
  status: SolicitudStatus;
  createdAt: string; // ISO
  // Form fields
  nombreLocal: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  telefonoLocal: string;
  direccion: string;
  tipoNegocio: string;
  localACalle: boolean;
  // Fase 1: URLs de Firebase Storage (preferido sobre Base64)
  logoUrl?: string;
  bannerUrl?: string;
  menuFotosUrls?: string[];
  // @deprecated Mantener para compatibilidad con solicitudes anteriores a Fase 1
  logoBase64?: string;
  bannerBase64?: string;
  menuFotosBase64?: string[];
  // Set when approved
  localId?: string;
}

export interface LocalesAprobadosFile {
  locales: Local[];
  menus: Record<string, MenuItem[]>;
  reviews?: Record<string, Review[]>;
}
