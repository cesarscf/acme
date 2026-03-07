import Link from "next/link"
import { Building2 } from "lucide-react"

import { getTenants } from "@/lib/queries/tenants"
import { SiteHeader } from "../_components/site-header"
import { CreateTenantDialog } from "./_components/create-tenant-dialog"

export default async function DashboardPage() {
  const allTenants = await getTenants()

  return (
    <>
      <SiteHeader title="Tenants" />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="flex items-center justify-between px-4 lg:px-6">
              <div>
                <h2 className="text-2xl font-semibold">Tenants</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Gerencie os clientes da agencia
                </p>
              </div>
              {allTenants.length > 0 && <CreateTenantDialog />}
            </div>

            {allTenants.length === 0 ? (
              <div className="mx-4 flex flex-col items-center justify-center rounded-lg border border-dashed py-12 lg:mx-6">
                <Building2 className="h-10 w-10 text-muted-foreground" />
                <p className="mt-4 text-sm font-medium">
                  Nenhum tenant cadastrado
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cadastre o primeiro cliente da agencia
                </p>
                <CreateTenantDialog className="mt-4" />
              </div>
            ) : (
              <div className="grid gap-4 px-4 sm:grid-cols-2 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-3">
                {allTenants.map((tenant) => (
                  <Link
                    key={tenant.id}
                    href={`/dashboard/tenants/${tenant.id}`}
                    className="block rounded-xl border bg-card p-4 shadow-xs transition-shadow hover:shadow-md"
                  >
                    <h3 className="font-semibold">{tenant.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {tenant.subdomain
                        ? `${tenant.subdomain}.acme.com`
                        : tenant.customDomain || tenant.slug}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {new Date(tenant.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
