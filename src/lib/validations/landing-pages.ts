import { z } from "zod/v4"

export const upsertLandingPageSchema = z.object({
  tenantId: z.uuid(),
  title: z
    .string()
    .optional()
    .transform((v) => v || null),
  description: z
    .string()
    .optional()
    .transform((v) => v || null),
  url: z
    .string()
    .optional()
    .transform((v) => v || null),
})
