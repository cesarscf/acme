"use client"

import { useActionState } from "react"

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
          placeholder="Conhca nossos produtos e servicos"
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

      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      {state?.success && (
        <p className="text-sm text-green-600">Salvo com sucesso</p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  )
}
