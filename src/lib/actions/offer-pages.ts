"use server"

import { db } from "@/db"
import { offerPages } from "@/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod/v4"

import {
  createOfferPageSchema,
  updateOfferPageSchema,
  type CreateOfferPageFormState,
  type UpdateOfferPageFormState,
} from "@/lib/validations/offer-pages"

export async function createOfferPageAction(
  _prevState: CreateOfferPageFormState,
  formData: FormData
): Promise<CreateOfferPageFormState> {
  const values = {
    name: formData.get("name") as string,
    slug: formData.get("slug") as string,
    url: (formData.get("url") as string) || undefined,
  }

  const result = createOfferPageSchema.safeParse({
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

  let createdId: string
  try {
    const [created] = await db
      .insert(offerPages)
      .values(result.data)
      .returning({ id: offerPages.id })
    createdId = created.id
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("unique")) {
      return {
        values,
        errors: { slug: ["Slug ja esta em uso neste tenant"] },
        success: false,
      }
    }
    return {
      values,
      errors: { _root: ["Erro ao criar oferta"] },
      success: false,
    }
  }

  revalidatePath(`/dashboard/tenants/${result.data.tenantId}`)
  redirect(`/dashboard/tenants/${result.data.tenantId}/offers/${createdId}`)
}

export async function updateOfferPageAction(
  _prevState: UpdateOfferPageFormState,
  formData: FormData
): Promise<UpdateOfferPageFormState> {
  const values = {
    name: formData.get("name") as string,
    slug: formData.get("slug") as string,
    url: (formData.get("url") as string) || undefined,
    active: formData.get("active") === "true",
  }

  const result = updateOfferPageSchema.safeParse({
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

  try {
    await db
      .update(offerPages)
      .set(data)
      .where(eq(offerPages.id, id))
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("unique")) {
      return {
        values,
        errors: { slug: ["Slug ja esta em uso neste tenant"] },
        success: false,
      }
    }
    return {
      values,
      errors: { _root: ["Erro ao atualizar oferta"] },
      success: false,
    }
  }

  revalidatePath(`/dashboard/tenants/${tenantId}/offers/${id}`)
  revalidatePath(`/dashboard/tenants/${tenantId}`)
  return { errors: null, success: true }
}

export async function deleteOfferPageAction(
  _prevState: unknown,
  formData: FormData
) {
  const id = formData.get("id") as string
  const tenantId = formData.get("tenant_id") as string
  await db.delete(offerPages).where(eq(offerPages.id, id))
  revalidatePath(`/dashboard/tenants/${tenantId}`)
  redirect(`/dashboard/tenants/${tenantId}`)
}
