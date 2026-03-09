"use client"

import Link from "next/link"
import { ChevronRight, ExternalLink } from "lucide-react"

import { protocol, rootDomain } from "@/lib/utils"

export function PageCard({
  href,
  title,
  publicPath,
  tenantSlug,
  active = true,
  extra,
}: {
  href: string
  title: string
  publicPath: string
  tenantSlug?: string
  active?: boolean
  extra?: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="group relative flex items-center justify-between rounded-xl border border-transparent bg-muted p-5 transition-all hover:border-border hover:bg-accent/40"
    >
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{title}</span>
          {active ? (
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              Ativa
            </span>
          ) : (
            <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">
              Inativa
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {tenantSlug ? (
            <span
              role="link"
              className="relative z-10 inline-flex items-center gap-1 hover:text-foreground hover:underline"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                window.open(
                  `${protocol}://${tenantSlug}.${rootDomain}${publicPath}`,
                  "_blank",
                  "noopener,noreferrer"
                )
              }}
            >
              {publicPath}
              <ExternalLink className="size-3" />
            </span>
          ) : (
            <span>{publicPath}</span>
          )}
          {extra}
        </div>
      </div>
      <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}
