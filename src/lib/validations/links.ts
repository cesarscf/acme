import { z } from "zod/v4"

export const createLinkSchema = z.object({
  linkPageId: z.uuid(),
  title: z.string().min(1, "Titulo e obrigatorio"),
  url: z.url("URL invalida"),
  position: z.coerce.number().int().default(0),
})
