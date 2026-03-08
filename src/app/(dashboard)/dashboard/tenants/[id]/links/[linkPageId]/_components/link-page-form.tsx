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
import { Textarea } from "@/components/ui/textarea"
import {
  updateLinkPageAction,
  deleteLinkPageAction,
} from "@/lib/actions/link-pages"
import type { LinkPageFormState } from "@/lib/validations/link-pages"

type LinkPage = {
  id: string
  slug: string
  title: string
  description: string | null
}

const initialState: LinkPageFormState = { errors: null, success: false }

export function LinkPageForm({
  tenantId,
  linkPage,
}: {
  tenantId: string
  linkPage: LinkPage
}) {
  const [formState, updateAction, pending] = useActionState(
    updateLinkPageAction,
    initialState
  )
  const [, deleteAction, isDeleting] = useActionState(
    deleteLinkPageAction,
    null
  )

  useEffect(() => {
    if (formState.success) toast.success("Pagina de links atualizada")
    if (formState.errors?._root) toast.error(formState.errors._root[0])
  }, [formState])

  return (
    <div>
      <form action={updateAction}>
        <input type="hidden" name="id" value={linkPage.id} />
        <input type="hidden" name="tenant_id" value={tenantId} />
        <FieldGroup>
          <div className="grid grid-cols-2 gap-3">
            <Field data-invalid={!!formState.errors?.title?.length}>
              <FieldLabel htmlFor="title">Titulo</FieldLabel>
              <Input
                id="title"
                name="title"
                defaultValue={
                  formState.values?.title ?? linkPage.title
                }
                disabled={pending}
                aria-invalid={!!formState.errors?.title?.length}
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
                defaultValue={
                  formState.values?.slug ?? linkPage.slug
                }
                disabled={pending}
                aria-invalid={!!formState.errors?.slug?.length}
                pattern="^[a-z0-9-]+$"
              />
              {formState.errors?.slug && (
                <FieldError>{formState.errors.slug[0]}</FieldError>
              )}
            </Field>
          </div>
          <Field data-invalid={!!formState.errors?.description?.length}>
            <FieldLabel htmlFor="description">
              Descricao (opcional)
            </FieldLabel>
            <Textarea
              id="description"
              name="description"
              defaultValue={
                formState.values?.description ??
                linkPage.description ??
                ""
              }
              disabled={pending}
              aria-invalid={!!formState.errors?.description?.length}
              rows={3}
            />
            {formState.errors?.description && (
              <FieldError>{formState.errors.description[0]}</FieldError>
            )}
          </Field>

          <div className="flex items-center justify-between">
            <Button type="submit" size="sm" disabled={pending}>
              {pending && <Spinner />}
              Salvar
            </Button>
            <form action={deleteAction}>
              <input type="hidden" name="id" value={linkPage.id} />
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
    </div>
  )
}
