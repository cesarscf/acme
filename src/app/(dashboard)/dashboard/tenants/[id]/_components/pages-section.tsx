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
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { createPageAction } from "@/lib/actions/pages"
import type { PageFormState } from "@/lib/validations/pages"
import { PageCard } from "./page-card"

type Page = {
  id: string
  path: string
  name: string
  templateSlug: string
  active: boolean
}

const initialState: PageFormState = { errors: null, success: false }

export function PagesSection({
  tenantId,
  tenantSlug,
  pages,
}: {
  tenantId: string
  tenantSlug?: string
  pages: Page[]
}) {
  const [open, setOpen] = useState(false)

  const wrappedAction = useCallback(
    async (prev: PageFormState, formData: FormData) => {
      const result = await createPageAction(prev, formData)
      if (result.success) setOpen(false)
      return result
    },
    []
  )

  const [formState, createAction, pending] = useActionState(wrappedAction, initialState)

  useEffect(() => {
    if (formState.success) toast.success("Página criada")
    if (formState.errors?._root) toast.error(formState.errors._root[0])
  }, [formState])

  const createForm = (
    <form action={createAction}>
      <input type="hidden" name="tenant_id" value={tenantId} />
      <input type="hidden" name="template_slug" value="generic" />
      <FieldGroup>
        <Field data-invalid={!!formState.errors?.name?.length}>
          <FieldLabel htmlFor="page-name">Nome</FieldLabel>
          <Input
            id="page-name"
            name="name"
            placeholder="Digite o nome aqui"
            defaultValue={formState.values?.name}
            disabled={pending}
            aria-invalid={!!formState.errors?.name?.length}
          />
          {formState.errors?.name && (
            <FieldError>{formState.errors.name[0]}</FieldError>
          )}
        </Field>
        <Field data-invalid={!!formState.errors?.path?.length}>
          <FieldLabel htmlFor="page-path">Path</FieldLabel>
          <div className="flex items-center">
            <span className="flex min-h-9 items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
              /
            </span>
            <Input
              id="page-path"
              name="path"
              placeholder="meus-links/pinheiros"
              defaultValue={formState.values?.path}
              disabled={pending}
              aria-invalid={!!formState.errors?.path?.length}
              pattern="^[a-z0-9/-]*$"
              className="rounded-l-none"
            />
          </div>
          <FieldDescription>
            Deixe vazio para usar como página raiz do tenant
          </FieldDescription>
          {formState.errors?.path && (
            <FieldError>{formState.errors.path[0]}</FieldError>
          )}
        </Field>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending && <Spinner />}
          Criar página
        </Button>
      </FieldGroup>
    </form>
  )

  return (
    <div className="space-y-4">
      {pages.length === 0 ? (
        <Empty className="bg-muted rounded-lg">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileText />
            </EmptyMedia>
            <EmptyTitle>Nenhuma página cadastrada</EmptyTitle>
            <EmptyDescription>Crie uma página para o tenant</EmptyDescription>
          </EmptyHeader>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus data-icon="inline-start" />
                Nova página
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova página</DialogTitle>
              </DialogHeader>
              {createForm}
            </DialogContent>
          </Dialog>
        </Empty>
      ) : (
        <>
          <div className="flex justify-end">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus data-icon="inline-start" />
                  Nova página
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova página</DialogTitle>
                </DialogHeader>
                {createForm}
              </DialogContent>
            </Dialog>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {pages.map((page) => (
              <PageCard
                key={page.id}
                href={`/dashboard/tenants/${tenantId}/pages/${page.id}`}
                name={page.name}
                publicPath={page.path ? `/${page.path}` : "/"}
                tenantSlug={tenantSlug}
                active={page.active}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
