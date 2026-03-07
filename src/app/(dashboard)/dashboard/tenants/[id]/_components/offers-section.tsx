"use client"

import { useActionState } from "react"
import { Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createOfferAction, deleteOfferAction } from "@/lib/actions/offers"

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
  const [createState, createAction, isCreating] = useActionState(
    createOfferAction,
    null
  )
  const [, deleteAction, isDeleting] = useActionState(deleteOfferAction, null)

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Ofertas</h3>

      {offers.length > 0 && (
        <div className="space-y-2">
          {offers.map((offer) => (
            <div
              key={offer.id}
              className="flex items-center justify-between rounded-lg border bg-card p-3"
            >
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
              <form action={deleteAction}>
                <input type="hidden" name="id" value={offer.id} />
                <input type="hidden" name="tenant_id" value={tenantId} />
                <Button variant="ghost" size="icon" disabled={isDeleting}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </form>
            </div>
          ))}
        </div>
      )}

      <form
        action={createAction}
        className="space-y-3 rounded-lg border bg-card p-4"
      >
        <input type="hidden" name="tenant_id" value={tenantId} />
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="offer-title">Titulo</Label>
            <Input
              id="offer-title"
              name="title"
              placeholder="Black Friday"
              required
            />
          </div>
          <div className="space-y-1">
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
        <div className="space-y-1">
          <Label htmlFor="offer-description">Descricao (opcional)</Label>
          <Input
            id="offer-description"
            name="description"
            placeholder="Ate 50% de desconto"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="offer-url">URL do CTA (opcional)</Label>
          <Input
            id="offer-url"
            name="url"
            type="url"
            placeholder="https://lojax.com/promo"
          />
        </div>

        {createState?.error && (
          <p className="text-sm text-destructive">{createState.error}</p>
        )}

        <Button type="submit" size="sm" disabled={isCreating}>
          {isCreating ? "Adicionando..." : "Adicionar oferta"}
        </Button>
      </form>
    </div>
  )
}
