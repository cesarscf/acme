import { z } from "zod/v4"

import type { FormState } from "@/lib/types"

export const createOrganizationSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  slug: z
    .string()
    .min(1, "Slug é obrigatório")
    .regex(
      /^[a-z0-9-]+$/,
      "Slug deve conter apenas letras minúsculas, números e hífens"
    ),
})

export const updateOrganizationSchema = z.object({
  organizationId: z.string().min(1),
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
  organizationId: z.string().min(1),
  customDomain: z.string().transform((v) => v.trim().toLowerCase() || null),
})

export type CreateOrganizationFormState = FormState<{
  name: string
  slug: string
}>

export type UpdateOrganizationFormState = FormState<{
  name: string
  slug: string
}>

export type CustomDomainFormState = FormState<{ customDomain: string }>

export type CreateOrganizationSchema = z.infer<typeof createOrganizationSchema>
export type UpdateOrganizationSchema = z.infer<typeof updateOrganizationSchema>
export type UpdateCustomDomainSchema = z.infer<typeof updateCustomDomainSchema>
