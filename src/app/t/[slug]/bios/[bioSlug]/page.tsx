import { notFound } from "next/navigation"

import { getTenantBySlug } from "@/lib/queries/tenants"
import { getBioPageBySlug, getLinksByPageId } from "@/lib/queries/bio-pages"

export default async function TenantBioPage({
  params,
}: {
  params: Promise<{ slug: string; bioSlug: string }>
}) {
  const { slug, bioSlug } = await params

  const tenant = await getTenantBySlug(slug)

  if (!tenant) notFound()

  const page = await getBioPageBySlug(tenant.id, bioSlug)

  if (!page || !page.active) notFound()

  const pageLinks = await getLinksByPageId(page.id)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <p className="text-center text-muted-foreground">
          Bio Page: {page.name} (vamos alterar no futuro)
        </p>

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
