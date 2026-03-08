"use client"

import { useActionState, useEffect } from "react"
import { toast } from "sonner"
import { Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { updateOfferAction, deleteOfferAction } from "@/lib/actions/offers"
import type { UpdateOfferFormState } from "@/lib/validations/offers"

type Offer = {
  id: string
  slug: string
  title: string
  description: string | null
  url: string | null
  active: boolean
}

const initialState: UpdateOfferFormState = { errors: null, success: false }

export function OfferForm({
  tenantId,
  offer,
}: {
  tenantId: string
  offer: Offer
}) {
  const [formState, updateAction, pending] = useActionState(
    updateOfferAction,
    initialState
  )
  const [, deleteAction, isDeleting] = useActionState(deleteOfferAction, null)

  useEffect(() => {
    if (formState.success) toast.success("Oferta atualizada")
    if (formState.errors?._root) toast.error(formState.errors._root[0])
  }, [formState])

  return (
    <form action={updateAction}>
      <input type="hidden" name="id" value={offer.id} />
      <input type="hidden" name="tenant_id" value={tenantId} />
      <FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <Field data-invalid={!!formState.errors?.title?.length}>
            <FieldLabel htmlFor="title">Titulo</FieldLabel>
            <Input
              id="title"
              name="title"
              defaultValue={formState.values?.title ?? offer.title}
              disabled={pending}
              aria-invalid={!!formState.errors?.title?.length}
              placeholder="Digite o titulo aqui"
            />
            {formState.errors?.title && (
              <FieldError>{formState.errors.title[0]}</FieldError>
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
        <Field data-invalid={!!formState.errors?.description?.length}>
          <FieldLabel htmlFor="description">Descricao (opcional)</FieldLabel>
          <Textarea
            id="description"
            name="description"
            defaultValue={
              formState.values?.description ?? offer.description ?? ""
            }
            disabled={pending}
            aria-invalid={!!formState.errors?.description?.length}
            placeholder="Digite a descricao aqui"
            rows={3}
          />
          {formState.errors?.description && (
            <FieldError>{formState.errors.description[0]}</FieldError>
          )}
        </Field>
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
        <Field orientation="horizontal">
          <Switch
            id="active"
            name="active"
            defaultChecked={offer.active}
            disabled={pending}
            value="on"
          />
          <FieldLabel htmlFor="active">Ativa</FieldLabel>
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
              <Trash2 className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </FieldGroup>
    </form>
  )
}
