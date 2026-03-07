"use client"

import { useActionState } from "react"
import { Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { deleteTenantAction } from "@/lib/actions/tenants"

export function DeleteTenantButton({ tenantId }: { tenantId: string }) {
  const [, action, isPending] = useActionState(deleteTenantAction, null)

  return (
    <form action={action}>
      <input type="hidden" name="id" value={tenantId} />
      <Button variant="destructive" size="sm" disabled={isPending}>
        <Trash2 className="mr-1 h-4 w-4" />
        {isPending ? "Excluindo..." : "Excluir"}
      </Button>
    </form>
  )
}
