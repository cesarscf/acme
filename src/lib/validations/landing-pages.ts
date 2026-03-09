import { z } from "zod/v4"

import type { FormState } from "@/lib/types"

export const createLandingPageSchema = z.object({
  tenantId: z.uuid(),
  slug: z
    .string()
    .regex(/^[a-z0-9-]*$/, "Slug invalido")
    .transform((v) => v || ""),
  title: z.string().min(1, "Titulo e obrigatorio"),
  description: z
    .string()
    .optional()
    .transform((v) => v || null),
  url: z
    .string()
    .optional()
    .transform((v) => v || null),
})

export const updateLandingPageSchema = z.object({
  id: z.uuid(),
  tenantId: z.uuid(),
  slug: z
    .string()
    .regex(/^[a-z0-9-]*$/, "Slug invalido")
    .transform((v) => v || ""),
  title: z.string().min(1, "Titulo e obrigatorio"),
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
  slug: string
  description: string
  url: string
}>
