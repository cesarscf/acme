import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { getLinkPageById } from "@/lib/queries/link-pages"
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
          <h2 className="text-2xl font-semibold">{linkPage.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Edite a página de links e gerencie os links
          </p>
        </div>

        <Card className="mt-6">
          <CardContent>
            <LinkPageForm tenantId={tenantId} linkPage={linkPage} />
          </CardContent>
        </Card>

        <div className="mt-8">
          <h3 className="text-lg font-semibold">Links</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie os links desta página
          </p>
        </div>

        <div className="mt-4">
          <LinksSection
            tenantId={tenantId}
            linkPageId={linkPageId}
            links={linkPage.links}
          />
        </div>
      </div>
    </div>
  )
}
