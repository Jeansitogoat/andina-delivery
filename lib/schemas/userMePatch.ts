import { z } from 'zod';

export const userMePatchSchema = z.object({
  displayName: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    z.string().min(1, 'El nombre es obligatorio').max(100, 'El nombre es demasiado largo').optional()
  ),
  telefono: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    z
      .union([z.string().max(20, 'Teléfono demasiado largo'), z.number()])
      .optional()
      .transform((v) => (v == null ? undefined : String(v).trim() || undefined))
  ),
});

export type UserMePatchInput = z.infer<typeof userMePatchSchema>;
