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
