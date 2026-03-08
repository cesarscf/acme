"use server"

import { db } from "@/db"
import { landingPages } from "@/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod/v4"

import { getLandingPageByTenantId } from "@/lib/queries/landing-pages"
import {
  upsertLandingPageSchema,
  type LandingPageFormState,
} from "@/lib/validations/landing-pages"

export async function upsertLandingPageAction(
  _prevState: LandingPageFormState,
  formData: FormData
): Promise<LandingPageFormState> {
  const values = {
    title: formData.get("title") as string,
    description: formData.get("description") as string,
    url: formData.get("url") as string,
  }

  const parsed = upsertLandingPageSchema.safeParse({
    tenantId: formData.get("tenant_id"),
    ...values,
  })

  if (!parsed.success) {
    return {
      values,
      errors: z.flattenError(parsed.error).fieldErrors,
      success: false,
    }
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
  return { errors: null, success: true }
}
