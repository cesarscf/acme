"use client"

import { useActionState, useEffect } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { upsertLandingPageAction } from "@/lib/actions/landing-pages"

type LandingPage = {
  id: string
  title: string
  description: string | null
  url: string | null
} | null

export function LandingPageForm({
  tenantId,
  landingPage,
}: {
  tenantId: string
  landingPage: LandingPage
}) {
  const [state, action, isPending] = useActionState(
    upsertLandingPageAction,
    null
  )

  useEffect(() => {
    if (state?.success) toast.success("Landing page salva com sucesso")
    if (state?.error) toast.error(state.error)
  }, [state])

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="tenant_id" value={tenantId} />

      <div className="space-y-2">
        <Label htmlFor="lp-title">Titulo</Label>
        <Input
          id="lp-title"
          name="title"
          defaultValue={landingPage?.title ?? ""}
          placeholder="Bem-vindo a Loja X"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="lp-description">Descricao</Label>
        <Textarea
          id="lp-description"
          name="description"
          defaultValue={landingPage?.description ?? ""}
          placeholder="Conheca nossos produtos e servicos"
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="lp-url">URL do CTA</Label>
        <Input
          id="lp-url"
          name="url"
          type="url"
          defaultValue={landingPage?.url ?? ""}
          placeholder="https://lojax.com"
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  )
}
