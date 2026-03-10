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
import { createBioPageAction } from "@/lib/actions/bio-pages"
import type { BioPageFormState } from "@/lib/validations/bio-pages"
import { PageCard } from "./page-card"

type BioPage = {
  id: string
  slug: string
  name: string
  active: boolean
  links: { id: string }[]
}

const initialState: BioPageFormState = { errors: null, success: false }

export function BioPagesSection({
  tenantId,
  tenantSlug,
  bioPages,
}: {
  tenantId: string
  tenantSlug?: string
  bioPages: BioPage[]
}) {
  const [open, setOpen] = useState(false)

  const wrappedAction = useCallback(
    async (prev: BioPageFormState, formData: FormData) => {
      const result = await createBioPageAction(prev, formData)
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
    if (formState.success) toast.success("Bio page criada")
    if (formState.errors?._root) toast.error(formState.errors._root[0])
  }, [formState])

  const createForm = (
    <form action={createAction}>
      <input type="hidden" name="tenant_id" value={tenantId} />
      <FieldGroup>
        <Field data-invalid={!!formState.errors?.name?.length}>
          <FieldLabel htmlFor="biopage-name">Nome</FieldLabel>
          <Input
            id="biopage-name"
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
        <Field data-invalid={!!formState.errors?.slug?.length}>
          <FieldLabel htmlFor="biopage-slug">Slug</FieldLabel>
          <div className="flex items-center">
            <span className="flex min-h-9 items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
              /bios/
            </span>
            <Input
              id="biopage-slug"
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
          Criar bio page
        </Button>
      </FieldGroup>
    </form>
  )

  return (
    <div className="space-y-4">
      {bioPages.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl bg-muted py-12">
          <FileText className="h-10 w-10 text-muted-foreground" />
          <p className="mt-4 text-sm font-medium">
            Nenhuma bio page cadastrada
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie uma bio page para o tenant
          </p>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="mt-4">
                <Plus className="mr-1 h-4 w-4" />
                Nova bio page
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova bio page</DialogTitle>
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
                  Nova bio page
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova bio page</DialogTitle>
                </DialogHeader>
                {createForm}
              </DialogContent>
            </Dialog>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {bioPages.map((bioPage) => (
              <PageCard
                key={bioPage.id}
                href={`/dashboard/tenants/${tenantId}/bios/${bioPage.id}`}
                name={bioPage.name}
                publicPath={`/bios/${bioPage.slug}`}
                tenantSlug={tenantSlug}
                active={bioPage.active}
                extra={
                  <span>
                    {bioPage.links.length}{" "}
                    {bioPage.links.length === 1 ? "link" : "links"}
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
