"use server"

import { db } from "@/db"
import { pages } from "@/db/schema"
import { and, eq, ne } from "drizzle-orm"
import { unstable_noStore as noStore } from "next/cache"
import { revalidatePath } from "next/cache"

import { getErrorMessage } from "@/lib/handle-error"

export async function createPage(input: {
  organizationId: string
  name: string
  path: string
  templateSlug: string
}) {
  noStore()
  try {
    const existing = await db.query.pages.findFirst({
      where: and(
        eq(pages.organizationId, input.organizationId),
        eq(pages.path, input.path)
      ),
    })

    if (existing) {
      return {
        data: null,
        error:
          input.path === ""
            ? "Já existe uma página na raiz desta organização"
            : "Path já está em uso nesta organização",
      }
    }

    const result = await db
      .insert(pages)
      .values(input)
      .returning({ id: pages.id })
      .then((res) => res[0])

    revalidatePath(`/dashboard/tenants/${input.organizationId}`)

    return { data: result, error: null }
  } catch (err) {
    return { data: null, error: getErrorMessage(err) }
  }
}

export async function updatePage(input: {
  id: string
  organizationId: string
  name: string
  path: string
  active: boolean
}) {
  noStore()
  try {
    const existing = await db.query.pages.findFirst({
      where: and(
        eq(pages.organizationId, input.organizationId),
        eq(pages.path, input.path),
        ne(pages.id, input.id)
      ),
    })

    if (existing) {
      return {
        data: null,
        error:
          input.path === ""
            ? "Já existe uma página na raiz desta organização"
            : "Path já está em uso nesta organização",
      }
    }

    const { id, organizationId, ...data } = input

    await db.update(pages).set(data).where(eq(pages.id, id))

    revalidatePath(`/dashboard/tenants/${organizationId}/pages/${id}`)
    revalidatePath(`/dashboard/tenants/${organizationId}`)

    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: getErrorMessage(err) }
  }
}

export async function deletePage(input: {
  id: string
  organizationId: string
}) {
  noStore()
  try {
    await db.delete(pages).where(eq(pages.id, input.id))

    revalidatePath(`/dashboard/tenants/${input.organizationId}`)

    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: getErrorMessage(err) }
  }
}
