"use server"

import { db } from "@/db"
import { bioPages } from "@/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod/v4"

import {
  createBioPageSchema,
  updateBioPageSchema,
  type BioPageFormState,
} from "@/lib/validations/bio-pages"

export async function createBioPageAction(
  _prevState: BioPageFormState,
  formData: FormData
): Promise<BioPageFormState> {
  const values = {
    name: formData.get("name") as string,
    slug: formData.get("slug") as string,
  }

  const result = createBioPageSchema.safeParse({
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
      .insert(bioPages)
      .values(result.data)
      .returning({ id: bioPages.id })
    createdId = created.id
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("unique")) {
      return {
        values,
        errors: { slug: ["Slug já está em uso neste tenant"] },
        success: false,
      }
    }
    return {
      values,
      errors: { _root: ["Erro ao criar bio page"] },
      success: false,
    }
  }

  revalidatePath(`/dashboard/tenants/${result.data.tenantId}`)
  redirect(`/dashboard/tenants/${result.data.tenantId}/bios/${createdId}`)
}

export async function updateBioPageAction(
  _prevState: BioPageFormState,
  formData: FormData
): Promise<BioPageFormState> {
  const values = {
    name: formData.get("name") as string,
    slug: formData.get("slug") as string,
    active: formData.get("active") === "true",
  }

  const result = updateBioPageSchema.safeParse({
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
      .update(bioPages)
      .set(data)
      .where(eq(bioPages.id, id))
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("unique")) {
      return {
        values,
        errors: { slug: ["Slug já está em uso neste tenant"] },
        success: false,
      }
    }
    return {
      values,
      errors: { _root: ["Erro ao atualizar bio page"] },
      success: false,
    }
  }

  revalidatePath(`/dashboard/tenants/${tenantId}/bios/${id}`)
  revalidatePath(`/dashboard/tenants/${tenantId}`)
  return { errors: null, success: true }
}

export async function deleteBioPageAction(
  _prevState: unknown,
  formData: FormData
) {
  const id = formData.get("id") as string
  const tenantId = formData.get("tenant_id") as string
  await db.delete(bioPages).where(eq(bioPages.id, id))
  revalidatePath(`/dashboard/tenants/${tenantId}`)
  redirect(`/dashboard/tenants/${tenantId}`)
}
