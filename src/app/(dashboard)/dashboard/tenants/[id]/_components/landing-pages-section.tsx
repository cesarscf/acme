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
import { createLandingPageAction } from "@/lib/actions/landing-pages"
import type { LandingPageFormState } from "@/lib/validations/landing-pages"
import { PageCard } from "./page-card"

type LandingPage = {
  id: string
  slug: string
  name: string
  active: boolean
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
        <Field data-invalid={!!formState.errors?.name?.length}>
          <FieldLabel htmlFor="lp-name">Nome</FieldLabel>
          <Input
            id="lp-name"
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
          <FieldLabel htmlFor="lp-slug">Slug</FieldLabel>
          <div className="flex items-center">
            <span className="flex min-h-9 items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
              /
            </span>
            <Input
              id="lp-slug"
              name="slug"
              placeholder="pinheiros"
              defaultValue={formState.values?.slug}
              disabled={pending}
              aria-invalid={!!formState.errors?.slug?.length}
              pattern="^[a-z0-9-]*$"
              className="rounded-l-none"
            />
          </div>
          <FieldDescription>
            Deixe vazio para usar como página raiz do tenant
          </FieldDescription>
          {formState.errors?.slug && (
            <FieldError>{formState.errors.slug[0]}</FieldError>
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
        <Empty className="bg-muted rounded-lg">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileText />
            </EmptyMedia>
            <EmptyTitle>Nenhuma landing page cadastrada</EmptyTitle>
            <EmptyDescription>
              Crie uma landing page para o tenant
            </EmptyDescription>
          </EmptyHeader>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus data-icon="inline-start" />
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
        </Empty>
      ) : (
        <>
          <div className="flex justify-end">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus data-icon="inline-start" />
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
              <PageCard
                key={lp.id}
                href={`/dashboard/tenants/${tenantId}/landing-pages/${lp.id}`}
                name={lp.name}
                publicPath={`/${lp.slug}`}
                tenantSlug={tenantSlug}
                active={lp.active}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
