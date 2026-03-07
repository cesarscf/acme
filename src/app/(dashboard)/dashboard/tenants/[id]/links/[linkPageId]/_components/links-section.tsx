"use client"

import { useActionState, useEffect } from "react"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createLinkAction, deleteLinkAction } from "@/lib/actions/links"

type Link = {
  id: string
  title: string
  url: string
  position: number
}

export function LinksSection({
  tenantId,
  linkPageId,
  links,
}: {
  tenantId: string
  linkPageId: string
  links: Link[]
}) {
  const [createState, createAction, isCreating] = useActionState(
    createLinkAction,
    null
  )
  const [, deleteAction, isDeleting] = useActionState(deleteLinkAction, null)

  useEffect(() => {
    if (createState?.success) toast.success("Link adicionado")
    if (createState?.error) toast.error(createState.error)
  }, [createState])

  return (
    <div className="space-y-3">
      {links.map((link) => (
        <div
          key={link.id}
          className="flex items-center justify-between rounded-lg border bg-card p-3"
        >
          <div>
            <p className="text-sm font-medium">{link.title}</p>
            <p className="text-xs text-muted-foreground">{link.url}</p>
          </div>
          <form action={deleteAction}>
            <input type="hidden" name="id" value={link.id} />
            <input type="hidden" name="tenant_id" value={tenantId} />
            <input type="hidden" name="link_page_id" value={linkPageId} />
            <Button variant="ghost" size="icon" disabled={isDeleting}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </form>
        </div>
      ))}

      <form
        action={createAction}
        className="space-y-3 rounded-lg border bg-card p-4"
      >
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">Novo link</p>
        </div>
        <input type="hidden" name="link_page_id" value={linkPageId} />
        <input type="hidden" name="tenant_id" value={tenantId} />
        <input type="hidden" name="position" value={links.length} />
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="link-title">Titulo</Label>
            <Input
              id="link-title"
              name="title"
              placeholder="Instagram"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="link-url">URL</Label>
            <Input
              id="link-url"
              name="url"
              type="url"
              placeholder="https://instagram.com/lojax"
              required
            />
          </div>
        </div>

        <Button type="submit" size="sm" disabled={isCreating}>
          {isCreating ? "Adicionando..." : "Adicionar link"}
        </Button>
      </form>
    </div>
  )
}
