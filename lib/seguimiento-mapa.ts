import type { EstadoMandado } from '@/lib/types';

const LABELS_COMIDA: [string, string, string, string] = ['Recibido', 'Preparando', 'En camino', 'Entregado'];
const LABELS_MANDADO: [string, string, string, string] = ['Recibido', 'Asignado', 'En camino', 'Entregado'];
const LABELS_PICKUP: [string, string, string, string] = ['Recibido', 'Preparando', 'Listo', 'Retirado'];

export function labelsStepperComida(): [string, string, string, string] {
  return LABELS_COMIDA;
}

export function labelsStepperMandado(): [string, string, string, string] {
  return LABELS_MANDADO;
}

export function labelsStepperPickup(): [string, string, string, string] {
  return LABELS_PICKUP;
}

/** Delivery: agrupa estados internos en 4 pasos. */
export function pasoStepper4ComidaDelivery(estadoRaw: string): number {
  const e = estadoRaw;
  if (e === 'cancelado_local' || e === 'cancelado_cliente') return -1;
  if (e === 'entregado') return 3;
  if (e === 'asignado' || e === 'en_camino') return 2;
  if (e === 'preparando' || e === 'listo' || e === 'esperando_rider') return 1;
  if (e === 'confirmado') return 0;
  return 0;
}

/** Pickup: mantiene 4 pasos coherentes con retiro (sin rider). */
export function pasoStepper4ComidaPickup(estadoRaw: string): number {
  const e = estadoRaw;
  if (e === 'cancelado_local' || e === 'cancelado_cliente') return -1;
  if (e === 'entregado') return 3;
  if (e === 'listo') return 2;
  if (e === 'preparando') return 1;
  if (e === 'confirmado') return 0;
  return 0;
}

export function pasoStepper4Mandado(estado: EstadoMandado): number {
  switch (estado) {
    case 'completado':
      return 3;
    case 'en_camino':
      return 2;
    case 'asignado':
      return 1;
    case 'pendiente':
      return 0;
    case 'cancelado':
      return -1;
    default:
      return 0;
  }
}
