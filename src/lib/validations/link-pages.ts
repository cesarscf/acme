import { z } from "zod/v4"

import type { FormState } from "@/lib/types"

export const createLinkPageSchema = z.object({
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
})

export const updateLinkPageSchema = z.object({
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
})

export type LinkPageFormState = FormState<{
  title: string
  slug: string
  description: string
}>
