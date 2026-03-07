"use server"

import { db } from "@/db"
import { links } from "@/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { createLinkSchema } from "@/lib/validations/links"

export async function createLinkAction(
  _prevState: unknown,
  formData: FormData
) {
  const parsed = createLinkSchema.safeParse({
    linkPageId: formData.get("link_page_id"),
    title: formData.get("title"),
    url: formData.get("url"),
    position: formData.get("position"),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  await db.insert(links).values(parsed.data)
  const tenantId = formData.get("tenant_id") as string
  revalidatePath(`/dashboard/tenants/${tenantId}`)
  return { success: true }
}

export async function deleteLinkAction(
  _prevState: unknown,
  formData: FormData
) {
  const id = formData.get("id") as string
  const tenantId = formData.get("tenant_id") as string
  await db.delete(links).where(eq(links.id, id))
  revalidatePath(`/dashboard/tenants/${tenantId}`)
  return { success: true }
}
