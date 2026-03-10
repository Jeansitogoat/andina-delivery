import { z } from 'zod';

export const riderEstadoPatchSchema = z.object({
  estadoRider: z.enum(['disponible', 'ausente', 'fuera_servicio'], {
    error: 'estadoRider debe ser: disponible, ausente o fuera_servicio',
  }),
});

export type RiderEstadoPatchInput = z.infer<typeof riderEstadoPatchSchema>;
