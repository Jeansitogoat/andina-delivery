import { z } from 'zod';

const variationSchema = z.object({ name: z.string(), price: z.number() });
const complementGroupSchema = z.object({
  groupLabel: z.string(),
  options: z.array(z.string()),
});

const menuItemSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    price: z.number(),
    description: z.string().optional(),
    category: z.string(),
    image: z.string().optional(),
    bestseller: z.boolean().optional(),
    tieneVariaciones: z.boolean().optional(),
    variaciones: z.array(variationSchema).optional(),
    tieneComplementos: z.boolean().optional(),
    complementos: z.array(complementGroupSchema).optional(),
  })
  .refine(
    (data) => {
      if (data.tieneVariaciones === true)
        return Array.isArray(data.variaciones) && data.variaciones.length >= 1;
      return true;
    },
    { message: 'Si tiene variaciones, debe haber al menos una', path: ['variaciones'] }
  )
  .refine(
    (data) => {
      if (data.tieneComplementos === true)
        return (
          Array.isArray(data.complementos) &&
          data.complementos.length >= 1 &&
          data.complementos.every((g) => Array.isArray(g.options) && g.options.length >= 1)
        );
      return true;
    },
    { message: 'Si tiene complementos, debe haber al menos un grupo con opciones', path: ['complementos'] }
  );

export const menuPatchSchema = z.object({
  items: z.array(menuItemSchema).min(1, 'Debe incluir al menos un ítem en el menú'),
});

export type MenuPatchInput = z.infer<typeof menuPatchSchema>;
