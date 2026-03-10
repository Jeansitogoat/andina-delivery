import { z } from 'zod';

export const comprobantePostSchema = z.object({
  comprobanteBase64: z.string().min(1, 'El comprobante en base64 es requerido'),
  fileName: z.string().optional(),
  mimeType: z.string().optional(),
});

export type ComprobantePostInput = z.infer<typeof comprobantePostSchema>;
