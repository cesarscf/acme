"use client"

import { use, useState, useTransition } from "react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type DomainStatusData = {
  configured: boolean
  config: {
    misconfigured?: boolean
    cnames?: string[]
    aValues?: string[]
  }
  verification: {
    verified?: boolean
    verification?: { type: string; domain: string; value: string }[]
  }
}

function fetchDomainStatus(domain: string) {
  return fetch(`/api/domain-check?domain=${domain}`).then((res) => res.json())
}

function DomainStatusContent({
  promise,
  onRecheck,
}: {
  promise: Promise<DomainStatusData>
  onRecheck: () => void
}) {
  const status = use(promise)

  if (status.configured) {
    return (
      <Card size="sm">
        <CardContent className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Configurado</Badge>
            <p className="text-sm font-medium">
              DNS configurado corretamente
            </p>
          </div>
          <button
            onClick={onRecheck}
            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            Verificar novamente
          </button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline">Pendente</Badge>
            <span>DNS pendente</span>
          </div>
          <button
            onClick={onRecheck}
            className="text-xs font-normal text-muted-foreground hover:text-foreground hover:underline"
          >
            Verificar novamente
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <Card size="sm">
          <CardContent>
            <p className="text-xs font-medium text-foreground uppercase">
              Opção 1 — Registro A
            </p>
            <div className="mt-1 font-mono text-xs">
              <p>
                Tipo: <strong>A</strong>
              </p>
              <p>
                Nome: <strong>@</strong>
              </p>
              <p>
                Valor: <strong>216.198.79.1</strong>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardContent>
            <p className="text-xs font-medium text-foreground uppercase">
              Opção 2 — Registro CNAME
            </p>
            <div className="mt-1 font-mono text-xs">
              <p>
                Tipo: <strong>CNAME</strong>
              </p>
              <p>
                Nome: <strong>@</strong>
              </p>
              <p>
                Valor: <strong>cname.vercel-dns.com</strong>
              </p>
            </div>
          </CardContent>
        </Card>

        {status.verification?.verification &&
          status.verification.verification.length > 0 && (
            <Card size="sm">
              <CardContent>
                <p className="text-xs font-medium text-foreground uppercase">
                  Verificação TXT (se necessário)
                </p>
                {status.verification.verification.map((v, i) => (
                  <div key={i} className="mt-1 font-mono text-xs">
                    <p>
                      Tipo: <strong>{v.type}</strong>
                    </p>
                    <p>
                      Nome: <strong>{v.domain}</strong>
                    </p>
                    <p>
                      Valor: <strong>{v.value}</strong>
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
      </CardContent>
    </Card>
  )
}

export function DomainStatus({ domain }: { domain: string }) {
  const [promise, setPromise] = useState(() => fetchDomainStatus(domain))
  const [, startTransition] = useTransition()

  function recheck() {
    startTransition(() => {
      setPromise(fetchDomainStatus(domain))
    })
  }

  return <DomainStatusContent promise={promise} onRecheck={recheck} />
}
