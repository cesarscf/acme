import { z } from "zod/v4"

import type { FormState } from "@/lib/types"

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

export type LandingPageFormState = FormState<{
  title: string
  description: string
  url: string
}>
