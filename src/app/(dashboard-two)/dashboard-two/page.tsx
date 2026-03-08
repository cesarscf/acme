import Link from "next/link"
import { Building2 } from "lucide-react"

import { Separator } from "@/components/ui/separator"
import { getTenants } from "@/lib/queries/tenants"
import { CreateTenantDialog } from "../../(dashboard)/dashboard/_components/create-tenant-dialog"

export default async function DashboardTwoPage() {
  const allTenants = await getTenants()

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 lg:px-6">
        <div className="flex justify-end">
          <CreateTenantDialog />
        </div>

        {allTenants.length === 0 ? (
          <div className="mt-8 flex flex-col items-center justify-center rounded-xl bg-muted py-16">
            <Building2 className="size-10 text-muted-foreground" />
            <p className="mt-4 text-sm font-medium">
              Nenhum tenant cadastrado
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadastre o primeiro cliente da agencia
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {allTenants.map((tenant) => (
              <Link
                key={tenant.id}
                href={`/dashboard/tenants/${tenant.id}`}
                className="block rounded-xl bg-muted p-5 shadow-xs transition-shadow hover:shadow-md"
              >
                <div className="flex items-center gap-2">
                  <Building2 className="size-4 text-muted-foreground" />
                  <h3 className="font-semibold">{tenant.name}</h3>
                </div>
                <Separator className="my-4" />
                <p className="text-sm text-muted-foreground">
                  {tenant.customDomain || `${tenant.slug}.acme.com`}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
