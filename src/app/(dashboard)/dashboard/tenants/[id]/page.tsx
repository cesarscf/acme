import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeftIcon, ExternalLink, Settings } from "lucide-react"

import { protocol, rootDomain } from "@/lib/utils"
import { getTenantById } from "@/lib/queries/tenants"
import { getPagesByTenantId } from "@/lib/queries/pages"
import { Button } from "@/components/ui/button"
import { PagesSection } from "./_components/pages-section"

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const tenant = await getTenantById(id)

  if (!tenant) notFound()

  const tenantPages = await getPagesByTenantId(id)

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
              <Settings data-icon="inline-start" />
              Configurações
            </Button>
          </Link>
        </div>

        <div className="mt-6">
          <PagesSection
            tenantId={tenant.id}
            tenantSlug={tenant.slug}
            pages={tenantPages}
          />
        </div>
      </div>
    </div>
  )
}
