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
  updateBioPageAction,
  deleteBioPageAction,
} from "@/lib/actions/bio-pages"
import type { BioPageFormState } from "@/lib/validations/bio-pages"

type BioPage = {
  id: string
  slug: string
  name: string
  active: boolean
}

const initialState: BioPageFormState = { errors: null, success: false }

export function BioPageForm({
  tenantId,
  bioPage,
}: {
  tenantId: string
  bioPage: BioPage
}) {
  const [active, setActive] = useState(bioPage.active)
  const [formState, updateAction, pending] = useActionState(
    updateBioPageAction,
    initialState
  )
  const [, deleteAction, isDeleting] = useActionState(
    deleteBioPageAction,
    null
  )

  useEffect(() => {
    if (formState.success) toast.success("Bio page atualizada")
    if (formState.errors?._root) toast.error(formState.errors._root[0])
  }, [formState])

  return (
    <div>
      <form action={updateAction}>
        <input type="hidden" name="id" value={bioPage.id} />
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
                defaultValue={
                  formState.values?.name ?? bioPage.name
                }
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
                defaultValue={
                  formState.values?.slug ?? bioPage.slug
                }
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

          <div className="flex items-center justify-between">
            <Button type="submit" size="sm" disabled={pending}>
              {pending && <Spinner />}
              Salvar
            </Button>
            <form action={deleteAction}>
              <input type="hidden" name="id" value={bioPage.id} />
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
    </div>
  )
}
