"use client"

import { useActionState, useEffect } from "react"
import Link from "next/link"
import { Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createLinkPageAction } from "@/lib/actions/link-pages"

type LinkPage = {
  id: string
  slug: string
  title: string
  description: string | null
  links: { id: string }[]
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

  useEffect(() => {
    if (createState?.success) toast.success("Pagina de links criada")
    if (createState?.error) toast.error(createState.error)
  }, [createState])

  return (
    <div className="space-y-4">
      {linkPages.length > 0 && (
        <div className="space-y-2">
          {linkPages.map((linkPage) => (
            <Link
              key={linkPage.id}
              href={`/dashboard/tenants/${tenantId}/links/${linkPage.id}`}
              className="block rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{linkPage.title}</p>
                  <p className="text-sm text-muted-foreground">
                    /links/{linkPage.slug}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {linkPage.links.length}{" "}
                  {linkPage.links.length === 1 ? "link" : "links"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      <form
        action={createAction}
        className="space-y-3 rounded-lg border bg-card p-4"
      >
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">Nova pagina de links</p>
        </div>
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
