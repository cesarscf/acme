import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"

import { getLinkPageById } from "@/lib/queries/link-pages"
import { SiteHeader } from "../../../../../_components/site-header"
import { LinkPageForm } from "./_components/link-page-form"
import { LinksSection } from "./_components/links-section"

export default async function LinkPageDetailPage({
  params,
}: {
  params: Promise<{ id: string; linkPageId: string }>
}) {
  const { id: tenantId, linkPageId } = await params

  const linkPage = await getLinkPageById(linkPageId)

  if (!linkPage || linkPage.tenantId !== tenantId) notFound()

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
            <h2 className="text-2xl font-semibold">{linkPage.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Edite a pagina de links e gerencie os links
            </p>
          </div>

          <LinkPageForm tenantId={tenantId} linkPage={linkPage} />

          <div>
            <h3 className="text-lg font-semibold">Links</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Gerencie os links desta pagina
            </p>
          </div>

          <LinksSection
            tenantId={tenantId}
            linkPageId={linkPageId}
            links={linkPage.links}
          />
        </div>
      </div>
    </>
  )
}
