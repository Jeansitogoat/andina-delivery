import { z } from 'zod';

const fcmTargetEnum = z.enum(['central', 'rider', 'restaurant', 'user'], {
  error: 'target debe ser central, rider, restaurant o user',
});

export const fcmSendPostSchema = z.object({
  target: fcmTargetEnum,
  uid: z.string().optional(),
  title: z.string().min(1, 'El título es requerido'),
  body: z.string().min(1, 'El cuerpo del mensaje es requerido'),
  data: z.record(z.string(), z.string()).optional(),
});

export type FcmSendPostInput = z.infer<typeof fcmSendPostSchema>;
