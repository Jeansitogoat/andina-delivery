import { z } from 'zod';

export const configTransferenciaPatchSchema = z.object({
  cuenta: z.string().optional(),
  banco: z.string().optional(),
  qr: z.string().optional(),
  whatsappAdmin: z.string().optional(),
  cycleDays: z.union([z.literal(7), z.literal(15), z.literal(30)], {
    error: 'cycleDays debe ser 7, 15 o 30',
  }).optional(),
  programStartDate: z.string().optional(),
});

export type ConfigTransferenciaPatchInput = z.infer<typeof configTransferenciaPatchSchema>;
