"use client"

import Link from "next/link"
import { ChevronRight, ExternalLink } from "lucide-react"

import { protocol, rootDomain } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item"

export function PageCard({
  href,
  name,
  publicPath,
  tenantSlug,
  active = true,
  extra,
}: {
  href: string
  name: string
  publicPath: string
  tenantSlug?: string
  active?: boolean
  extra?: React.ReactNode
}) {
  return (
    <Link href={href}>
      <Item
        variant="muted"
        className="cursor-pointer transition-colors hover:bg-muted"
      >
        <ItemContent>
          <ItemTitle>
            {name}
            {active ? (
              <Badge variant="secondary">Ativa</Badge>
            ) : (
              <Badge variant="outline">Inativa</Badge>
            )}
          </ItemTitle>
          <ItemDescription>
            <span className="flex items-center gap-3">
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
            </span>
          </ItemDescription>
        </ItemContent>
        <ChevronRight className="size-4 text-muted-foreground" />
      </Item>
    </Link>
  )
}
