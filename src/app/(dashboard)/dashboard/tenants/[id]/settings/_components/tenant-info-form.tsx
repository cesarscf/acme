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
import { updateTenantAction } from "@/lib/actions/tenants"
import type { UpdateTenantFormState } from "@/lib/validations/tenants"
import { rootDomain } from "@/lib/utils"

const initialState: UpdateTenantFormState = { errors: null, success: false }

export function TenantInfoForm({
  tenantId,
  name,
  slug,
}: {
  tenantId: string
  name: string
  slug: string
}) {
  const [formState, action, pending] = useActionState(
    updateTenantAction,
    initialState
  )

  useEffect(() => {
    if (formState.success) toast.success("Tenant atualizado")
    if (formState.errors?._root) toast.error(formState.errors._root[0])
  }, [formState])

  return (
    <form action={action}>
      <input type="hidden" name="tenant_id" value={tenantId} />
      <FieldGroup>
        <Field data-invalid={!!formState.errors?.name?.length}>
          <FieldLabel htmlFor="tenant-name">Nome</FieldLabel>
          <Input
            id="tenant-name"
            name="name"
            defaultValue={formState.values?.name ?? name}
            disabled={pending}
            aria-invalid={!!formState.errors?.name?.length}
            placeholder="Digite o nome aqui"
          />
          {formState.errors?.name && (
            <FieldError>{formState.errors.name[0]}</FieldError>
          )}
        </Field>
        <Field data-invalid={!!formState.errors?.slug?.length}>
          <FieldLabel htmlFor="tenant-slug">Slug</FieldLabel>
          <div className="flex items-center">
            <Input
              id="tenant-slug"
              name="slug"
              defaultValue={formState.values?.slug ?? slug}
              disabled={pending}
              aria-invalid={!!formState.errors?.slug?.length}
              placeholder="Digite o slug aqui"
              pattern="^[a-z0-9-]+$"
              className="rounded-r-none"
            />
            <span className="flex min-h-9 items-center rounded-r-md border border-l-0 border-input bg-muted px-3 text-sm text-muted-foreground">
              .{rootDomain}
            </span>
          </div>
          {formState.errors?.slug && (
            <FieldError>{formState.errors.slug[0]}</FieldError>
          )}
        </Field>
        <div>
          <Button type="submit" size="sm" disabled={pending}>
            {pending && <Spinner />}
            Salvar
          </Button>
        </div>
      </FieldGroup>
    </form>
  )
}
