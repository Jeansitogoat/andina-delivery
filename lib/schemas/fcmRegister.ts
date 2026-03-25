import { z } from 'zod';

// Roles unificados: coinciden con los roles de usuario de la app
// 'local' reemplaza 'restaurant' para consistencia en todo el flujo FCM
export const FCM_ROLES = ['central', 'rider', 'local', 'user'] as const;
export type FcmRole = (typeof FCM_ROLES)[number];

export const fcmRegisterSchema = z.object({
  token: z.string().min(1, 'El token es requerido'),
  role: z.enum(FCM_ROLES, { error: 'El rol debe ser central, rider, local o user' }),
  // uid opcional en body: se valida contra auth.uid para evitar spoofing
  uid: z.string().optional(),
  localId: z.string().optional(),
});

export type FcmRegisterInput = z.infer<typeof fcmRegisterSchema>;
