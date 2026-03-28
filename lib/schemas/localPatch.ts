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
  qrEnabled: z.boolean().optional(),
  /** URL de Firebase Storage del QR/código de pago. Reemplaza codigoBase64. */
  codigoUrl: z.string().url('URL de código inválida').optional(),
  /** @deprecated Mantener para compatibilidad con documentos legacy. Usar codigoUrl. */
  codigoBase64: z.string().max(350_000, 'QR demasiado grande. Sube primero la imagen.').optional(),
  codigoMimeType: z.string().max(100).optional(),
}).nullable();

export const localPatchSchema = z
  .object({
    name: z.string().max(100, 'El nombre no puede superar 100 caracteres').optional(),
    address: z.string().max(200, 'La dirección no puede superar 200 caracteres').optional(),
    telefono: z.union([z.string().max(20, 'Teléfono demasiado largo'), z.number()]).optional().transform((v) => (v == null ? undefined : String(v))),
    status: z.enum(['active', 'suspended'], { error: 'Estado debe ser active o suspended' }).optional(),
    time: z.string().max(50, 'El tiempo estimado no puede superar 50 caracteres').optional(),
    shipping: z.number().optional(),
    /** URL de Firebase Storage o path relativo para logo */
    logo: z.string().max(500).optional(),
    /** URL de Firebase Storage o path relativo para portada */
    cover: z.string().max(500).optional(),
    horarios: z.array(horarioSchema).optional(),
    cerradoHasta: z.string().nullable().optional(),
    categories: z.array(z.string().max(50)).max(20).optional(),
    /** Categorías de discovery (Home); al guardar se sincroniza `type` con la primera. */
    categorias: z.array(z.string().max(50)).max(10).optional(),
    lat: z.preprocess((v) => (v === '' || v == null ? undefined : v), z.coerce.number().optional()),
    lng: z.preprocess((v) => (v === '' || v == null ? undefined : v), z.coerce.number().optional()),
    transferencia: transferenciaSchema.optional(),
    ivaEnabled: z.boolean().optional(),
    ivaRate: z.preprocess((v) => (v === '' || v == null ? undefined : v), z.coerce.number().optional()),
    /** Solo el maestro puede enviar este campo. */
    ivaPermitidoMaestro: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
  });

export type LocalPatchInput = z.infer<typeof localPatchSchema>;
