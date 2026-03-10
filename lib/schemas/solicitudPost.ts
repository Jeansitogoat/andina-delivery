import { z } from 'zod';

export const solicitudPostSchema = z.object({
  nombreLocal: z.string().min(1, 'El nombre del local es obligatorio').max(200, 'Nombre del local demasiado largo'),
  nombre: z.string().min(1, 'El nombre es obligatorio').max(100, 'Nombre demasiado largo'),
  apellido: z.string().min(1, 'El apellido es obligatorio').max(100, 'Apellido demasiado largo'),
  email: z.string().email('El correo no es válido').max(200, 'Email demasiado largo'),
  telefono: z.string().min(1, 'El teléfono es obligatorio').max(30, 'Teléfono demasiado largo'),
  telefonoLocal: z.string().min(1, 'El teléfono del local es obligatorio').max(30, 'Teléfono demasiado largo'),
  direccion: z.string().min(1, 'La dirección es obligatoria').max(500, 'Dirección demasiado larga'),
  tipoNegocio: z.string().min(1, 'El tipo de negocio es obligatorio').max(100, 'Tipo de negocio demasiado largo'),
  localACalle: z.boolean().optional(),
  logoBase64: z.string().optional(),
  bannerBase64: z.string().optional(),
  menuFotosBase64: z.array(z.string()).optional(),
});

export type SolicitudPostInput = z.infer<typeof solicitudPostSchema>;
