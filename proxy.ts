import { type NextRequest, NextResponse } from "next/server";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000";

function extractSubdomain(request: NextRequest): string | null {
	const url = request.url;
	const host = request.headers.get("host") || "";
	const hostname = host.split(":")[0];

	// Ambiente de desenvolvimento local
	if (url.includes("localhost") || url.includes("127.0.0.1")) {
		const fullUrlMatch = url.match(/http:\/\/([^.]+)\.localhost/);
		if (fullUrlMatch?.[1]) {
			return fullUrlMatch[1];
		}

		if (hostname.includes(".localhost")) {
			return hostname.split(".")[0];
		}

		return null;
	}

	// Ambiente de produção
	const rootDomainHost = ROOT_DOMAIN.split(":")[0];

	// Preview deployments no Vercel (tenant---branch.vercel.app)
	if (hostname.includes("---") && hostname.endsWith(".vercel.app")) {
		const parts = hostname.split("---");
		return parts.length > 0 ? parts[0] : null;
	}

	// Detecção de subdomain normal
	const isSubdomain =
		hostname !== rootDomainHost &&
		hostname !== `www.${rootDomainHost}` &&
		hostname.endsWith(`.${rootDomainHost}`);

	return isSubdomain ? hostname.replace(`.${rootDomainHost}`, "") : null;
}

function isRootDomain(request: NextRequest): boolean {
	const host = request.headers.get("host") || "";
	const hostname = host.split(":")[0];
	const rootDomainHost = ROOT_DOMAIN.split(":")[0];

	return (
		hostname === rootDomainHost ||
		hostname === `www.${rootDomainHost}` ||
		hostname === "localhost"
	);
}

function rewriteToStorefront(
	request: NextRequest,
	domain: string,
): NextResponse {
	const { pathname } = request.nextUrl;

	const target =
		pathname === "/" ? `/t/${domain}` : `/t/${domain}${pathname}`;

	return NextResponse.rewrite(new URL(target, request.url));
}

export function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl;

	// Ignora assets internos do Next.js, API routes e arquivos estáticos
	if (
		pathname.startsWith("/_next") ||
		pathname.startsWith("/api") ||
		pathname.startsWith("/favicon")
	) {
		return NextResponse.next();
	}

	// 1. Tenta resolver por subdomain
	const subdomain = extractSubdomain(request);
	if (subdomain) {
		return rewriteToStorefront(request, subdomain);
	}

	// 2. Se é o domínio raiz, segue normalmente
	if (isRootDomain(request)) {
		return NextResponse.next();
	}

	// 3. Custom domain — passa o hostname como domain
	const host = request.headers.get("host") || "";
	const hostname = host.split(":")[0];
	return rewriteToStorefront(request, hostname);
}

export const proxyConfig = {
	matcher: [
		/*
		 * Match all paths except:
		 * 1. /api routes (handled separately)
		 * 2. /_next (Next.js internals)
		 * 3. Arquivos estáticos na raiz do /public
		 */
		"/((?!api|_next|[\\w-]+\\.\\w+).*)",
	],
};
