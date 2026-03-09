"use server"

import { db } from "@/db"
import { linkPages } from "@/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod/v4"

import {
  createLinkPageSchema,
  updateLinkPageSchema,
  type LinkPageFormState,
} from "@/lib/validations/link-pages"

export async function createLinkPageAction(
  _prevState: LinkPageFormState,
  formData: FormData
): Promise<LinkPageFormState> {
  const values = {
    title: formData.get("title") as string,
    slug: formData.get("slug") as string,
    description: formData.get("description") as string,
  }

  const result = createLinkPageSchema.safeParse({
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
    await db.insert(linkPages).values(result.data)
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
      errors: { _root: ["Erro ao criar página de links"] },
      success: false,
    }
  }

  revalidatePath(`/dashboard/tenants/${result.data.tenantId}`)
  return { errors: null, success: true }
}

export async function updateLinkPageAction(
  _prevState: LinkPageFormState,
  formData: FormData
): Promise<LinkPageFormState> {
  const values = {
    title: formData.get("title") as string,
    slug: formData.get("slug") as string,
    description: formData.get("description") as string,
  }

  const result = updateLinkPageSchema.safeParse({
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
      .update(linkPages)
      .set(data)
      .where(eq(linkPages.id, id))
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
      errors: { _root: ["Erro ao atualizar página de links"] },
      success: false,
    }
  }

  revalidatePath(`/dashboard/tenants/${tenantId}/links/${id}`)
  revalidatePath(`/dashboard/tenants/${tenantId}`)
  return { errors: null, success: true }
}

export async function deleteLinkPageAction(
  _prevState: unknown,
  formData: FormData
) {
  const id = formData.get("id") as string
  const tenantId = formData.get("tenant_id") as string
  await db.delete(linkPages).where(eq(linkPages.id, id))
  revalidatePath(`/dashboard/tenants/${tenantId}`)
  redirect(`/dashboard/tenants/${tenantId}`)
}
