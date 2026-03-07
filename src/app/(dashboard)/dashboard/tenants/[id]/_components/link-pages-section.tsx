"use client"

import { useActionState, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { FileText, Plus } from "lucide-react"
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
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
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
        </>
      )}
    </div>
  )
}
