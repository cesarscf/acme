import { notFound } from "next/navigation"
import { ExternalLink } from "lucide-react"

import { protocol, rootDomain } from "@/lib/utils"
import { getTenantById } from "@/lib/queries/tenants"
import { getLinkPagesByTenantId } from "@/lib/queries/link-pages"
import { getOffersByTenantId } from "@/lib/queries/offers"
import { SiteHeader } from "../../../_components/site-header"
import { DeleteTenantButton } from "./_components/delete-tenant-button"
import { DomainStatus } from "./_components/domain-status"
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

  const [tenantLinkPages, tenantOffers] = await Promise.all([
    getLinkPagesByTenantId(id),
    getOffersByTenantId(id),
  ])

  return (
    <>
      <SiteHeader />
      <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">{tenant.name}</h2>
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

        <LinkPagesSection tenantId={tenant.id} linkPages={tenantLinkPages} />
        <OffersSection tenantId={tenant.id} offers={tenantOffers} />
      </div>
    </>
  )
}
