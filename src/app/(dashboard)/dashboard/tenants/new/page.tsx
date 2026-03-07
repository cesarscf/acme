"use client"

import { useActionState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createTenantAction } from "@/lib/actions/tenants"

export default function NewTenantPage() {
  const [state, action, isPending] = useActionState(createTenantAction, null)

  useEffect(() => {
    if (state?.error) toast.error(state.error)
  }, [state])

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
      <div className="w-full ">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Voltar
        </Link>
        <div className="mt-3">
          <h2 className="text-2xl font-semibold">Novo Tenant</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre um novo cliente da agencia
          </p>
        </div>
      </div>
      <Card className="w-full ">
        <CardHeader>
          <CardTitle>Dados do tenant</CardTitle>
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

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Criando..." : "Criar tenant"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
