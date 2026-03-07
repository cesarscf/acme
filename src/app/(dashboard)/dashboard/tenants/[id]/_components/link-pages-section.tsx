"use client"

import { useActionState, useEffect } from "react"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  createLinkPageAction,
  deleteLinkPageAction,
} from "@/lib/actions/link-pages"
import { createLinkAction, deleteLinkAction } from "@/lib/actions/links"

type Link = {
  id: string
  title: string
  url: string
  position: number
}

type LinkPage = {
  id: string
  slug: string
  title: string
  description: string | null
  links: Link[]
}

function LinksSubsection({
  tenantId,
  linkPage,
}: {
  tenantId: string
  linkPage: LinkPage
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
    <div className="space-y-2 border-l-2 border-muted pl-4">
      {linkPage.links.map((link) => (
        <div
          key={link.id}
          className="flex items-center justify-between rounded-md border bg-background p-2"
        >
          <div>
            <p className="text-sm font-medium">{link.title}</p>
            <p className="text-xs text-muted-foreground">{link.url}</p>
          </div>
          <form action={deleteAction}>
            <input type="hidden" name="id" value={link.id} />
            <input type="hidden" name="tenant_id" value={tenantId} />
            <Button variant="ghost" size="icon" disabled={isDeleting}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </form>
        </div>
      ))}

      <form
        action={createAction}
        className="space-y-2 rounded-md border bg-background p-3"
      >
        <input type="hidden" name="link_page_id" value={linkPage.id} />
        <input type="hidden" name="tenant_id" value={tenantId} />
        <input type="hidden" name="position" value={linkPage.links.length} />
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor={`link-title-${linkPage.id}`}>Titulo</Label>
            <Input
              id={`link-title-${linkPage.id}`}
              name="title"
              placeholder="Instagram"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`link-url-${linkPage.id}`}>URL</Label>
            <Input
              id={`link-url-${linkPage.id}`}
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

export function LinkPagesSection({
  tenantId,
  linkPages,
}: {
  tenantId: string
  linkPages: LinkPage[]
}) {
  const [createState, createAction, isCreating] = useActionState(
    createLinkPageAction,
    null
  )
  const [, deleteAction, isDeleting] = useActionState(
    deleteLinkPageAction,
    null
  )

  useEffect(() => {
    if (createState?.success) toast.success("Pagina de links criada")
    if (createState?.error) toast.error(createState.error)
  }, [createState])

  return (
    <div className="space-y-4">
      {linkPages.map((linkPage) => (
        <div
          key={linkPage.id}
          className="space-y-3 rounded-lg border bg-card p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{linkPage.title}</p>
              <p className="text-sm text-muted-foreground">/links/{linkPage.slug}</p>
            </div>
            <form action={deleteAction}>
              <input type="hidden" name="id" value={linkPage.id} />
              <input type="hidden" name="tenant_id" value={tenantId} />
              <Button variant="ghost" size="icon" disabled={isDeleting}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </form>
          </div>

          <LinksSubsection tenantId={tenantId} linkPage={linkPage} />
        </div>
      ))}

      <form
        action={createAction}
        className="space-y-3 rounded-lg border bg-card p-4"
      >
        <input type="hidden" name="tenant_id" value={tenantId} />
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="linkpage-title">Titulo</Label>
            <Input
              id="linkpage-title"
              name="title"
              placeholder="Links Vitoria"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="linkpage-slug">Slug</Label>
            <Input
              id="linkpage-slug"
              name="slug"
              placeholder="vitoria"
              required
              pattern="^[a-z0-9-]+$"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="linkpage-description">Descricao (opcional)</Label>
          <Input
            id="linkpage-description"
            name="description"
            placeholder="Links da loja de Vitoria"
          />
        </div>

        <Button type="submit" size="sm" disabled={isCreating}>
          {isCreating ? "Adicionando..." : "Adicionar pagina de links"}
        </Button>
      </form>
    </div>
  )
}
