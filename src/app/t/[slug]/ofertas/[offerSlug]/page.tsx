import { notFound } from "next/navigation"

import { getTenantBySlug } from "@/lib/queries/tenants"
import { getOfferPageBySlug } from "@/lib/queries/offer-pages"

export default async function TenantOfferPage({
  params,
}: {
  params: Promise<{ slug: string; offerSlug: string }>
}) {
  const { slug, offerSlug } = await params

  const tenant = await getTenantBySlug(slug)

  if (!tenant) notFound()

  const offer = await getOfferPageBySlug(tenant.id, offerSlug)

  if (!offer || !offer.active) notFound()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <p className="text-muted-foreground">
        Offer Page: {offer.name} (vamos alterar no futuro)
      </p>
    </div>
  )
}
