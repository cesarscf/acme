import Link from "next/link"

import { getTenants } from "@/lib/queries/tenants"
import { SiteHeader } from "../_components/site-header"

export default async function DashboardPage() {
  const allTenants = await getTenants()

  return (
    <>
      <SiteHeader />
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <div className="w-full max-w-xl">
          <div>
            <h2 className="text-2xl font-semibold">Tenants</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Gerencie os clientes da agencia
            </p>
          </div>

          {allTenants.length === 0 ? (
            <p className="mt-4 text-muted-foreground">
              Nenhum tenant cadastrado.
            </p>
          ) : (
            <div className="mt-4 grid gap-4">
              {allTenants.map((tenant) => (
                <Link
                  key={tenant.id}
                  href={`/dashboard/tenants/${tenant.id}`}
                  className="block rounded-lg border bg-card p-4 transition-shadow hover:shadow-md"
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
    </>
  )
}
