"use client"

import { useActionState, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Gift, Plus } from "lucide-react"
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
import { createOfferAction } from "@/lib/actions/offers"

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
  offers,
}: {
  tenantId: string
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
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
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
          <div className="space-y-2">
            {offers.map((offer) => (
              <Link
                key={offer.id}
                href={`/dashboard/tenants/${tenantId}/ofertas/${offer.id}`}
                className="block rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{offer.title}</p>
                    <p className="text-sm text-muted-foreground">
                      /ofertas/{offer.slug}
                      {!offer.active && (
                        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">
                          inativa
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
