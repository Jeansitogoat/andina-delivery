import { z } from 'zod';

const itemsCartItemSchema = z.object({
  id: z.string().min(1),
  qty: z.number().int().positive(),
  note: z.string().optional(),
});

export const pedidoPostSchema = z.object({
  id: z.string().min(1, 'id requerido'),
  restaurante: z.string().min(1, 'restaurante requerido'),
  restauranteDireccion: z.string().default('—'),
  clienteNombre: z.string().min(1, 'clienteNombre requerido'),
  clienteDireccion: z.string().min(1, 'clienteDireccion requerido'),
  clienteTelefono: z.string().default(''),
  items: z.array(z.string()).min(1, 'items requerido (array no vacío)'),
  total: z.number().positive('total debe ser positivo'),
  subtotal: z.number().optional(),
  serviceCost: z.number().optional(),
  localId: z.string().optional(),
  codigoVerificacion: z.string().optional(),
  batchId: z.string().nullable().optional(),
  batchIndex: z.number().int().nullable().optional(),
  batchLeaderLocalId: z.string().nullable().optional(),
  deliveryType: z.enum(['delivery', 'pickup']).optional(),
  paymentMethod: z.enum(['efectivo', 'transferencia']).optional(),
  paymentConfirmed: z.boolean().optional(),
  itemsCart: z.object({
    localId: z.string().min(1),
    items: z.array(itemsCartItemSchema).min(1),
  }).optional(),
});

export type PedidoPostInput = z.infer<typeof pedidoPostSchema>;
