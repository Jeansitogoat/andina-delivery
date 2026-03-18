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

  // Fase 1: URLs de Firebase Storage reemplazan los campos Base64.
  // Se mantienen los campos Base64 con límite estricto para compatibilidad y fallback.
  /** URL de Firebase Storage del logo. Preferir sobre logoBase64. */
  logoUrl: z.string().url('URL de logo inválida').optional(),
  /** URL de Firebase Storage del banner. Preferir sobre bannerBase64. */
  bannerUrl: z.string().url('URL de banner inválida').optional(),
  /** URLs de Firebase Storage de fotos del menú. Preferir sobre menuFotosBase64. */
  menuFotosUrls: z.array(z.string().url('URL de foto inválida')).max(4).optional(),

  /** @deprecated Usar logoUrl. Límite de 270KB para no superar 1MiB de documento Firestore. */
  logoBase64: z.string().max(270_000, 'Logo demasiado grande. Máximo 200KB.').optional(),
  /** @deprecated Usar bannerUrl. */
  bannerBase64: z.string().max(300_000, 'Banner demasiado grande. Máximo 220KB.').optional(),
  /** @deprecated Usar menuFotosUrls. */
  menuFotosBase64: z.array(z.string().max(270_000, 'Cada foto de menú debe pesar máximo 200KB.')).max(4, 'Máximo 4 fotos de menú.').optional(),
});

export type SolicitudPostInput = z.infer<typeof solicitudPostSchema>;
