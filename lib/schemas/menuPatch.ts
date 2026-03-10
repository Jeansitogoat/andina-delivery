import { z } from 'zod';

const menuItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  description: z.string().optional(),
  category: z.string(),
  image: z.string().optional(),
});

export const menuPatchSchema = z.object({
  items: z.array(menuItemSchema).min(1, 'Debe incluir al menos un ítem en el menú'),
});

export type MenuPatchInput = z.infer<typeof menuPatchSchema>;
