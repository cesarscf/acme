import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeftIcon, ExternalLink, Settings } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { protocol, rootDomain } from "@/lib/utils"
import { getTenantById } from "@/lib/queries/tenants"
import { getLandingPagesByTenantId } from "@/lib/queries/landing-pages"
import { getLinkPagesByTenantId } from "@/lib/queries/link-pages"
import { getOffersByTenantId } from "@/lib/queries/offers"
import { Button } from "@/components/ui/button"
import { LandingPagesSection } from "./_components/landing-pages-section"
import { LinkPagesSection } from "./_components/link-pages-section"
import { OffersSection } from "./_components/offers-section"

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const tenant = await getTenantById(id)

  if (!tenant) notFound()

  const [tenantLandingPages, tenantLinkPages, tenantOffers] = await Promise.all([
    getLandingPagesByTenantId(id),
    getLinkPagesByTenantId(id),
    getOffersByTenantId(id),
  ])

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 lg:px-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeftIcon className="size-4" />
          Voltar
        </Link>

        <div className="mt-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">{tenant.name}</h2>
            <div className="mt-1 flex items-center gap-3">
              <a
                href={`${protocol}://${tenant.slug}.${rootDomain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
              >
                {tenant.slug}.{rootDomain}
                <ExternalLink className="size-3" />
              </a>
              {tenant.customDomain && (
                <a
                  href={`${protocol}://${tenant.customDomain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
                >
                  {tenant.customDomain}
                  <ExternalLink className="size-3" />
                </a>
              )}
            </div>
          </div>
          <Link href={`/dashboard/tenants/${tenant.id}/settings`}>
            <Button variant="outline" size="sm">
              <Settings className="mr-1 size-4" />
              Configurações
            </Button>
          </Link>
        </div>

        <Tabs defaultValue="landing-page" className="mt-6">
          <TabsList variant="line">
            <TabsTrigger value="landing-page">Landing Pages</TabsTrigger>
            <TabsTrigger value="links">Links</TabsTrigger>
            <TabsTrigger value="ofertas">Ofertas</TabsTrigger>
            <TabsTrigger value="metricas">Métricas</TabsTrigger>
          </TabsList>

          <TabsContent value="landing-page" className="mt-4">
            <LandingPagesSection
              tenantId={tenant.id}
              tenantSlug={tenant.slug}
              landingPages={tenantLandingPages}
            />
          </TabsContent>

          <TabsContent value="links" className="mt-4">
            <LinkPagesSection
              tenantId={tenant.id}
              tenantSlug={tenant.slug}
              linkPages={tenantLinkPages}
            />
          </TabsContent>

          <TabsContent value="ofertas" className="mt-4">
            <OffersSection tenantId={tenant.id} tenantSlug={tenant.slug} offers={tenantOffers} />
          </TabsContent>

          <TabsContent value="metricas" className="mt-4">
            <Card>
              <CardContent >
                <p className="text-sm text-muted-foreground">
                  Métricas estarão disponíveis em breve.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
