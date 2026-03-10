import { z } from "zod/v4"

import type { FormState } from "@/lib/types"

export const createBioPageSchema = z.object({
  tenantId: z.uuid(),
  slug: z
    .string()
    .min(1, "Slug é obrigatório")
    .regex(/^[a-z0-9-]+$/, "Slug inválido"),
  name: z.string().min(1, "Nome é obrigatório"),
})

export const updateBioPageSchema = z.object({
  id: z.uuid(),
  tenantId: z.uuid(),
  slug: z
    .string()
    .min(1, "Slug é obrigatório")
    .regex(/^[a-z0-9-]+$/, "Slug inválido"),
  name: z.string().min(1, "Nome é obrigatório"),
  active: z.boolean(),
})

export type BioPageFormState = FormState<{
  name: string
  slug: string
  active?: boolean
}>
