import { type NextRequest, NextResponse } from "next/server"
import { rootDomain } from "@/lib/utils"

type TenantMatch =
  | { type: "subdomain"; value: string }
  | { type: "customDomain"; value: string }
  | null

function matchTenant(request: NextRequest): TenantMatch {
  const url = request.url
  const host = request.headers.get("host") || ""
  const hostname = host.split(":")[0]

  if (url.includes("localhost") || url.includes("127.0.0.1")) {
    const fullUrlMatch = url.match(/http:\/\/([^.]+)\.localhost/)
    if (fullUrlMatch && fullUrlMatch[1]) {
      return { type: "subdomain", value: fullUrlMatch[1] }
    }

    if (hostname.includes(".localhost")) {
      return { type: "subdomain", value: hostname.split(".")[0] }
    }

    return null
  }

  const rootDomainFormatted = rootDomain.split(":")[0]

  if (hostname.includes("---") && hostname.endsWith(".vercel.app")) {
    const parts = hostname.split("---")
    return parts.length > 0 ? { type: "subdomain", value: parts[0] } : null
  }

  if (
    hostname === rootDomainFormatted ||
    hostname === `www.${rootDomainFormatted}` ||
    hostname.endsWith(".vercel.app")
  ) {
    return null
  }

  if (hostname.endsWith(`.${rootDomainFormatted}`)) {
    return {
      type: "subdomain",
      value: hostname.replace(`.${rootDomainFormatted}`, ""),
    }
  }

  return { type: "customDomain", value: hostname }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const tenant = matchTenant(request)

  if (tenant) {
    if (pathname.startsWith("/dashboard") || pathname.startsWith("/login")) {
      return NextResponse.redirect(new URL("/", request.url))
    }

    const rewriteUrl = new URL(`/t/${tenant.value}${pathname}`, request.url)
    rewriteUrl.searchParams.set("_tenantType", tenant.type)
    return NextResponse.rewrite(rewriteUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next|[\\w-]+\\.\\w+).*)"],
}
