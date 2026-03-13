import { notFound } from "next/navigation"

import { getTenantBySlug } from "@/lib/queries/tenants"
import { getPageByPath } from "@/lib/queries/pages"

export default async function TenantPage({
  params,
}: {
  params: Promise<{ slug: string; path?: string[] }>
}) {
  const { slug, path } = await params
  const resolvedPath = path ? path.join("/") : ""

  const tenant = await getTenantBySlug(slug)

  if (!tenant) notFound()

  const page = await getPageByPath(tenant.id, resolvedPath)

  if (!page || !page.active) notFound()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <p className="text-muted-foreground">
        {page.name} — template: {page.templateSlug}
      </p>
    </div>
  )
}
