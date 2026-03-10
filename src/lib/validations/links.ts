import { z } from "zod/v4"

import type { FormState } from "@/lib/types"

export const createLinkSchema = z.object({
  bioPageId: z.uuid(),
  title: z.string().min(1, "Título é obrigatório"),
  url: z.url("URL inválida"),
  position: z.coerce.number().int().default(0),
})

export type CreateLinkFormState = FormState<{ title: string; url: string }>
