import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { getPageById } from "@/lib/queries/pages"
import { PageForm } from "./_components/page-form"

export default async function PageDetailPage({
  params,
}: {
  params: Promise<{ id: string; pageId: string }>
}) {
  const { id: tenantId, pageId } = await params

  const page = await getPageById(pageId)

  if (!page || page.tenantId !== tenantId) notFound()

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
          <h2 className="text-2xl font-semibold">{page.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Edite os dados da página
          </p>
        </div>

        <Card className="mt-6">
          <CardContent>
            <PageForm tenantId={tenantId} page={page} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
