import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"

import { getTenantById } from "@/lib/queries/tenants"
import { SettingsContent } from "./_components/settings-content"

export default async function TenantSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const tenant = await getTenantById(id)

  if (!tenant) notFound()

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 lg:px-6">
        <Link
          href={`/dashboard/tenants/${id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeftIcon className="size-4" />
          Voltar
        </Link>

        <div className="mt-6">
          <h2 className="text-2xl font-semibold">
            Configurações de {tenant.name}
          </h2>
        </div>

        <SettingsContent tenant={tenant} />
      </div>
    </div>
  )
}
