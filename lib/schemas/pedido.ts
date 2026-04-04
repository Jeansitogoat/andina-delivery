import { z } from 'zod';

export const itemsCartItemSchema = z.object({
  id: z.string().min(1, 'El ítem debe tener un id'),
  qty: z.number().int().positive('La cantidad debe ser un número entero positivo'),
  note: z.string().optional(),
  variationName: z.string().optional(),
  variationPrice: z.number().optional(),
  complementSelections: z
    .record(z.string(), z.union([z.string(), z.array(z.string())]))
    .optional(),
  displayLabel: z.string().optional(),
});

export const pedidoPostSchema = z.object({
  id: z.string().min(1, 'El id del pedido es requerido'),
  restaurante: z.string().min(1, 'El nombre del restaurante es requerido'),
  restauranteDireccion: z.string().default('—'),
  restauranteLat: z.number().optional(),
  restauranteLng: z.number().optional(),
  clienteNombre: z.string().min(1, 'El nombre del cliente es requerido'),
  clienteDireccion: z.string().min(1, 'La dirección del cliente es requerida'),
  clienteLat: z.number().optional(),
  clienteLng: z.number().optional(),
  clienteTelefono: z.string().default(''),
  items: z.array(z.string()).min(1, 'Debe incluir al menos un ítem'),
  total: z.number().positive('El total debe ser mayor que cero'),
  subtotal: z.number().optional(),
  subtotalBase: z.number().optional(),
  ivaEnabled: z.boolean().optional(),
  ivaRate: z.number().optional(),
  ivaAmount: z.number().optional(),
  subtotalConIva: z.number().optional(),
  costoEnvio: z.number().optional(),
  serviceCost: z.number().optional(),
  serviceFee: z.number().optional(),
  totalCliente: z.number().optional(),
  localId: z.string().optional(),
  codigoVerificacion: z.string().optional(),
  batchId: z.string().nullable().optional(),
  batchIndex: z.number().int().nullable().optional(),
  batchLeaderLocalId: z.string().nullable().optional(),
  deliveryType: z.enum(['delivery', 'pickup'], { error: 'Tipo de entrega debe ser delivery o pickup' }).optional(),
  paymentMethod: z.enum(['efectivo', 'transferencia'], { error: 'Método de pago debe ser efectivo o transferencia' }).optional(),
  paymentConfirmed: z.boolean().optional(),
  itemsCart: z.object({
    localId: z.string().min(1, 'localId es requerido'),
    items: z.array(itemsCartItemSchema).min(1, 'Debe incluir al menos un ítem en el carrito'),
  }).optional(),
  // Fase 1: comprobante como URL de Firebase Storage (preferido).
  /** URL de Firebase Storage del comprobante de transferencia. */
  comprobanteUrl: z.string().url('URL de comprobante inválida').optional(),
  fileName: z.string().max(255).optional(),
  mimeType: z.string().max(100).optional(),
  // @deprecated Mantener para compatibilidad con versiones anteriores del cliente.
  // Límite de 700KB para no superar el límite de 1MiB de Firestore.
  comprobanteBase64: z.string().max(700_000, 'El comprobante excede el tamaño máximo (700 KB). Comprime la imagen o sube primero a Storage.').optional(),
});

export type PedidoPostInput = z.infer<typeof pedidoPostSchema>;
