"use server"

import { db } from "@/db"
import { organizations } from "@/db/schema"
import { eq } from "drizzle-orm"
import { unstable_noStore as noStore } from "next/cache"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import { getErrorMessage } from "@/lib/handle-error"
import { getOrganizationById } from "@/lib/queries/organizations"
import type { CreateOrganizationSchema } from "@/lib/validations/organizations"
import { addDomainToVercel, removeDomainFromVercel } from "@/lib/vercel"

export async function createOrganization(
  input: CreateOrganizationSchema
) {
  noStore()
  try {
    const org = await auth.api.createOrganization({
      body: { name: input.name, slug: input.slug },
      headers: await headers(),
    })

    revalidatePath("/dashboard")

    return { data: org, error: null }
  } catch (err) {
    return { data: null, error: getErrorMessage(err) }
  }
}

export async function updateOrganization(input: {
  organizationId: string
  name: string
  slug: string
}) {
  noStore()
  try {
    await auth.api.updateOrganization({
      body: {
        organizationId: input.organizationId,
        data: { name: input.name, slug: input.slug },
      },
      headers: await headers(),
    })

    revalidatePath(`/dashboard/organizations/${input.organizationId}`)
    revalidatePath(`/dashboard/organizations/${input.organizationId}/settings`)
    revalidatePath("/dashboard")

    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: getErrorMessage(err) }
  }
}

export async function updateCustomDomain(input: {
  organizationId: string
  customDomain: string | null
}) {
  noStore()
  try {
    const org = await getOrganizationById(input.organizationId)

    if (!org) {
      return { data: null, error: "Organização não encontrada" }
    }

    if (org.customDomain && org.customDomain !== input.customDomain) {
      await removeDomainFromVercel(org.customDomain).catch(() => {})
    }

    if (input.customDomain && input.customDomain !== org.customDomain) {
      await addDomainToVercel(input.customDomain)
    }

    await db
      .update(organizations)
      .set({ customDomain: input.customDomain, domainVerified: false })
      .where(eq(organizations.id, input.organizationId))

    revalidatePath(`/dashboard/organizations/${input.organizationId}`)
    revalidatePath(`/dashboard/organizations/${input.organizationId}/settings`)

    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: getErrorMessage(err) }
  }
}

export async function deleteOrganization(input: { organizationId: string }) {
  noStore()
  try {
    const org = await getOrganizationById(input.organizationId)

    if (org?.customDomain) {
      await removeDomainFromVercel(org.customDomain).catch(() => {})
    }

    await auth.api.deleteOrganization({
      body: { organizationId: input.organizationId },
      headers: await headers(),
    })

    revalidatePath("/dashboard")

    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: getErrorMessage(err) }
  }
}
