import { notFound } from "next/navigation"

import { getTenantBySlug } from "@/lib/queries/tenants"
import { getLinkPageBySlug, getLinksByPageId } from "@/lib/queries/link-pages"

export default async function TenantLinkPage({
  params,
}: {
  params: Promise<{ slug: string; linksSlug: string }>
}) {
  const { slug, linksSlug } = await params

  const tenant = await getTenantBySlug(slug)

  if (!tenant) notFound()

  const page = await getLinkPageBySlug(tenant.id, linksSlug)

  if (!page) notFound()

  const pageLinks = await getLinksByPageId(page.id)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white p-4">
      <div className="w-full max-w-md space-y-4">
        <h1 className="text-center text-2xl font-bold">{page.title}</h1>
        {page.description && (
          <p className="text-center text-muted-foreground">
            {page.description}
          </p>
        )}

        {pageLinks.length === 0 ? (
          <p className="text-center text-muted-foreground">
            Nenhum link cadastrado.
          </p>
        ) : (
          <div className="space-y-3">
            {pageLinks.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full rounded-lg border bg-white p-4 text-center font-medium transition-shadow hover:shadow-md"
              >
                {link.title}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
