"use server"

import { db } from "@/db"
import { landingPages } from "@/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { getLandingPageByTenantId } from "@/lib/queries/landing-pages"
import { upsertLandingPageSchema } from "@/lib/validations/landing-pages"

export async function upsertLandingPageAction(
  _prevState: unknown,
  formData: FormData
) {
  const parsed = upsertLandingPageSchema.safeParse({
    tenantId: formData.get("tenant_id"),
    title: formData.get("title"),
    description: formData.get("description"),
    url: formData.get("url"),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { tenantId, title, description, url } = parsed.data
  const existing = await getLandingPageByTenantId(tenantId)
  const isEmpty = !title && !description && !url

  if (isEmpty && existing) {
    await db.delete(landingPages).where(eq(landingPages.id, existing.id))
  } else if (!isEmpty && existing) {
    await db
      .update(landingPages)
      .set({
        title: title ?? "",
        description,
        url,
      })
      .where(eq(landingPages.id, existing.id))
  } else if (!isEmpty) {
    await db.insert(landingPages).values({
      tenantId,
      slug: "default",
      title: title ?? "",
      description,
      url,
    })
  }

  revalidatePath(`/dashboard/tenants/${tenantId}`)
  return { success: true }
}
