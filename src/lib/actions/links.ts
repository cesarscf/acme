"use server"

import { db } from "@/db"
import { links } from "@/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod/v4"

import {
  createLinkSchema,
  type CreateLinkFormState,
} from "@/lib/validations/links"

export async function createLinkAction(
  _prevState: CreateLinkFormState,
  formData: FormData
): Promise<CreateLinkFormState> {
  const values = {
    title: formData.get("title") as string,
    url: formData.get("url") as string,
  }

  const result = createLinkSchema.safeParse({
    bioPageId: formData.get("bio_page_id"),
    position: formData.get("position"),
    ...values,
  })

  if (!result.success) {
    return {
      values,
      errors: z.flattenError(result.error).fieldErrors,
      success: false,
    }
  }

  await db.insert(links).values(result.data)
  const tenantId = formData.get("tenant_id") as string
  revalidatePath(
    `/dashboard/tenants/${tenantId}/bios/${result.data.bioPageId}`
  )
  return { errors: null, success: true }
}

export async function deleteLinkAction(
  _prevState: unknown,
  formData: FormData
) {
  const id = formData.get("id") as string
  const tenantId = formData.get("tenant_id") as string
  const bioPageId = formData.get("bio_page_id") as string
  await db.delete(links).where(eq(links.id, id))
  revalidatePath(`/dashboard/tenants/${tenantId}/bios/${bioPageId}`)
  return { success: true }
}
