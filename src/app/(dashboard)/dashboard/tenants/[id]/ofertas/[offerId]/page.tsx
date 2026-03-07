import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"

import { getOfferById } from "@/lib/queries/offers"
import { SiteHeader } from "../../../../../_components/site-header"
import { OfferForm } from "./_components/offer-form"

export default async function OfferDetailPage({
  params,
}: {
  params: Promise<{ id: string; offerId: string }>
}) {
  const { id: tenantId, offerId } = await params

  const offer = await getOfferById(offerId)

  if (!offer || offer.tenantId !== tenantId) notFound()

  return (
    <>
      <SiteHeader />
      <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
        <div className="flex w-full flex-col gap-6">
          <div>
            <Link
              href={`/dashboard/tenants/${tenantId}`}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Voltar
            </Link>
          </div>
          <div>
            <h2 className="text-2xl font-semibold">{offer.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Edite os dados da oferta
            </p>
          </div>

          <OfferForm tenantId={tenantId} offer={offer} />
        </div>
      </div>
    </>
  )
}
