"use client"

import { useActionState, useEffect, useState } from "react"
import { Plus } from "lucide-react"
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
import { createTenantAction } from "@/lib/actions/tenants"
import type { CreateTenantFormState } from "@/lib/validations/tenants"
import { cn } from "@/lib/utils"

const initialState: CreateTenantFormState = { errors: null, success: false }

export function CreateTenantDialog({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const [formState, action, pending] = useActionState(
    createTenantAction,
    initialState
  )

  useEffect(() => {
    if (formState.errors?._root) toast.error(formState.errors._root[0])
  }, [formState])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className={cn(className)}>
          <Plus className="mr-1 h-4 w-4" />
          Novo tenant
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo tenant</DialogTitle>
        </DialogHeader>
        <form action={action}>
          <FieldGroup>
            <Field data-invalid={!!formState.errors?.name?.length}>
              <FieldLabel htmlFor="name">Nome</FieldLabel>
              <Input
                id="name"
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
              <FieldLabel htmlFor="slug">Slug</FieldLabel>
              <div className="flex items-center">
                <Input
                  id="slug"
                  name="slug"
                  placeholder="Digite o slug aqui"
                  defaultValue={formState.values?.slug}
                  disabled={pending}
                  aria-invalid={!!formState.errors?.slug?.length}
                  pattern="^[a-z0-9-]+$"
                  title="Apenas letras minúsculas, números e hífens"
                  className="rounded-r-none"
                />
                <span className="flex min-h-9 items-center rounded-r-md border border-l-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                  .acme.com
                </span>
              </div>
              {formState.errors?.slug && (
                <FieldError>{formState.errors.slug[0]}</FieldError>
              )}
            </Field>

            <Button type="submit" className="w-full" disabled={pending}>
              {pending && <Spinner />}
              Criar tenant
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}
