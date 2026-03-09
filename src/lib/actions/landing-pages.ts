"use server"

import { db } from "@/db"
import { landingPages } from "@/db/schema"
import { and, eq, ne } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod/v4"

import {
  createLandingPageSchema,
  updateLandingPageSchema,
  type LandingPageFormState,
} from "@/lib/validations/landing-pages"

export async function createLandingPageAction(
  _prevState: LandingPageFormState,
  formData: FormData
): Promise<LandingPageFormState> {
  const values = {
    title: formData.get("title") as string,
    slug: formData.get("slug") as string,
    description: formData.get("description") as string,
    url: formData.get("url") as string,
  }

  const result = createLandingPageSchema.safeParse({
    tenantId: formData.get("tenant_id"),
    ...values,
  })

  if (!result.success) {
    return {
      values,
      errors: z.flattenError(result.error).fieldErrors,
      success: false,
    }
  }

  const existing = await db.query.landingPages.findFirst({
    where: and(
      eq(landingPages.tenantId, result.data.tenantId),
      eq(landingPages.slug, result.data.slug)
    ),
  })

  if (existing) {
    return {
      values,
      errors: {
        slug: [
          result.data.slug === ""
            ? "Já existe uma landing page na raiz"
            : "Slug já está em uso neste tenant",
        ],
      },
      success: false,
    }
  }

  await db.insert(landingPages).values(result.data)

  revalidatePath(`/dashboard/tenants/${result.data.tenantId}`)
  return { errors: null, success: true }
}

export async function updateLandingPageAction(
  _prevState: LandingPageFormState,
  formData: FormData
): Promise<LandingPageFormState> {
  const values = {
    title: formData.get("title") as string,
    slug: formData.get("slug") as string,
    description: formData.get("description") as string,
    url: formData.get("url") as string,
  }

  const result = updateLandingPageSchema.safeParse({
    id: formData.get("id"),
    tenantId: formData.get("tenant_id"),
    ...values,
  })

  if (!result.success) {
    return {
      values,
      errors: z.flattenError(result.error).fieldErrors,
      success: false,
    }
  }

  const { id, tenantId, ...data } = result.data

  const existing = await db.query.landingPages.findFirst({
    where: and(
      eq(landingPages.tenantId, tenantId),
      eq(landingPages.slug, data.slug),
      ne(landingPages.id, id)
    ),
  })

  if (existing) {
    return {
      values,
      errors: {
        slug: [
          data.slug === ""
            ? "Já existe uma landing page na raiz"
            : "Slug já está em uso neste tenant",
        ],
      },
      success: false,
    }
  }

  await db
    .update(landingPages)
    .set(data)
    .where(eq(landingPages.id, id))

  revalidatePath(`/dashboard/tenants/${tenantId}/landing-pages/${id}`)
  revalidatePath(`/dashboard/tenants/${tenantId}`)
  return { errors: null, success: true }
}

export async function deleteLandingPageAction(
  _prevState: unknown,
  formData: FormData
) {
  const id = formData.get("id") as string
  const tenantId = formData.get("tenant_id") as string
  await db.delete(landingPages).where(eq(landingPages.id, id))
  revalidatePath(`/dashboard/tenants/${tenantId}`)
  redirect(`/dashboard/tenants/${tenantId}`)
}
