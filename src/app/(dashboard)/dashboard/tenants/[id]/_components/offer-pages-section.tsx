"use client"

import { useActionState, useCallback, useEffect, useState } from "react"
import { Gift, Plus } from "lucide-react"
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
import { createOfferPageAction } from "@/lib/actions/offer-pages"
import type { CreateOfferPageFormState } from "@/lib/validations/offer-pages"
import { PageCard } from "./page-card"

type OfferPage = {
  id: string
  slug: string
  name: string
  url: string | null
  active: boolean
}

const initialState: CreateOfferPageFormState = { errors: null, success: false }

export function OfferPagesSection({
  tenantId,
  tenantSlug,
  offerPages,
}: {
  tenantId: string
  tenantSlug?: string
  offerPages: OfferPage[]
}) {
  const [open, setOpen] = useState(false)

  const wrappedAction = useCallback(
    async (prev: CreateOfferPageFormState, formData: FormData) => {
      const result = await createOfferPageAction(prev, formData)
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
    if (formState.success) toast.success("Oferta criada")
    if (formState.errors?._root) toast.error(formState.errors._root[0])
  }, [formState])

  const createForm = (
    <form action={createAction}>
      <input type="hidden" name="tenant_id" value={tenantId} />
      <FieldGroup>
        <Field data-invalid={!!formState.errors?.name?.length}>
          <FieldLabel htmlFor="offer-name">Nome</FieldLabel>
          <Input
            id="offer-name"
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
          <FieldLabel htmlFor="offer-slug">Slug</FieldLabel>
          <div className="flex items-center">
            <span className="flex min-h-9 items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
              /ofertas/
            </span>
            <Input
              id="offer-slug"
              name="slug"
              placeholder="black-friday"
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
          Criar oferta
        </Button>
      </FieldGroup>
    </form>
  )

  return (
    <div className="space-y-4">
      {offerPages.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl bg-muted py-12">
          <Gift className="h-10 w-10 text-muted-foreground" />
          <p className="mt-4 text-sm font-medium">
            Nenhuma oferta cadastrada
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie uma oferta para o tenant
          </p>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="mt-4">
                <Plus className="mr-1 h-4 w-4" />
                Nova oferta
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova oferta</DialogTitle>
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
                  Nova oferta
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova oferta</DialogTitle>
                </DialogHeader>
                {createForm}
              </DialogContent>
            </Dialog>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {offerPages.map((offerPage) => (
              <PageCard
                key={offerPage.id}
                href={`/dashboard/tenants/${tenantId}/offers/${offerPage.id}`}
                name={offerPage.name}
                publicPath={`/ofertas/${offerPage.slug}`}
                tenantSlug={tenantSlug}
                active={offerPage.active}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
