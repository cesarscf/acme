"use client"

import { useActionState, useCallback, useEffect, useState } from "react"
import { Link2, Plus, Trash2 } from "lucide-react"
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
import { createLinkAction, deleteLinkAction } from "@/lib/actions/links"
import type { CreateLinkFormState } from "@/lib/validations/links"

type Link = {
  id: string
  title: string
  url: string
  position: number
}

const initialState: CreateLinkFormState = { errors: null, success: false }

export function LinksSection({
  tenantId,
  linkPageId,
  links,
}: {
  tenantId: string
  linkPageId: string
  links: Link[]
}) {
  const [open, setOpen] = useState(false)

  const wrappedAction = useCallback(
    async (prev: CreateLinkFormState, formData: FormData) => {
      const result = await createLinkAction(prev, formData)
      if (result.success) setOpen(false)
      return result
    },
    []
  )

  const [formState, createAction, pending] = useActionState(
    wrappedAction,
    initialState
  )
  const [, deleteAction, isDeleting] = useActionState(deleteLinkAction, null)

  useEffect(() => {
    if (formState.success) toast.success("Link adicionado")
    if (formState.errors?._root) toast.error(formState.errors._root[0])
  }, [formState])

  const createForm = (
    <form action={createAction}>
      <input type="hidden" name="link_page_id" value={linkPageId} />
      <input type="hidden" name="tenant_id" value={tenantId} />
      <input type="hidden" name="position" value={links.length} />
      <FieldGroup>
        <Field data-invalid={!!formState.errors?.title?.length}>
          <FieldLabel htmlFor="link-title">Titulo</FieldLabel>
          <Input
            id="link-title"
            name="title"
            placeholder="Instagram"
            defaultValue={formState.values?.title}
            disabled={pending}
            aria-invalid={!!formState.errors?.title?.length}
          />
          {formState.errors?.title && (
            <FieldError>{formState.errors.title[0]}</FieldError>
          )}
        </Field>
        <Field data-invalid={!!formState.errors?.url?.length}>
          <FieldLabel htmlFor="link-url">URL</FieldLabel>
          <Input
            id="link-url"
            name="url"
            type="url"
            placeholder="https://instagram.com/lojax"
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
          Adicionar link
        </Button>
      </FieldGroup>
    </form>
  )

  return (
    <div className="space-y-3">
      {links.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl bg-muted py-12">
          <Link2 className="h-10 w-10 text-muted-foreground" />
          <p className="mt-4 text-sm font-medium">Nenhum link cadastrado</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Adicione o primeiro link a esta pagina
          </p>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="mt-4">
                <Plus className="mr-1 h-4 w-4" />
                Novo link
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo link</DialogTitle>
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
                  Novo link
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Novo link</DialogTitle>
                </DialogHeader>
                {createForm}
              </DialogContent>
            </Dialog>
          </div>
          {links.map((link) => (
            <div
              key={link.id}
              className="flex items-center justify-between rounded-xl bg-muted p-4"
            >
              <div>
                <p className="text-sm font-medium">{link.title}</p>
                <p className="text-xs text-muted-foreground">{link.url}</p>
              </div>
              <form action={deleteAction}>
                <input type="hidden" name="id" value={link.id} />
                <input type="hidden" name="tenant_id" value={tenantId} />
                <input type="hidden" name="link_page_id" value={linkPageId} />
                <Button variant="destructive" size="icon" disabled={isDeleting}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </form>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
