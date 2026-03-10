import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { getLandingPageById } from "@/lib/queries/landing-pages"
import { LandingPageForm } from "./_components/landing-page-form"

export default async function LandingPageDetailPage({
  params,
}: {
  params: Promise<{ id: string; landingPageId: string }>
}) {
  const { id: tenantId, landingPageId } = await params

  const landingPage = await getLandingPageById(landingPageId)

  if (!landingPage || landingPage.tenantId !== tenantId) notFound()

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
          <h2 className="text-2xl font-semibold">{landingPage.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Edite os dados da landing page
          </p>
        </div>

        <Card className="mt-6">
          <CardContent>
            <LandingPageForm tenantId={tenantId} landingPage={landingPage} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
