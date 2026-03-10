import { z } from 'zod';

export const comisionPatchSchema = z.object({
  pagado: z.boolean({ error: 'pagado es requerido (true o false)' }),
});

export type ComisionPatchInput = z.infer<typeof comisionPatchSchema>;
