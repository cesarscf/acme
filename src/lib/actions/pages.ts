"use server"

import { db } from "@/db"
import { pages } from "@/db/schema"
import { and, eq, ne } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod/v4"

import {
  createPageSchema,
  updatePageSchema,
  type PageFormState,
} from "@/lib/validations/pages"

export async function createPageAction(
  _prevState: PageFormState,
  formData: FormData
): Promise<PageFormState> {
  const values = {
    name: formData.get("name") as string,
    path: formData.get("path") as string,
    templateSlug: formData.get("template_slug") as string,
  }

  const result = createPageSchema.safeParse({
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

  const existing = await db.query.pages.findFirst({
    where: and(
      eq(pages.tenantId, result.data.tenantId),
      eq(pages.path, result.data.path)
    ),
  })

  if (existing) {
    return {
      values,
      errors: {
        path: [
          result.data.path === ""
            ? "Já existe uma página na raiz deste tenant"
            : "Path já está em uso neste tenant",
        ],
      },
      success: false,
    }
  }

  const [created] = await db
    .insert(pages)
    .values(result.data)
    .returning({ id: pages.id })

  revalidatePath(`/dashboard/tenants/${result.data.tenantId}`)
  redirect(`/dashboard/tenants/${result.data.tenantId}/pages/${created.id}`)
}

export async function updatePageAction(
  _prevState: PageFormState,
  formData: FormData
): Promise<PageFormState> {
  const values = {
    name: formData.get("name") as string,
    path: formData.get("path") as string,
    active: formData.get("active") === "true",
  }

  const result = updatePageSchema.safeParse({
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

  const existing = await db.query.pages.findFirst({
    where: and(
      eq(pages.tenantId, tenantId),
      eq(pages.path, data.path),
      ne(pages.id, id)
    ),
  })

  if (existing) {
    return {
      values,
      errors: {
        path: [
          data.path === ""
            ? "Já existe uma página na raiz deste tenant"
            : "Path já está em uso neste tenant",
        ],
      },
      success: false,
    }
  }

  await db.update(pages).set(data).where(eq(pages.id, id))

  revalidatePath(`/dashboard/tenants/${tenantId}/pages/${id}`)
  revalidatePath(`/dashboard/tenants/${tenantId}`)
  return { errors: null, success: true }
}

export async function deletePageAction(
  _prevState: unknown,
  formData: FormData
) {
  const id = formData.get("id") as string
  const tenantId = formData.get("tenant_id") as string
  await db.delete(pages).where(eq(pages.id, id))
  revalidatePath(`/dashboard/tenants/${tenantId}`)
  redirect(`/dashboard/tenants/${tenantId}`)
}
