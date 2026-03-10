import { z } from 'zod';

const tierSchema = z.object({
  kmMax: z.number().nullable(),
  tarifa: z.number().min(0, 'La tarifa debe ser mayor o igual a cero'),
});

export const configTarifasPatchSchema = z.object({
  tiers: z.array(tierSchema).min(1, 'Debe incluir al menos un tier').optional(),
  porParadaAdicional: z.number().min(0, 'El costo por parada debe ser mayor o igual a cero').optional(),
});

export type ConfigTarifasPatchInput = z.infer<typeof configTarifasPatchSchema>;
