import { z } from 'zod';

const FCM_ROLES = ['central', 'rider', 'restaurant', 'user'] as const;

export const fcmUnregisterPostSchema = z.object({
  role: z.enum(FCM_ROLES, { error: 'El rol debe ser central, rider, restaurant o user' }).optional(),
});

export type FcmUnregisterPostInput = z.infer<typeof fcmUnregisterPostSchema>;
