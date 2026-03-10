import Link from "next/link"
import { Building2, ChevronRight } from "lucide-react"

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { getTenants } from "@/lib/queries/tenants"
import { CreateTenantDialog } from "./_components/create-tenant-dialog"

export default async function DashboardPage() {
  const allTenants = await getTenants()

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 lg:px-6">
        {allTenants.length === 0 ? (
          <Empty className="mt-8 rounded-lg bg-muted">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Building2 />
              </EmptyMedia>
              <EmptyTitle>Nenhum tenant cadastrado</EmptyTitle>
              <EmptyDescription>
                Cadastre o primeiro cliente da agência
              </EmptyDescription>
            </EmptyHeader>
            <CreateTenantDialog />
          </Empty>
        ) : (
          <>
            <div className="flex justify-end">
              <CreateTenantDialog />
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {allTenants.map((tenant) => (
                <Link key={tenant.id} href={`/dashboard/tenants/${tenant.id}`}>
                  <Item
                    variant="muted"
                    className="cursor-pointer transition-colors hover:bg-muted"
                  >
                    <ItemMedia variant="icon">
                      <Building2 />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>{tenant.name}</ItemTitle>
                      <ItemDescription>
                        {tenant.customDomain || `${tenant.slug}.acme.com`}
                      </ItemDescription>
                    </ItemContent>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Item>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
