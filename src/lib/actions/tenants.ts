"use server"

import { db } from "@/db"
import { tenants } from "@/db/schema"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { z } from "zod/v4"

import { auth } from "@/lib/auth"
import { getTenantById } from "@/lib/queries/tenants"
import {
  createTenantSchema,
  type CreateTenantFormState,
} from "@/lib/validations/tenants"
import { removeDomainFromVercel } from "@/lib/vercel"
import { eq } from "drizzle-orm"

export async function createTenantAction(
  _prevState: CreateTenantFormState,
  formData: FormData
): Promise<CreateTenantFormState> {
  const session = await auth.api.getSession({ headers: await headers() })

  const values = {
    name: formData.get("name") as string,
    slug: formData.get("slug") as string,
  }

  if (!session) {
    return {
      values,
      errors: { _root: ["Nao autenticado"] },
      success: false,
    }
  }

  const result = createTenantSchema.safeParse(values)

  if (!result.success) {
    return {
      values,
      errors: z.flattenError(result.error).fieldErrors,
      success: false,
    }
  }

  try {
    await db.insert(tenants).values({
      name: result.data.name,
      slug: result.data.slug,
      userId: session.user.id,
    })
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("unique")) {
      return {
        values,
        errors: { slug: ["Slug ou dominio ja esta em uso"] },
        success: false,
      }
    }
    return {
      values,
      errors: { _root: ["Erro ao criar tenant"] },
      success: false,
    }
  }

  redirect("/dashboard")
}

export async function deleteTenantAction(
  _prevState: unknown,
  formData: FormData
) {
  const id = formData.get("id") as string

  const tenant = await getTenantById(id)

  if (tenant?.customDomain) {
    await removeDomainFromVercel(tenant.customDomain).catch(() => {})
  }

  await db.delete(tenants).where(eq(tenants.id, id))
  revalidatePath("/dashboard")
  redirect("/dashboard")
}
