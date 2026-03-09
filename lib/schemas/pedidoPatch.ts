import { z } from 'zod';

export const pedidoPatchSchema = z.object({
  estado: z.string().optional(),
  riderId: z.string().nullable().optional(),
  propina: z.number().optional(),
  accion: z.string().optional(),
  motivo: z.string().optional(),
  paymentConfirmed: z.boolean().optional(),
  comprobanteBase64: z.string().nullable().optional(),
  comprobanteFileName: z.string().nullable().optional(),
  comprobanteMimeType: z.string().nullable().optional(),
});

export type PedidoPatchInput = z.infer<typeof pedidoPatchSchema>;
