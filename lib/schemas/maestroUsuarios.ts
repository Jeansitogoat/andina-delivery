import { z } from 'zod';

export const maestroUsuariosPostSchema = z.object({
  email: z.string().email('El correo no es válido').min(1, 'El email es requerido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  rol: z.enum(['central', 'local'], { error: 'El rol debe ser central o local' }).optional(),
  displayName: z.string().optional(),
  localId: z.string().optional(),
});

export type MaestroUsuariosPostInput = z.infer<typeof maestroUsuariosPostSchema>;
