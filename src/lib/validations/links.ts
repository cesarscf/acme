import { z } from "zod/v4"

import type { FormState } from "@/lib/types"

export const createLinkSchema = z.object({
  linkPageId: z.uuid(),
  title: z.string().min(1, "Titulo e obrigatorio"),
  url: z.url("URL invalida"),
  position: z.coerce.number().int().default(0),
})

export type CreateLinkFormState = FormState<{ title: string; url: string }>
