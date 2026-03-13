import { z } from "zod/v4"

import type { FormState } from "@/lib/types"

export const createPageSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().min(1, "Nome é obrigatório"),
  path: z
    .string()
    .regex(
      /^[a-z0-9/-]*$/,
      "Path inválido (use letras minúsculas, números, hífens e barras)"
    )
    .transform((v) => v || ""),
  templateSlug: z.string().min(1, "Template é obrigatório"),
})

export const updatePageSchema = z.object({
  id: z.uuid(),
  organizationId: z.string().min(1),
  name: z.string().min(1, "Nome é obrigatório"),
  path: z
    .string()
    .regex(
      /^[a-z0-9/-]*$/,
      "Path inválido (use letras minúsculas, números, hífens e barras)"
    )
    .transform((v) => v || ""),
  active: z.boolean(),
})

export type PageFormState = FormState<{
  name: string
  path: string
  templateSlug?: string
  active?: boolean
}>
