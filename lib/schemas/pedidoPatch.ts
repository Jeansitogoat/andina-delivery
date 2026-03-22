import { z } from 'zod';

const ESTADOS_PEDIDO = [
  'esperando_confirmacion',
  'confirmado',
  'preparando',
  'listo',
  'esperando_rider',
  'asignado',
  'en_camino',
  'entregado',
  'cancelado_local',
  'cancelado_rider',
  'cancelado_central',
] as const;

const ACCIONES_PEDIDO = ['cancelar', 'rechazar_carrera', 'avanzar_estado'] as const;

export const pedidoPatchSchema = z.object({
  estado: z.enum(ESTADOS_PEDIDO, { error: 'Estado de pedido no válido' }).optional(),
  riderId: z.string().nullable().optional(),
  propina: z.number().min(0).optional(),
  accion: z.enum(ACCIONES_PEDIDO, { error: 'Acción no válida' }).optional(),
  motivo: z.string().max(500, 'El motivo no puede superar 500 caracteres').optional(),
  paymentConfirmed: z.boolean().optional(),
  comprobanteBase64: z.string().max(500_000, 'El comprobante es demasiado grande').nullable().optional(),
  comprobanteFileName: z.string().max(200).nullable().optional(),
  comprobanteMimeType: z.string().max(100).nullable().optional(),
});

export type PedidoPatchInput = z.infer<typeof pedidoPatchSchema>;
