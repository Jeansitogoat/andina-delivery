import { z } from 'zod';

const horarioSchema = z.object({
  dia: z.string(),
  abierto: z.boolean(),
  desde: z.string(),
  hasta: z.string(),
});

// Fase 1: codigoBase64/codigoMimeType reemplazados por codigoUrl (downloadURL de Firebase Storage).
// Los campos Base64 se mantienen opcionalmente para compatibilidad con documentos legacy en Firestore.
const transferenciaSchema = z.object({
  numeroCuenta: z.string().optional(),
  cooperativa: z.string().optional(),
  titular: z.string().optional(),
  tipoCuenta: z.string().optional(),
  /** URL de Firebase Storage del QR/código de pago. Reemplaza codigoBase64. */
  codigoUrl: z.string().url('URL de código inválida').optional(),
  /** @deprecated Mantener para compatibilidad con documentos legacy. Usar codigoUrl. */
  codigoBase64: z.string().max(350_000, 'QR demasiado grande. Sube primero la imagen.').optional(),
  codigoMimeType: z.string().max(100).optional(),
}).nullable();

export const localPatchSchema = z.object({
  name: z.string().optional(),
  address: z.string().optional(),
  telefono: z.string().optional(),
  status: z.enum(['active', 'suspended'], { error: 'Estado debe ser active o suspended' }).optional(),
  time: z.string().optional(),
  shipping: z.number().optional(),
  /** URL de Firebase Storage o path relativo para logo */
  logo: z.string().optional(),
  /** URL de Firebase Storage o path relativo para portada */
  cover: z.string().optional(),
  horarios: z.array(horarioSchema).optional(),
  cerradoHasta: z.string().nullable().optional(),
  categories: z.array(z.string()).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  transferencia: transferenciaSchema.optional(),
  isFeatured: z.boolean().optional(),
});

export type LocalPatchInput = z.infer<typeof localPatchSchema>;
