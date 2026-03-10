import { z } from 'zod';

export const configCarruselPatchSchema = z.object({
  intervalSeconds: z.number().int().min(2, 'El intervalo debe ser al menos 2 segundos').max(60, 'El intervalo no puede superar 60 segundos').optional(),
});

export type ConfigCarruselPatchInput = z.infer<typeof configCarruselPatchSchema>;
