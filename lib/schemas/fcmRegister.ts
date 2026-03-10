import { z } from 'zod';

const FCM_ROLES = ['central', 'rider', 'restaurant', 'user'] as const;

export const fcmRegisterSchema = z.object({
  token: z.string().min(1, 'El token es requerido'),
  role: z.enum(FCM_ROLES, { error: 'El rol debe ser central, rider, restaurant o user' }),
  localId: z.string().optional(),
});

export type FcmRegisterInput = z.infer<typeof fcmRegisterSchema>;
