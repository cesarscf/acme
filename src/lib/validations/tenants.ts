import { z } from "zod/v4"

import type { FormState } from "@/lib/types"

export const createTenantSchema = z.object({
  name: z.string().min(1, "Nome e obrigatorio"),
  slug: z
    .string()
    .min(1, "Slug e obrigatorio")
    .regex(
      /^[a-z0-9-]+$/,
      "Slug deve conter apenas letras minusculas, numeros e hifens"
    ),
})

export type CreateTenantFormState = FormState<{ name: string; slug: string }>
