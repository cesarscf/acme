import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeftIcon, ExternalLink } from "lucide-react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { protocol, rootDomain } from "@/lib/utils"
import { getTenantById } from "@/lib/queries/tenants"
import { getLandingPageByTenantId } from "@/lib/queries/landing-pages"
import { getLinkPagesByTenantId } from "@/lib/queries/link-pages"
import { getOffersByTenantId } from "@/lib/queries/offers"
import { SiteHeader } from "../../../_components/site-header"
import { DeleteTenantButton } from "./_components/delete-tenant-button"
import { DomainStatus } from "./_components/domain-status"
import { LandingPageForm } from "./_components/landing-page-form"
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

  const [landingPage, tenantLinkPages, tenantOffers] = await Promise.all([
    getLandingPageByTenantId(id),
    getLinkPagesByTenantId(id),
    getOffersByTenantId(id),
  ])

  return (
    <>
      <SiteHeader title={tenant.name} />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
          <div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Voltar
            </Link>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold">{tenant.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Gerencie landing page, links, ofertas e dominio
              </p>
              {(tenant.subdomain || tenant.customDomain) && (
                <div className="mt-1 flex items-center gap-3">
                  {tenant.subdomain && (
                    <a
                      href={`${protocol}://${tenant.subdomain}.${rootDomain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                    >
                      {tenant.subdomain}.{rootDomain}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {tenant.customDomain && (
                    <a
                      href={`${protocol}://${tenant.customDomain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                    >
                      {tenant.customDomain}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}
            </div>
            <DeleteTenantButton tenantId={tenant.id} />
          </div>

          {tenant.customDomain && <DomainStatus domain={tenant.customDomain} />}

          <Tabs defaultValue="landing-page">
            <TabsList>
              <TabsTrigger value="landing-page">Landing Page</TabsTrigger>
              <TabsTrigger value="links">Links</TabsTrigger>
              <TabsTrigger value="ofertas">Ofertas</TabsTrigger>
              <TabsTrigger value="metricas">Metricas</TabsTrigger>
            </TabsList>

            <TabsContent value="landing-page" className="mt-4">
              <LandingPageForm
                tenantId={tenant.id}
                landingPage={landingPage ?? null}
              />
            </TabsContent>

            <TabsContent value="links" className="mt-4">
              <LinkPagesSection
                tenantId={tenant.id}
                linkPages={tenantLinkPages}
              />
            </TabsContent>

            <TabsContent value="ofertas" className="mt-4">
              <OffersSection tenantId={tenant.id} offers={tenantOffers} />
            </TabsContent>

            <TabsContent value="metricas" className="mt-4">
              <p className="text-sm text-muted-foreground">
                Metricas estarao disponiveis em breve.
              </p>
            </TabsContent>
          </Tabs>
          </div>
        </div>
      </div>
    </>
  )
}
