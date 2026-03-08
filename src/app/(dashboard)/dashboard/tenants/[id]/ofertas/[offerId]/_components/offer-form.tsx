"use client"

import { useActionState, useEffect } from "react"
import { toast } from "sonner"
import { Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { updateOfferAction, deleteOfferAction } from "@/lib/actions/offers"

type Offer = {
  id: string
  slug: string
  title: string
  description: string | null
  url: string | null
  active: boolean
}

export function OfferForm({
  tenantId,
  offer,
}: {
  tenantId: string
  offer: Offer
}) {
  const [updateState, updateAction, isUpdating] = useActionState(
    updateOfferAction,
    null
  )
  const [, deleteAction, isDeleting] = useActionState(deleteOfferAction, null)

  useEffect(() => {
    if (updateState?.success) toast.success("Oferta atualizada")
    if (updateState?.error) toast.error(updateState.error)
  }, [updateState])

  return (

      <form action={updateAction} className="space-y-6">
        <input type="hidden" name="id" value={offer.id} />
        <input type="hidden" name="tenant_id" value={tenantId} />
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="title">Titulo</Label>
            <Input
              id="title"
              name="title"
              defaultValue={offer.title}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              name="slug"
              defaultValue={offer.slug}
              required
              pattern="^[a-z0-9-]+$"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="description">Descricao (opcional)</Label>
          <Textarea
            id="description"
            name="description"
            defaultValue={offer.description ?? ""}
            rows={3}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="url">URL do CTA (opcional)</Label>
          <Input
            id="url"
            name="url"
            type="url"
            defaultValue={offer.url ?? ""}
          />
        </div>
        <div className="flex items-center gap-3">
          <Switch
            id="active"
            name="active"
            defaultChecked={offer.active}
            value="on"
          />
          <Label htmlFor="active">Ativa</Label>
        </div>

        <div className="flex items-center justify-between">
          <Button type="submit" size="sm" disabled={isUpdating}>
            {isUpdating ? "Salvando..." : "Salvar"}
          </Button>
          <form action={deleteAction}>
            <input type="hidden" name="id" value={offer.id} />
            <input type="hidden" name="tenant_id" value={tenantId} />
            <Button
              type="submit"
              variant="destructive"
              size="icon"
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </form>

  )
}
