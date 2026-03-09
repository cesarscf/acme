import { z } from "zod/v4"

import type { FormState } from "@/lib/types"

export const createOfferSchema = z.object({
  tenantId: z.uuid(),
  slug: z
    .string()
    .min(1, "Slug é obrigatório")
    .regex(/^[a-z0-9-]+$/, "Slug inválido"),
  title: z.string().min(1, "Título é obrigatório"),
  description: z
    .string()
    .optional()
    .transform((v) => v || null),
  url: z
    .url("URL inválida")
    .optional()
    .transform((v) => v || null),
})

export const updateOfferSchema = z.object({
  id: z.uuid(),
  tenantId: z.uuid(),
  slug: z
    .string()
    .min(1, "Slug é obrigatório")
    .regex(/^[a-z0-9-]+$/, "Slug inválido"),
  title: z.string().min(1, "Título é obrigatório"),
  description: z
    .string()
    .optional()
    .transform((v) => v || null),
  url: z
    .url("URL inválida")
    .optional()
    .transform((v) => v || null),
  active: z
    .string()
    .optional()
    .transform((v) => v === "on"),
})

export type CreateOfferFormState = FormState<{
  title: string
  slug: string
  description: string
  url: string
}>

export type UpdateOfferFormState = FormState<{
  title: string
  slug: string
  description: string
  url: string
  active: string
}>
