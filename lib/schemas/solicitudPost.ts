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
  // Límites de tamaño para no superar 1MiB por documento en Firestore.
  // Logo y banner: presets solicitudLogo (0.15MB) y solicitudCover (0.2MB) de compressImage.ts.
  // Base64 añade ~33% al tamaño binario, por lo que 200KB binario ≈ 270KB Base64.
  logoBase64: z.string().max(270_000, 'Logo demasiado grande. Máximo 200KB.').optional(),
  bannerBase64: z.string().max(300_000, 'Banner demasiado grande. Máximo 220KB.').optional(),
  menuFotosBase64: z.array(z.string().max(270_000, 'Cada foto de menú debe pesar máximo 200KB.')).max(4, 'Máximo 4 fotos de menú.').optional(),
});

export type SolicitudPostInput = z.infer<typeof solicitudPostSchema>;
