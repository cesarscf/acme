"use server"

import { db } from "@/db"
import { offers } from "@/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import {
  createOfferSchema,
  updateOfferSchema,
} from "@/lib/validations/offers"

export async function createOfferAction(
  _prevState: unknown,
  formData: FormData
) {
  const parsed = createOfferSchema.safeParse({
    tenantId: formData.get("tenant_id"),
    slug: formData.get("slug"),
    title: formData.get("title"),
    description: formData.get("description"),
    url: formData.get("url"),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    await db.insert(offers).values(parsed.data)
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("unique")) {
      return { error: "Slug ja esta em uso neste tenant" }
    }
    return { error: "Erro ao criar oferta" }
  }

  revalidatePath(`/dashboard/tenants/${parsed.data.tenantId}`)
  return { success: true }
}

export async function updateOfferAction(
  _prevState: unknown,
  formData: FormData
) {
  const parsed = updateOfferSchema.safeParse({
    id: formData.get("id"),
    tenantId: formData.get("tenant_id"),
    slug: formData.get("slug"),
    title: formData.get("title"),
    description: formData.get("description"),
    url: formData.get("url"),
    active: formData.get("active"),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { id, tenantId, ...data } = parsed.data

  try {
    await db
      .update(offers)
      .set(data)
      .where(eq(offers.id, id))
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("unique")) {
      return { error: "Slug ja esta em uso neste tenant" }
    }
    return { error: "Erro ao atualizar oferta" }
  }

  revalidatePath(`/dashboard/tenants/${tenantId}/ofertas/${id}`)
  revalidatePath(`/dashboard/tenants/${tenantId}`)
  return { success: true }
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
