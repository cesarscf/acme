import { z } from "zod/v4"

export const createLinkPageSchema = z.object({
  tenantId: z.uuid(),
  slug: z
    .string()
    .min(1, "Slug e obrigatorio")
    .regex(/^[a-z0-9-]+$/, "Slug invalido"),
  title: z.string().min(1, "Titulo e obrigatorio"),
  description: z
    .string()
    .optional()
    .transform((v) => v || null),
})

export const updateLinkPageSchema = z.object({
  id: z.uuid(),
  tenantId: z.uuid(),
  slug: z
    .string()
    .min(1, "Slug e obrigatorio")
    .regex(/^[a-z0-9-]+$/, "Slug invalido"),
  title: z.string().min(1, "Titulo e obrigatorio"),
  description: z
    .string()
    .optional()
    .transform((v) => v || null),
})
