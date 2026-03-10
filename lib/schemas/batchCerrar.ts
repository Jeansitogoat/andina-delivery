import { z } from 'zod';

export const batchCerrarPostSchema = z.object({
  batchId: z.string().min(1, 'batchId es obligatorio'),
  codigo: z.string().min(1, 'El código es obligatorio'),
});

export type BatchCerrarPostInput = z.infer<typeof batchCerrarPostSchema>;
