import { z } from 'zod';

export const riderEstadoPatchSchema = z.object({
  estadoRider: z.enum(['disponible', 'fuera_servicio'], {
    error: 'estadoRider debe ser: disponible o fuera_servicio',
  }),
});

export type RiderEstadoPatchInput = z.infer<typeof riderEstadoPatchSchema>;
