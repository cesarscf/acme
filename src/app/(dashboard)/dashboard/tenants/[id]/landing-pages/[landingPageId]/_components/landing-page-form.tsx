"use client"

import { useActionState, useEffect, useState } from "react"
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
import {
  updateLandingPageAction,
  deleteLandingPageAction,
} from "@/lib/actions/landing-pages"
import type { LandingPageFormState } from "@/lib/validations/landing-pages"

type LandingPage = {
  id: string
  slug: string
  title: string
  description: string | null
  url: string | null
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
      <div className="mb-6 flex items-center justify-between rounded-lg border bg-muted/50 p-4">
        <div className="space-y-0.5">
          <span className="text-sm font-medium">Status</span>
          <p className="text-sm text-muted-foreground">
            {active ? "Visível publicamente" : "Oculta para visitantes"}
          </p>
        </div>
        <Switch
          id="active"
          checked={active}
          onCheckedChange={setActive}
          disabled={pending}
        />
      </div>
      <FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <Field data-invalid={!!formState.errors?.title?.length}>
            <FieldLabel htmlFor="title">Título</FieldLabel>
            <Input
              id="title"
              name="title"
              defaultValue={formState.values?.title ?? landingPage.title}
              disabled={pending}
              aria-invalid={!!formState.errors?.title?.length}
              placeholder="Digite o título aqui"
            />
            {formState.errors?.title && (
              <FieldError>{formState.errors.title[0]}</FieldError>
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
        <Field data-invalid={!!formState.errors?.description?.length}>
          <FieldLabel htmlFor="description">Descrição (opcional)</FieldLabel>
          <Textarea
            id="description"
            name="description"
            defaultValue={
              formState.values?.description ?? landingPage.description ?? ""
            }
            disabled={pending}
            aria-invalid={!!formState.errors?.description?.length}
            placeholder="Digite a descrição aqui"
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
            defaultValue={formState.values?.url ?? landingPage.url ?? ""}
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
            <input type="hidden" name="id" value={landingPage.id} />
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
