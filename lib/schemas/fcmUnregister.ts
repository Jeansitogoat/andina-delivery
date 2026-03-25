import { z } from 'zod';
import { FCM_ROLES } from '@/lib/schemas/fcmRegister';

export const fcmUnregisterPostSchema = z.object({
  role: z.enum(FCM_ROLES, { error: 'El rol debe ser central, rider, local o user' }).optional(),
});

export type FcmUnregisterPostInput = z.infer<typeof fcmUnregisterPostSchema>;
