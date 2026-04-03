import { z } from 'zod';

/** POST /api/mandados — cuerpo liviano, sin anidación. */
export const mandadoPostSchema = z.object({
  categoria: z.string().max(80).optional().default(''),
  descripcion: z.string().min(3).max(500),
  desdeTexto: z.string().min(3).max(500),
  hastaTexto: z.string().min(3).max(500),
  desdeLat: z.number().finite().min(-90).max(90),
  desdeLng: z.number().finite().min(-180).max(180),
  hastaLat: z.number().finite().min(-90).max(90),
  hastaLng: z.number().finite().min(-180).max(180),
  clienteTelefono: z.string().max(20).optional().default(''),
});

export type MandadoPostBody = z.infer<typeof mandadoPostSchema>;
