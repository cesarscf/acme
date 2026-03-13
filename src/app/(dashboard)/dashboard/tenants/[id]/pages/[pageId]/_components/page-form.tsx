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
import { updatePageAction, deletePageAction } from "@/lib/actions/pages"
import type { PageFormState } from "@/lib/validations/pages"

type Page = {
  id: string
  path: string
  name: string
  active: boolean
}

const initialState: PageFormState = { errors: null, success: false }

export function PageForm({
  tenantId,
  page,
}: {
  tenantId: string
  page: Page
}) {
  const [active, setActive] = useState(page.active)
  const [formState, updateAction, pending] = useActionState(updatePageAction, initialState)
  const [, deleteAction, isDeleting] = useActionState(deletePageAction, null)

  useEffect(() => {
    if (formState.success) toast.success("Página atualizada")
    if (formState.errors?._root) toast.error(formState.errors._root[0])
  }, [formState])

  return (
    <form action={updateAction}>
      <input type="hidden" name="id" value={page.id} />
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
              defaultValue={formState.values?.name ?? page.name}
              disabled={pending}
              aria-invalid={!!formState.errors?.name?.length}
              placeholder="Digite o nome aqui"
            />
            {formState.errors?.name && (
              <FieldError>{formState.errors.name[0]}</FieldError>
            )}
          </Field>
          <Field data-invalid={!!formState.errors?.path?.length}>
            <FieldLabel htmlFor="path">Path (vazio = raiz)</FieldLabel>
            <Input
              id="path"
              name="path"
              defaultValue={formState.values?.path ?? page.path}
              disabled={pending}
              aria-invalid={!!formState.errors?.path?.length}
              placeholder="meus-links/pinheiros"
              pattern="^[a-z0-9/-]*$"
            />
            {formState.errors?.path && (
              <FieldError>{formState.errors.path[0]}</FieldError>
            )}
          </Field>
        </div>

        <div className="flex items-center justify-between">
          <Button type="submit" size="sm" disabled={pending}>
            {pending && <Spinner />}
            Salvar
          </Button>
          <form action={deleteAction}>
            <input type="hidden" name="id" value={page.id} />
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
