import { z } from 'zod';

export const localPostSchema = z.object({
  name: z.string().min(1, 'El nombre del local es obligatorio'),
  address: z.string().optional(),
  telefono: z.string().optional(),
  time: z.string().optional(),
  logo: z.string().optional(),
  cover: z.string().optional(),
  ownerName: z.string().optional(),
  ownerPhone: z.string().optional(),
  ownerEmail: z.union([z.string().email('El correo del titular no es válido'), z.literal('')]).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export type LocalPostInput = z.infer<typeof localPostSchema>;
