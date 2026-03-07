"use server"

import { db } from "@/db"
import { tenants } from "@/db/schema"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import { getTenantById } from "@/lib/queries/tenants"
import { createTenantSchema } from "@/lib/validations/tenants"
import { addDomainToVercel, removeDomainFromVercel } from "@/lib/vercel"
import { eq } from "drizzle-orm"

export async function createTenantAction(
  _prevState: unknown,
  formData: FormData
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { error: "Nao autenticado" }

  const parsed = createTenantSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    subdomain: formData.get("subdomain"),
    customDomain: formData.get("custom_domain"),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    await db.insert(tenants).values({
      name: parsed.data.name,
      slug: parsed.data.slug,
      subdomain: parsed.data.subdomain ?? parsed.data.slug,
      customDomain: parsed.data.customDomain,
      userId: session.user.id,
    })

    if (parsed.data.customDomain) {
      await addDomainToVercel(parsed.data.customDomain)
    }
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("unique")) {
      return { error: "Slug ou dominio ja esta em uso" }
    }
    return { error: "Erro ao criar tenant" }
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
