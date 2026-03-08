"use client"

import { useActionState, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ExternalLink, Gift, Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createOfferAction } from "@/lib/actions/offers"
import { protocol, rootDomain } from "@/lib/utils"

type Offer = {
  id: string
  slug: string
  title: string
  description: string | null
  url: string | null
  active: boolean
}

export function OffersSection({
  tenantId,
  tenantSlug,
  offers,
}: {
  tenantId: string
  tenantSlug?: string
  offers: Offer[]
}) {
  const [open, setOpen] = useState(false)

  const wrappedAction = useCallback(
    async (prev: unknown, formData: FormData) => {
      const result = await createOfferAction(prev, formData)
      if (result?.success) setOpen(false)
      return result
    },
    []
  )

  const [createState, createAction, isCreating] = useActionState(
    wrappedAction,
    null
  )

  useEffect(() => {
    if (createState?.success) toast.success("Oferta criada")
    if (createState?.error) toast.error(createState.error)
  }, [createState])

  const createForm = (
    <form action={createAction} className="space-y-4">
      <input type="hidden" name="tenant_id" value={tenantId} />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="offer-title">Titulo</Label>
          <Input
            id="offer-title"
            name="title"
            placeholder="Black Friday"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="offer-slug">Slug</Label>
          <Input
            id="offer-slug"
            name="slug"
            placeholder="black-friday"
            required
            pattern="^[a-z0-9-]+$"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="offer-description">Descricao (opcional)</Label>
        <Input
          id="offer-description"
          name="description"
          placeholder="Ate 50% de desconto"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="offer-url">URL do CTA (opcional)</Label>
        <Input
          id="offer-url"
          name="url"
          type="url"
          placeholder="https://lojax.com/promo"
        />
      </div>
      <Button type="submit" className="w-full" disabled={isCreating}>
        {isCreating ? "Criando..." : "Criar oferta"}
      </Button>
    </form>
  )

  return (
    <div className="space-y-4">
      {offers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl bg-muted py-12">
          <Gift className="h-10 w-10 text-muted-foreground" />
          <p className="mt-4 text-sm font-medium">
            Nenhuma oferta cadastrada
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie uma oferta para o tenant
          </p>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="mt-4">
                <Plus className="mr-1 h-4 w-4" />
                Nova oferta
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova oferta</DialogTitle>
              </DialogHeader>
              {createForm}
            </DialogContent>
          </Dialog>
        </div>
      ) : (
        <>
          <div className="flex justify-end">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1 h-4 w-4" />
                  Nova oferta
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova oferta</DialogTitle>
                </DialogHeader>
                {createForm}
              </DialogContent>
            </Dialog>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {offers.map((offer) => (
              <div
                key={offer.id}
                className="rounded-xl bg-muted p-5 shadow-xs transition-shadow hover:shadow-md space-y-1">
                <div className="flex items-center justify-between">
                  <Link
                    href={`/dashboard/tenants/${tenantId}/ofertas/${offer.id}`}
                    className="font-semibold hover:underline"
                  >
                    {offer.title}
                  </Link>
                  {tenantSlug && (
                    <a
                      href={`${protocol}://${tenantSlug}.${rootDomain}/ofertas/${offer.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="ghost" size="icon-sm">
                        <ExternalLink className="size-4" />
                      </Button>
                    </a>
                  )}
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>/ofertas/{offer.slug}</span>
                  {!offer.active && (
                    <span className="rounded bg-muted-foreground/10 px-1.5 py-0.5 text-xs">
                      inativa
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
