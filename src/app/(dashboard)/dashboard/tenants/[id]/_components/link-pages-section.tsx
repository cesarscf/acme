"use client"

import { useActionState, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ExternalLink, FileText, Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createLinkPageAction } from "@/lib/actions/link-pages"
import { protocol, rootDomain } from "@/lib/utils"

type LinkPage = {
  id: string
  slug: string
  title: string
  description: string | null
  links: { id: string }[]
}

export function LinkPagesSection({
  tenantId,
  tenantSlug,
  linkPages,
}: {
  tenantId: string
  tenantSlug?: string
  linkPages: LinkPage[]
}) {
  const [open, setOpen] = useState(false)

  const wrappedAction = useCallback(
    async (prev: unknown, formData: FormData) => {
      const result = await createLinkPageAction(prev, formData)
      if (result?.success) setOpen(false)
      return result
    },
    []
  )

  const [createState, createAction, isCreating] = useActionState(
    wrappedAction,
    null
  )

  useEffect(() => {
    if (createState?.success) toast.success("Pagina de links criada")
    if (createState?.error) toast.error(createState.error)
  }, [createState])

  return (
    <div className="space-y-4">
      {linkPages.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl bg-muted py-12">
          <FileText className="h-10 w-10 text-muted-foreground" />
          <p className="mt-4 text-sm font-medium">
            Nenhuma pagina de links cadastrada
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie uma pagina de links para o tenant
          </p>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="mt-4">
                <Plus className="mr-1 h-4 w-4" />
                Nova pagina de links
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova pagina de links</DialogTitle>
              </DialogHeader>
              <form action={createAction} className="space-y-4">
                <input type="hidden" name="tenant_id" value={tenantId} />
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="linkpage-title">Titulo</Label>
                    <Input
                      id="linkpage-title"
                      name="title"
                      placeholder="Links Vitoria"
                      required
                    />
                  </div>
                  <div className="space-y-2">
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
                <div className="space-y-2">
                  <Label htmlFor="linkpage-description">
                    Descricao (opcional)
                  </Label>
                  <Input
                    id="linkpage-description"
                    name="description"
                    placeholder="Links da loja de Vitoria"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isCreating}>
                  {isCreating ? "Criando..." : "Criar pagina de links"}
                </Button>
              </form>
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
                  Nova pagina de links
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova pagina de links</DialogTitle>
                </DialogHeader>
                <form action={createAction} className="space-y-4">
                  <input type="hidden" name="tenant_id" value={tenantId} />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="linkpage-title">Titulo</Label>
                      <Input
                        id="linkpage-title"
                        name="title"
                        placeholder="Links Vitoria"
                        required
                      />
                    </div>
                    <div className="space-y-2">
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
                  <div className="space-y-2">
                    <Label htmlFor="linkpage-description">
                      Descricao (opcional)
                    </Label>
                    <Input
                      id="linkpage-description"
                      name="description"
                      placeholder="Links da loja de Vitoria"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isCreating}
                  >
                    {isCreating ? "Criando..." : "Criar pagina de links"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {linkPages.map((linkPage) => (
              <div
                key={linkPage.id}
                className="rounded-xl bg-muted p-5 shadow-xs transition-shadow hover:shadow-md space-y-1"
              >
                <div className="flex items-center justify-between">
                  <Link
                    href={`/dashboard/tenants/${tenantId}/links/${linkPage.id}`}
                    className="font-semibold hover:underline"
                  >
                    {linkPage.title}
                  </Link>
                  {tenantSlug && (
                    <a
                      href={`${protocol}://${tenantSlug}.${rootDomain}/links/${linkPage.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="ghost" size="icon-sm">
                        <ExternalLink className="size-4" />
                      </Button>
                    </a>
                  )}
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>/links/{linkPage.slug}</span>
                  <span>
                    {linkPage.links.length}{" "}
                    {linkPage.links.length === 1 ? "link" : "links"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
