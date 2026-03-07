"use client"

import { useActionState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createTenantAction } from "@/lib/actions/tenants"

export default function NewTenantPage() {
  const [state, action, isPending] = useActionState(createTenantAction, null)

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <Card className="mx-auto w-full max-w-lg">
        <CardHeader>
          <CardTitle>Novo Tenant</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" name="name" placeholder="Loja X" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                name="slug"
                placeholder="lojax"
                required
                pattern="^[a-z0-9-]+$"
                title="Apenas letras minusculas, numeros e hifens"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subdomain">Subdominio (opcional)</Label>
              <div className="flex items-center">
                <Input
                  id="subdomain"
                  name="subdomain"
                  placeholder="lojax"
                  className="rounded-r-none"
                />
                <span className="flex min-h-9 items-center rounded-r-md border border-l-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                  .acme.com
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="custom_domain">Dominio custom (opcional)</Label>
              <Input
                id="custom_domain"
                name="custom_domain"
                placeholder="lojax.com"
              />
            </div>

            {state?.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Criando..." : "Criar tenant"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
