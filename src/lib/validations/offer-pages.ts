import { z } from "zod/v4"

import type { FormState } from "@/lib/types"

export const createOfferPageSchema = z.object({
  tenantId: z.uuid(),
  slug: z
    .string()
    .min(1, "Slug é obrigatório")
    .regex(/^[a-z0-9-]+$/, "Slug inválido"),
  name: z.string().min(1, "Nome é obrigatório"),
  url: z
    .url("URL inválida")
    .optional()
    .transform((v) => v || null),
})

export const updateOfferPageSchema = z.object({
  id: z.uuid(),
  tenantId: z.uuid(),
  slug: z
    .string()
    .min(1, "Slug é obrigatório")
    .regex(/^[a-z0-9-]+$/, "Slug inválido"),
  name: z.string().min(1, "Nome é obrigatório"),
  url: z
    .url("URL inválida")
    .optional()
    .transform((v) => v || null),
  active: z.boolean(),
})

export type CreateOfferPageFormState = FormState<{
  name: string
  slug: string
  url?: string
}>

export type UpdateOfferPageFormState = FormState<{
  name: string
  slug: string
  url?: string
  active?: boolean
}>
