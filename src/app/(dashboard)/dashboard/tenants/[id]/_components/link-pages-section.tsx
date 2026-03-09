"use client"

import { useActionState, useCallback, useEffect, useState } from "react"
import { FileText, Plus } from "lucide-react"
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
import { createLinkPageAction } from "@/lib/actions/link-pages"
import type { LinkPageFormState } from "@/lib/validations/link-pages"
import { PageCard } from "./page-card"

type LinkPage = {
  id: string
  slug: string
  title: string
  description: string | null
  active: boolean
  links: { id: string }[]
}

const initialState: LinkPageFormState = { errors: null, success: false }

export function LinkPagesSection({
  tenantId,
  tenantSlug,
  linkPages,
}: {
  tenantId: string
  tenantSlug?: string
  linkPages: LinkPage[]
}) {
  const [open, setOpen] = useState(false)

  const wrappedAction = useCallback(
    async (prev: LinkPageFormState, formData: FormData) => {
      const result = await createLinkPageAction(prev, formData)
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
    if (formState.success) toast.success("Página de links criada")
    if (formState.errors?._root) toast.error(formState.errors._root[0])
  }, [formState])

  const createForm = (
    <form action={createAction}>
      <input type="hidden" name="tenant_id" value={tenantId} />
      <FieldGroup>
        <Field data-invalid={!!formState.errors?.title?.length}>
          <FieldLabel htmlFor="linkpage-title">Título</FieldLabel>
          <Input
            id="linkpage-title"
            name="title"
            placeholder="Digite o título aqui"
            defaultValue={formState.values?.title}
            disabled={pending}
            aria-invalid={!!formState.errors?.title?.length}
          />
          {formState.errors?.title && (
            <FieldError>{formState.errors.title[0]}</FieldError>
          )}
        </Field>
        <Field data-invalid={!!formState.errors?.slug?.length}>
          <FieldLabel htmlFor="linkpage-slug">Slug</FieldLabel>
          <div className="flex items-center">
            <span className="flex min-h-9 items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
              /links/
            </span>
            <Input
              id="linkpage-slug"
              name="slug"
              placeholder="vitoria"
              defaultValue={formState.values?.slug}
              disabled={pending}
              aria-invalid={!!formState.errors?.slug?.length}
              pattern="^[a-z0-9-]+$"
              className="rounded-l-none"
            />
          </div>
          {formState.errors?.slug && (
            <FieldError>{formState.errors.slug[0]}</FieldError>
          )}
        </Field>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending && <Spinner />}
          Criar página de links
        </Button>
      </FieldGroup>
    </form>
  )

  return (
    <div className="space-y-4">
      {linkPages.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl bg-muted py-12">
          <FileText className="h-10 w-10 text-muted-foreground" />
          <p className="mt-4 text-sm font-medium">
            Nenhuma página de links cadastrada
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie uma página de links para o tenant
          </p>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="mt-4">
                <Plus className="mr-1 h-4 w-4" />
                Nova página de links
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova página de links</DialogTitle>
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
                  Nova página de links
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova página de links</DialogTitle>
                </DialogHeader>
                {createForm}
              </DialogContent>
            </Dialog>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {linkPages.map((linkPage) => (
              <PageCard
                key={linkPage.id}
                href={`/dashboard/tenants/${tenantId}/links/${linkPage.id}`}
                title={linkPage.title}
                publicPath={`/links/${linkPage.slug}`}
                tenantSlug={tenantSlug}
                active={linkPage.active}
                extra={
                  <span>
                    {linkPage.links.length}{" "}
                    {linkPage.links.length === 1 ? "link" : "links"}
                  </span>
                }
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
