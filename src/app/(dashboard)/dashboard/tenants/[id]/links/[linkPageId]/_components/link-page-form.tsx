"use client"

import { useActionState, useEffect } from "react"
import { toast } from "sonner"
import { Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  updateLinkPageAction,
  deleteLinkPageAction,
} from "@/lib/actions/link-pages"

type LinkPage = {
  id: string
  slug: string
  title: string
  description: string | null
}

export function LinkPageForm({
  tenantId,
  linkPage,
}: {
  tenantId: string
  linkPage: LinkPage
}) {
  const [updateState, updateAction, isUpdating] = useActionState(
    updateLinkPageAction,
    null
  )
  const [, deleteAction, isDeleting] = useActionState(
    deleteLinkPageAction,
    null
  )

  useEffect(() => {
    if (updateState?.success) toast.success("Pagina de links atualizada")
    if (updateState?.error) toast.error(updateState.error)
  }, [updateState])

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <form action={updateAction} className="space-y-3">
        <input type="hidden" name="id" value={linkPage.id} />
        <input type="hidden" name="tenant_id" value={tenantId} />
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="title">Titulo</Label>
            <Input
              id="title"
              name="title"
              defaultValue={linkPage.title}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              name="slug"
              defaultValue={linkPage.slug}
              required
              pattern="^[a-z0-9-]+$"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="description">Descricao (opcional)</Label>
          <Input
            id="description"
            name="description"
            defaultValue={linkPage.description ?? ""}
          />
        </div>

        <div className="flex items-center justify-between">
          <Button type="submit" size="sm" disabled={isUpdating}>
            {isUpdating ? "Salvando..." : "Salvar"}
          </Button>
          <form action={deleteAction}>
            <input type="hidden" name="id" value={linkPage.id} />
            <input type="hidden" name="tenant_id" value={tenantId} />
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </form>
    </div>
  )
}
