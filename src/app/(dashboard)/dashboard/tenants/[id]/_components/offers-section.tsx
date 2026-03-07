"use client"

import { useActionState, useEffect } from "react"
import Link from "next/link"
import { Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
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
  const [createState, createAction, isCreating] = useActionState(
    createOfferAction,
    null
  )

  useEffect(() => {
    if (createState?.success) toast.success("Oferta criada")
    if (createState?.error) toast.error(createState.error)
  }, [createState])

  return (
    <div className="space-y-4">
      {offers.length > 0 && (
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
      )}

      <form
        action={createAction}
        className="space-y-3 rounded-lg border bg-card p-4"
      >
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">Nova oferta</p>
        </div>
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

        <Button type="submit" size="sm" disabled={isCreating}>
          {isCreating ? "Adicionando..." : "Adicionar oferta"}
        </Button>
      </form>
    </div>
  )
}
