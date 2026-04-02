import { z } from 'zod';

/** POST /api/mandados — cuerpo liviano, sin anidación. */
export const mandadoPostSchema = z.object({
  categoria: z.string().max(80).optional().default(''),
  descripcion: z.string().min(3).max(500),
  desdeTexto: z.string().min(3).max(500),
  hastaTexto: z.string().min(3).max(500),
  desdeLat: z.number().min(-90).max(90).nullable().optional(),
  desdeLng: z.number().min(-180).max(180).nullable().optional(),
  hastaLat: z.number().min(-90).max(90).nullable().optional(),
  hastaLng: z.number().min(-180).max(180).nullable().optional(),
  clienteTelefono: z.string().max(20).optional().default(''),
});

export type MandadoPostBody = z.infer<typeof mandadoPostSchema>;
