import { z } from "zod/v4"

import type { FormState } from "@/lib/types"

export const createTenantSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  slug: z
    .string()
    .min(1, "Slug é obrigatório")
    .regex(
      /^[a-z0-9-]+$/,
      "Slug deve conter apenas letras minúsculas, números e hífens"
    ),
})

export const updateTenantSchema = z.object({
  tenantId: z.uuid(),
  name: z.string().min(1, "Nome é obrigatório"),
  slug: z
    .string()
    .min(1, "Slug é obrigatório")
    .regex(
      /^[a-z0-9-]+$/,
      "Slug deve conter apenas letras minúsculas, números e hífens"
    ),
})

export const updateCustomDomainSchema = z.object({
  tenantId: z.uuid(),
  customDomain: z.string().transform((v) => v.trim().toLowerCase() || null),
})

export type CreateTenantFormState = FormState<{ name: string; slug: string }>

export type UpdateTenantFormState = FormState<{ name: string; slug: string }>

export type CustomDomainFormState = FormState<{ customDomain: string }>
