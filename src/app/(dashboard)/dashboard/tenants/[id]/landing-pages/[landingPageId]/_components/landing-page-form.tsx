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
import {
  updateLandingPageAction,
  deleteLandingPageAction,
} from "@/lib/actions/landing-pages"
import type { LandingPageFormState } from "@/lib/validations/landing-pages"

type LandingPage = {
  id: string
  slug: string
  name: string
  active: boolean
}

const initialState: LandingPageFormState = { errors: null, success: false }

export function LandingPageForm({
  tenantId,
  landingPage,
}: {
  tenantId: string
  landingPage: LandingPage
}) {
  const [active, setActive] = useState(landingPage.active)
  const [formState, updateAction, pending] = useActionState(
    updateLandingPageAction,
    initialState
  )
  const [, deleteAction, isDeleting] = useActionState(
    deleteLandingPageAction,
    null
  )

  useEffect(() => {
    if (formState.success) toast.success("Landing page atualizada")
    if (formState.errors?._root) toast.error(formState.errors._root[0])
  }, [formState])

  return (
    <form action={updateAction}>
      <input type="hidden" name="id" value={landingPage.id} />
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
            id="active"
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
              defaultValue={formState.values?.name ?? landingPage.name}
              disabled={pending}
              aria-invalid={!!formState.errors?.name?.length}
              placeholder="Digite o nome aqui"
            />
            {formState.errors?.name && (
              <FieldError>{formState.errors.name[0]}</FieldError>
            )}
          </Field>
          <Field data-invalid={!!formState.errors?.slug?.length}>
            <FieldLabel htmlFor="slug">Slug (vazio = raiz)</FieldLabel>
            <Input
              id="slug"
              name="slug"
              defaultValue={formState.values?.slug ?? landingPage.slug}
              disabled={pending}
              aria-invalid={!!formState.errors?.slug?.length}
              placeholder="pinheiros"
              pattern="^[a-z0-9-]*$"
            />
            {formState.errors?.slug && (
              <FieldError>{formState.errors.slug[0]}</FieldError>
            )}
          </Field>
        </div>

        <div className="flex items-center justify-between">
          <Button type="submit" size="sm" disabled={pending}>
            {pending && <Spinner />}
            Salvar
          </Button>
          <form action={deleteAction}>
            <input type="hidden" name="id" value={landingPage.id} />
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
