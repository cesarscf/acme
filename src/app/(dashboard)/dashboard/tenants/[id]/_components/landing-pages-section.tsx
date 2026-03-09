"use client"

import { useActionState, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ExternalLink, FileText, Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { createLandingPageAction } from "@/lib/actions/landing-pages"
import type { LandingPageFormState } from "@/lib/validations/landing-pages"
import { protocol, rootDomain } from "@/lib/utils"

type LandingPage = {
  id: string
  slug: string
  title: string
  description: string | null
  url: string | null
}

const initialState: LandingPageFormState = { errors: null, success: false }

export function LandingPagesSection({
  tenantId,
  tenantSlug,
  landingPages,
}: {
  tenantId: string
  tenantSlug?: string
  landingPages: LandingPage[]
}) {
  const [open, setOpen] = useState(false)

  const wrappedAction = useCallback(
    async (prev: LandingPageFormState, formData: FormData) => {
      const result = await createLandingPageAction(prev, formData)
      if (result.success) setOpen(false)
      return result
    },
    []
  )

  const [formState, createAction, pending] = useActionState(
    wrappedAction,
    initialState
  )

  useEffect(() => {
    if (formState.success) toast.success("Landing page criada")
    if (formState.errors?._root) toast.error(formState.errors._root[0])
  }, [formState])

  const createForm = (
    <form action={createAction}>
      <input type="hidden" name="tenant_id" value={tenantId} />
      <FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <Field data-invalid={!!formState.errors?.title?.length}>
            <FieldLabel htmlFor="lp-title">Titulo</FieldLabel>
            <Input
              id="lp-title"
              name="title"
              placeholder="Digite o titulo aqui"
              defaultValue={formState.values?.title}
              disabled={pending}
              aria-invalid={!!formState.errors?.title?.length}
            />
            {formState.errors?.title && (
              <FieldError>{formState.errors.title[0]}</FieldError>
            )}
          </Field>
          <Field data-invalid={!!formState.errors?.slug?.length}>
            <FieldLabel htmlFor="lp-slug">Slug (vazio = raiz)</FieldLabel>
            <Input
              id="lp-slug"
              name="slug"
              placeholder="pinheiros"
              defaultValue={formState.values?.slug}
              disabled={pending}
              aria-invalid={!!formState.errors?.slug?.length}
              pattern="^[a-z0-9-]*$"
            />
            {formState.errors?.slug && (
              <FieldError>{formState.errors.slug[0]}</FieldError>
            )}
          </Field>
        </div>
        <Field data-invalid={!!formState.errors?.description?.length}>
          <FieldLabel htmlFor="lp-description">Descricao (opcional)</FieldLabel>
          <Input
            id="lp-description"
            name="description"
            placeholder="Digite a descricao aqui"
            defaultValue={formState.values?.description}
            disabled={pending}
            aria-invalid={!!formState.errors?.description?.length}
          />
          {formState.errors?.description && (
            <FieldError>{formState.errors.description[0]}</FieldError>
          )}
        </Field>
        <Field data-invalid={!!formState.errors?.url?.length}>
          <FieldLabel htmlFor="lp-url">URL do CTA (opcional)</FieldLabel>
          <Input
            id="lp-url"
            name="url"
            type="url"
            placeholder="https://exemplo.com"
            defaultValue={formState.values?.url}
            disabled={pending}
            aria-invalid={!!formState.errors?.url?.length}
          />
          {formState.errors?.url && (
            <FieldError>{formState.errors.url[0]}</FieldError>
          )}
        </Field>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending && <Spinner />}
          Criar landing page
        </Button>
      </FieldGroup>
    </form>
  )

  return (
    <div className="space-y-4">
      {landingPages.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl bg-muted py-12">
          <FileText className="h-10 w-10 text-muted-foreground" />
          <p className="mt-4 text-sm font-medium">
            Nenhuma landing page cadastrada
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie uma landing page para o tenant
          </p>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="mt-4">
                <Plus className="mr-1 h-4 w-4" />
                Nova landing page
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova landing page</DialogTitle>
              </DialogHeader>
              {createForm}
            </DialogContent>
          </Dialog>
        </div>
      ) : (
        <>
          <div className="flex justify-end">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1 h-4 w-4" />
                  Nova landing page
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova landing page</DialogTitle>
                </DialogHeader>
                {createForm}
              </DialogContent>
            </Dialog>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {landingPages.map((lp) => (
              <div
                key={lp.id}
                className="rounded-xl bg-muted p-5 shadow-xs transition-shadow hover:shadow-md space-y-1"
              >
                <div className="flex items-center justify-between">
                  <Link
                    href={`/dashboard/tenants/${tenantId}/landing-pages/${lp.id}`}
                    className="font-semibold hover:underline"
                  >
                    {lp.title}
                  </Link>
                  {tenantSlug && (
                    <a
                      href={`${protocol}://${tenantSlug}.${rootDomain}/${lp.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="ghost" size="icon-sm">
                        <ExternalLink className="size-4" />
                      </Button>
                    </a>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  <span>/{lp.slug || "(raiz)"}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
