"use client"

import { useActionState, useEffect } from "react"
import { toast } from "sonner"

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
import { upsertLandingPageAction } from "@/lib/actions/landing-pages"
import type { LandingPageFormState } from "@/lib/validations/landing-pages"

type LandingPage = {
  id: string
  title: string
  description: string | null
  url: string | null
} | null

const initialState: LandingPageFormState = { errors: null, success: false }

export function LandingPageForm({
  tenantId,
  landingPage,
}: {
  tenantId: string
  landingPage: LandingPage
}) {
  const [formState, action, pending] = useActionState(
    upsertLandingPageAction,
    initialState
  )

  useEffect(() => {
    if (formState.success) toast.success("Landing page salva com sucesso")
    if (formState.errors?._root) toast.error(formState.errors._root[0])
  }, [formState])

  return (
    <form action={action}>
      <input type="hidden" name="tenant_id" value={tenantId} />
      <FieldGroup>
        <Field data-invalid={!!formState.errors?.title?.length}>
          <FieldLabel htmlFor="lp-title">Titulo</FieldLabel>
          <Input
            id="lp-title"
            name="title"
            defaultValue={formState.values?.title ?? landingPage?.title ?? ""}
            disabled={pending}
            aria-invalid={!!formState.errors?.title?.length}
            placeholder="Bem-vindo a Loja X"
          />
          {formState.errors?.title && (
            <FieldError>{formState.errors.title[0]}</FieldError>
          )}
        </Field>

        <Field data-invalid={!!formState.errors?.description?.length}>
          <FieldLabel htmlFor="lp-description">Descricao</FieldLabel>
          <Textarea
            id="lp-description"
            name="description"
            defaultValue={
              formState.values?.description ??
              landingPage?.description ??
              ""
            }
            disabled={pending}
            aria-invalid={!!formState.errors?.description?.length}
            placeholder="Conheca nossos produtos e servicos"
            rows={4}
          />
          {formState.errors?.description && (
            <FieldError>{formState.errors.description[0]}</FieldError>
          )}
        </Field>

        <Field data-invalid={!!formState.errors?.url?.length}>
          <FieldLabel htmlFor="lp-url">URL do CTA</FieldLabel>
          <Input
            id="lp-url"
            name="url"
            type="url"
            defaultValue={formState.values?.url ?? landingPage?.url ?? ""}
            disabled={pending}
            aria-invalid={!!formState.errors?.url?.length}
            placeholder="https://lojax.com"
          />
          {formState.errors?.url && (
            <FieldError>{formState.errors.url[0]}</FieldError>
          )}
        </Field>

        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending && <Spinner />}
            Salvar
          </Button>
        </div>
      </FieldGroup>
    </form>
  )
}
