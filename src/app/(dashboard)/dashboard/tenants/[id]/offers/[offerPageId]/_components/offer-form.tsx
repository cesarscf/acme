"use client"

import { useActionState, useEffect, useState } from "react"
import { toast } from "sonner"
import { Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Item,
  ItemContent,
  ItemActions,
  ItemTitle,
  ItemDescription,
} from "@/components/ui/item"
import { Spinner } from "@/components/ui/spinner"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { updateOfferPageAction, deleteOfferPageAction } from "@/lib/actions/offer-pages"
import type { UpdateOfferPageFormState } from "@/lib/validations/offer-pages"

type OfferPage = {
  id: string
  slug: string
  name: string
  url: string | null
  active: boolean
}

const initialState: UpdateOfferPageFormState = { errors: null, success: false }

export function OfferForm({
  tenantId,
  offer,
}: {
  tenantId: string
  offer: OfferPage
}) {
  const [active, setActive] = useState(offer.active)
  const [formState, updateAction, pending] = useActionState(
    updateOfferPageAction,
    initialState
  )
  const [, deleteAction, isDeleting] = useActionState(deleteOfferPageAction, null)

  useEffect(() => {
    if (formState.success) toast.success("Oferta atualizada")
    if (formState.errors?._root) toast.error(formState.errors._root[0])
  }, [formState])

  return (
    <form action={updateAction}>
      <input type="hidden" name="id" value={offer.id} />
      <input type="hidden" name="tenant_id" value={tenantId} />
      <input type="hidden" name="active" value={String(active)} />
      <Item variant="outline" className="mb-6">
        <ItemContent>
          <ItemTitle>Status</ItemTitle>
          <ItemDescription>
            {active ? "Visível publicamente" : "Oculta para visitantes"}
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Switch
            id="active-status"
            checked={active}
            onCheckedChange={setActive}
            disabled={pending}
          />
        </ItemActions>
      </Item>
      <FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <Field data-invalid={!!formState.errors?.name?.length}>
            <FieldLabel htmlFor="name">Nome</FieldLabel>
            <Input
              id="name"
              name="name"
              defaultValue={formState.values?.name ?? offer.name}
              disabled={pending}
              aria-invalid={!!formState.errors?.name?.length}
              placeholder="Digite o nome aqui"
            />
            {formState.errors?.name && (
              <FieldError>{formState.errors.name[0]}</FieldError>
            )}
          </Field>
          <Field data-invalid={!!formState.errors?.slug?.length}>
            <FieldLabel htmlFor="slug">Slug</FieldLabel>
            <Input
              id="slug"
              name="slug"
              defaultValue={formState.values?.slug ?? offer.slug}
              disabled={pending}
              aria-invalid={!!formState.errors?.slug?.length}
              placeholder="Digite o slug aqui"
              pattern="^[a-z0-9-]+$"
            />
            {formState.errors?.slug && (
              <FieldError>{formState.errors.slug[0]}</FieldError>
            )}
          </Field>
        </div>
        <Field data-invalid={!!formState.errors?.url?.length}>
          <FieldLabel htmlFor="url">URL do CTA (opcional)</FieldLabel>
          <Input
            id="url"
            name="url"
            type="url"
            defaultValue={formState.values?.url ?? offer.url ?? ""}
            disabled={pending}
            aria-invalid={!!formState.errors?.url?.length}
            placeholder="https://exemplo.com"
          />
          {formState.errors?.url && (
            <FieldError>{formState.errors.url[0]}</FieldError>
          )}
        </Field>
        <div className="flex items-center justify-between">
          <Button type="submit" size="sm" disabled={pending}>
            {pending && <Spinner />}
            Salvar
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
              <Trash2 />
            </Button>
          </form>
        </div>
      </FieldGroup>
    </form>
  )
}
