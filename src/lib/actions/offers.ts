"use server"

import { db } from "@/db"
import { offers } from "@/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { createOfferSchema } from "@/lib/validations/offers"

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

export async function deleteOfferAction(
  _prevState: unknown,
  formData: FormData
) {
  const id = formData.get("id") as string
  const tenantId = formData.get("tenant_id") as string
  await db.delete(offers).where(eq(offers.id, id))
  revalidatePath(`/dashboard/tenants/${tenantId}`)
  return { success: true }
}
