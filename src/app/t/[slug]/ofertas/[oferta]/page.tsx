import { notFound } from "next/navigation"

import { getTenantBySlug } from "@/lib/queries/tenants"
import { getOfferBySlug } from "@/lib/queries/offers"

export default async function TenantOfferPage({
  params,
}: {
  params: Promise<{ slug: string; oferta: string }>
}) {
  const { slug, oferta } = await params

  const tenant = await getTenantBySlug(slug)

  if (!tenant) notFound()

  const offer = await getOfferBySlug(tenant.id, oferta)

  if (!offer || !offer.active) notFound()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white p-4">
      <div className="max-w-lg space-y-4 text-center">
        <p className="text-sm text-muted-foreground">{tenant.name}</p>
        <h1 className="text-4xl font-bold tracking-tight">{offer.title}</h1>
        {offer.description && (
          <p className="text-lg text-gray-600">{offer.description}</p>
        )}
        {offer.url && (
          <a
            href={offer.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Acessar oferta
          </a>
        )}
      </div>
    </div>
  )
}
