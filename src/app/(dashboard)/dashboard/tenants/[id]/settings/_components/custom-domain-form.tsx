"use client"

import { useActionState, useEffect } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { updateCustomDomainAction } from "@/lib/actions/tenants"
import type { CustomDomainFormState } from "@/lib/validations/tenants"

const initialState: CustomDomainFormState = { errors: null, success: false }

export function CustomDomainForm({
  tenantId,
  customDomain,
}: {
  tenantId: string
  customDomain: string | null
}) {
  const [formState, action, pending] = useActionState(
    updateCustomDomainAction,
    initialState
  )

  useEffect(() => {
    if (formState.success) toast.success("Dominio atualizado")
    if (formState.errors?._root) toast.error(formState.errors._root[0])
  }, [formState])

  return (
    <form action={action}>
      <input type="hidden" name="tenant_id" value={tenantId} />
      <FieldGroup>
        <Field data-invalid={!!formState.errors?.customDomain?.length}>
          <FieldLabel htmlFor="custom-domain">Dominio</FieldLabel>
          <Input
            id="custom-domain"
            name="custom_domain"
            defaultValue={
              formState.values?.customDomain ?? customDomain ?? ""
            }
            disabled={pending}
            aria-invalid={!!formState.errors?.customDomain?.length}
            placeholder="meusite.com.br"
          />
          <FieldDescription>
            Deixe vazio para remover o dominio personalizado
          </FieldDescription>
          {formState.errors?.customDomain && (
            <FieldError>{formState.errors.customDomain[0]}</FieldError>
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
