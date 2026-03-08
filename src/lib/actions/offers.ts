"use server"

import { db } from "@/db"
import { offers } from "@/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod/v4"

import {
  createOfferSchema,
  updateOfferSchema,
  type CreateOfferFormState,
  type UpdateOfferFormState,
} from "@/lib/validations/offers"

export async function createOfferAction(
  _prevState: CreateOfferFormState,
  formData: FormData
): Promise<CreateOfferFormState> {
  const values = {
    title: formData.get("title") as string,
    slug: formData.get("slug") as string,
    description: formData.get("description") as string,
    url: formData.get("url") as string,
  }

  const result = createOfferSchema.safeParse({
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

  try {
    await db.insert(offers).values(result.data)
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
  return { errors: null, success: true }
}

export async function updateOfferAction(
  _prevState: UpdateOfferFormState,
  formData: FormData
): Promise<UpdateOfferFormState> {
  const values = {
    title: formData.get("title") as string,
    slug: formData.get("slug") as string,
    description: formData.get("description") as string,
    url: formData.get("url") as string,
    active: formData.get("active") as string,
  }

  const result = updateOfferSchema.safeParse({
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
      .update(offers)
      .set(data)
      .where(eq(offers.id, id))
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

  revalidatePath(`/dashboard/tenants/${tenantId}/ofertas/${id}`)
  revalidatePath(`/dashboard/tenants/${tenantId}`)
  return { errors: null, success: true }
}

export async function deleteOfferAction(
  _prevState: unknown,
  formData: FormData
) {
  const id = formData.get("id") as string
  const tenantId = formData.get("tenant_id") as string
  await db.delete(offers).where(eq(offers.id, id))
  revalidatePath(`/dashboard/tenants/${tenantId}`)
  redirect(`/dashboard/tenants/${tenantId}`)
}
