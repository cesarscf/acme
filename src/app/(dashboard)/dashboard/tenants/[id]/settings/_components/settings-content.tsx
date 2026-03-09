"use client"

import { useState } from "react"
import { Globe, Settings } from "lucide-react"

import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TenantInfoForm } from "./tenant-info-form"
import { CustomDomainForm } from "./custom-domain-form"
import { DomainStatus } from "../../_components/domain-status"
import { DeleteTenantButton } from "../../_components/delete-tenant-button"

type Tenant = {
  id: string
  name: string
  slug: string
  customDomain: string | null
}

const sections = [
  { id: "geral", label: "Geral", icon: Settings },
  { id: "dominio", label: "Domínio", icon: Globe },
] as const

type SectionId = (typeof sections)[number]["id"]

export function SettingsContent({ tenant }: { tenant: Tenant }) {
  const [active, setActive] = useState<SectionId>("geral")

  return (
    <div className="mt-6 flex gap-8">
      <nav className="w-48 shrink-0">
        <ul className="space-y-1">
          {sections.map((section) => (
            <li key={section.id}>
              <button
                onClick={() => setActive(section.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active === section.id
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
                )}
              >
                <section.icon className="size-4" />
                {section.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex-1 space-y-6">
        {active === "geral" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Informações</CardTitle>
              </CardHeader>
              <CardContent>
                <TenantInfoForm
                  tenantId={tenant.id}
                  name={tenant.name}
                  slug={tenant.slug}
                />
              </CardContent>
            </Card>

            <Card className="ring-destructive">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-destructive">Zona de perigo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Excluir tenant</p>
                    <p className="text-sm text-muted-foreground">
                      Esta ação é irreversível e remove todos os dados
                    </p>
                  </div>
                  <DeleteTenantButton tenantId={tenant.id} />
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {active === "dominio" && (
          <Card>
            <CardHeader>
              <CardTitle>Domínio personalizado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <CustomDomainForm
                tenantId={tenant.id}
                customDomain={tenant.customDomain}
              />
              {tenant.customDomain && (
                <DomainStatus domain={tenant.customDomain} />
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
