import type { DocumentData } from 'firebase/firestore';
import type { EstadoMandado, MandadoCentral } from '@/lib/types';

export function docToMandadoCentral(id: string, data: DocumentData | Record<string, unknown>): MandadoCentral {
  const d = data as Record<string, unknown>;
  return {
    id,
    clienteId: String(d.clienteId ?? ''),
    clienteNombre: String(d.clienteNombre ?? 'Cliente'),
    clienteTelefono: String(d.clienteTelefono ?? ''),
    categoria: String(d.categoria ?? ''),
    descripcion: String(d.descripcion ?? ''),
    desdeTexto: String(d.desdeTexto ?? ''),
    hastaTexto: String(d.hastaTexto ?? ''),
    desdeLat: typeof d.desdeLat === 'number' ? d.desdeLat : null,
    desdeLng: typeof d.desdeLng === 'number' ? d.desdeLng : null,
    hastaLat: typeof d.hastaLat === 'number' ? d.hastaLat : null,
    hastaLng: typeof d.hastaLng === 'number' ? d.hastaLng : null,
    estado: (d.estado as EstadoMandado) || 'pendiente',
    riderId: typeof d.riderId === 'string' ? d.riderId : null,
    riderNombre: typeof d.riderNombre === 'string' ? d.riderNombre : null,
    distanciaKm: typeof d.distanciaKm === 'number' ? d.distanciaKm : null,
    tarifaEnvio: typeof d.tarifaEnvio === 'number' ? d.tarifaEnvio : null,
    pagoRider: typeof d.pagoRider === 'number' ? d.pagoRider : null,
    retencionCentral: typeof d.retencionCentral === 'number' ? d.retencionCentral : null,
    timestamp: typeof d.timestamp === 'number' ? d.timestamp : 0,
    hora: typeof d.hora === 'string' ? d.hora : undefined,
    updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : undefined,
  };
}
