import { z } from "zod/v4"

export const createOfferSchema = z.object({
  tenantId: z.string().uuid(),
  slug: z
    .string()
    .min(1, "Slug e obrigatorio")
    .regex(/^[a-z0-9-]+$/, "Slug invalido"),
  title: z.string().min(1, "Titulo e obrigatorio"),
  description: z
    .string()
    .optional()
    .transform((v) => v || null),
  url: z
    .string()
    .url("URL invalida")
    .optional()
    .transform((v) => v || null),
})
