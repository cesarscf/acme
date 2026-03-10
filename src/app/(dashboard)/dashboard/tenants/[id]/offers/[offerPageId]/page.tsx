import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { getOfferPageById } from "@/lib/queries/offer-pages"
import { OfferForm } from "./_components/offer-form"

export default async function OfferDetailPage({
  params,
}: {
  params: Promise<{ id: string; offerPageId: string }>
}) {
  const { id: tenantId, offerPageId } = await params

  const offer = await getOfferPageById(offerPageId)

  if (!offer || offer.tenantId !== tenantId) notFound()

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 lg:px-6">
        <Link
          href={`/dashboard/tenants/${tenantId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeftIcon className="size-4" />
          Voltar
        </Link>

        <div className="mt-6">
          <h2 className="text-2xl font-semibold">{offer.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Edite os dados da oferta
          </p>
        </div>

        <Card className="mt-6">
          <CardContent>
            <OfferForm tenantId={tenantId} offer={offer} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
