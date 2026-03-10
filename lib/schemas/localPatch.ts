import { z } from 'zod';

const horarioSchema = z.object({
  dia: z.string(),
  abierto: z.boolean(),
  desde: z.string(),
  hasta: z.string(),
});

const transferenciaSchema = z.object({
  numeroCuenta: z.string().optional(),
  cooperativa: z.string().optional(),
  titular: z.string().optional(),
  tipoCuenta: z.string().optional(),
  codigoBase64: z.string().optional(),
  codigoMimeType: z.string().optional(),
}).nullable();

export const localPatchSchema = z.object({
  name: z.string().optional(),
  address: z.string().optional(),
  telefono: z.string().optional(),
  status: z.enum(['active', 'suspended'], { error: 'Estado debe ser active o suspended' }).optional(),
  time: z.string().optional(),
  shipping: z.number().optional(),
  logo: z.string().optional(),
  cover: z.string().optional(),
  horarios: z.array(horarioSchema).optional(),
  cerradoHasta: z.string().nullable().optional(),
  categories: z.array(z.string()).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  transferencia: transferenciaSchema.optional(),
});

export type LocalPatchInput = z.infer<typeof localPatchSchema>;
