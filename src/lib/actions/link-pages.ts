"use server"

import { db } from "@/db"
import { linkPages } from "@/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { createLinkPageSchema } from "@/lib/validations/link-pages"

export async function createLinkPageAction(
  _prevState: unknown,
  formData: FormData
) {
  const parsed = createLinkPageSchema.safeParse({
    tenantId: formData.get("tenant_id"),
    slug: formData.get("slug"),
    title: formData.get("title"),
    description: formData.get("description"),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    await db.insert(linkPages).values(parsed.data)
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("unique")) {
      return { error: "Slug ja esta em uso neste tenant" }
    }
    return { error: "Erro ao criar pagina de links" }
  }

  revalidatePath(`/dashboard/tenants/${parsed.data.tenantId}`)
  return { success: true }
}

export async function deleteLinkPageAction(
  _prevState: unknown,
  formData: FormData
) {
  const id = formData.get("id") as string
  const tenantId = formData.get("tenant_id") as string
  await db.delete(linkPages).where(eq(linkPages.id, id))
  revalidatePath(`/dashboard/tenants/${tenantId}`)
  return { success: true }
}
