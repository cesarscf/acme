"use client"

import { use, useState, useTransition } from "react"

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
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <p className="text-sm font-medium text-green-700">
              DNS configurado corretamente
            </p>
          </div>
          <button
            onClick={onRecheck}
            className="text-xs text-green-600 hover:underline"
          >
            Verificar novamente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-yellow-500" />
          <p className="text-sm font-medium text-yellow-700">DNS pendente</p>
        </div>
        <button
          onClick={onRecheck}
          className="text-xs text-yellow-600 hover:underline"
        >
          Verificar novamente
        </button>
      </div>

      <div className="space-y-2 text-sm text-yellow-800">
        <div className="space-y-1 rounded border border-yellow-200 bg-white p-3">
          <p className="text-xs font-medium text-yellow-600 uppercase">
            Opção 1 — Registro A
          </p>
          <div className="font-mono text-xs">
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
        </div>

        <div className="space-y-1 rounded border border-yellow-200 bg-white p-3">
          <p className="text-xs font-medium text-yellow-600 uppercase">
            Opção 2 — Registro CNAME
          </p>
          <div className="font-mono text-xs">
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
        </div>

        {status.verification?.verification &&
          status.verification.verification.length > 0 && (
            <div className="space-y-1 rounded border border-yellow-200 bg-white p-3">
              <p className="text-xs font-medium text-yellow-600 uppercase">
                Verificação TXT (se necessário)
              </p>
              {status.verification.verification.map((v, i) => (
                <div key={i} className="font-mono text-xs">
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
            </div>
          )}
      </div>
    </div>
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
