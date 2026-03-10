import { z } from 'zod';

const linkTypeEnum = z.enum(['category', 'route', 'url'], {
  error: 'linkType debe ser category, route o url',
});

export const bannerPostSchema = z.object({
  imageUrl: z.string().min(1, 'La URL de la imagen es requerida'),
  alt: z.string().max(200, 'Alt demasiado largo').optional(),
  linkType: linkTypeEnum.optional(),
  linkValue: z.string().max(500, 'linkValue demasiado largo').optional(),
  order: z.number().int().min(0, 'El orden debe ser un número positivo').optional(),
  active: z.boolean().optional(),
});

export const bannerPatchSchema = z.object({
  imageUrl: z.string().min(1, 'La URL de la imagen no puede estar vacía').optional(),
  alt: z.string().max(200, 'Alt demasiado largo').optional(),
  linkType: linkTypeEnum.optional(),
  linkValue: z.string().max(500, 'linkValue demasiado largo').optional(),
  order: z.number().int().min(0, 'El orden debe ser un número positivo').optional(),
  active: z.boolean().optional(),
});

export type BannerPostInput = z.infer<typeof bannerPostSchema>;
export type BannerPatchInput = z.infer<typeof bannerPatchSchema>;
