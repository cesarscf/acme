"use client"

import { useActionState, useEffect, useState } from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createTenantAction } from "@/lib/actions/tenants"
import { cn } from "@/lib/utils"

export function CreateTenantDialog({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const [state, action, isPending] = useActionState(createTenantAction, null)

  useEffect(() => {
    if (state?.error) toast.error(state.error)
  }, [state])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className={cn(className)}>
          <Plus className="mr-1 h-4 w-4" />
          Novo tenant
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo tenant</DialogTitle>
        </DialogHeader>
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
      </DialogContent>
    </Dialog>
  )
}
