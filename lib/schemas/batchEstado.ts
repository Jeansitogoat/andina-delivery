import { z } from 'zod';

export const batchEstadoPatchSchema = z.object({
  estado: z.literal('en_camino', { error: 'El estado debe ser en_camino' }),
});

export type BatchEstadoPatchInput = z.infer<typeof batchEstadoPatchSchema>;
