import { z } from 'zod';

export const batchAsignarPatchSchema = z.object({
  riderId: z.string().min(1, 'riderId es obligatorio'),
});

export type BatchAsignarPatchInput = z.infer<typeof batchAsignarPatchSchema>;
