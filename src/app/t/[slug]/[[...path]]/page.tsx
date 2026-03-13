import { notFound } from "next/navigation"

import {
  getOrganizationBySlug,
  getOrganizationByCustomDomain,
} from "@/lib/queries/organizations"
import { getPageByPath } from "@/lib/queries/pages"

export default async function TenantPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; path?: string[] }>
  searchParams: Promise<{ _tenantType?: string }>
}) {
  const { slug, path } = await params
  const { _tenantType } = await searchParams
  const resolvedPath = path ? path.join("/") : ""

  const org =
    _tenantType === "customDomain"
      ? await getOrganizationByCustomDomain(slug)
      : await getOrganizationBySlug(slug)

  if (!org) notFound()

  const page = await getPageByPath(org.id, resolvedPath)

  if (!page || !page.active) notFound()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <p className="text-muted-foreground">
        {page.name} — template: {page.templateSlug}
      </p>
    </div>
  )
}
