import { z } from 'zod';

export const calificarPostSchema = z.object({
  estrellasLocal: z.number().min(0, 'Las estrellas del local deben ser entre 0 y 5').max(5, 'Las estrellas del local deben ser entre 0 y 5').optional(),
  estrellasRider: z.number().min(0, 'Las estrellas del rider deben ser entre 0 y 5').max(5, 'Las estrellas del rider deben ser entre 0 y 5').optional(),
  reseñaLocal: z.string().max(500, 'La reseña no puede superar 500 caracteres').optional(),
});

export type CalificarPostInput = z.infer<typeof calificarPostSchema>;
