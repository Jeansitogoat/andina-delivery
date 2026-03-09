import { z } from 'zod';

const FCM_ROLES = ['central', 'rider', 'restaurant', 'user'] as const;

export const fcmRegisterSchema = z.object({
  token: z.string().min(1, 'token requerido'),
  role: z.enum(FCM_ROLES),
  localId: z.string().optional(),
});

export type FcmRegisterInput = z.infer<typeof fcmRegisterSchema>;
