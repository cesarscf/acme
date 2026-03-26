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

async function resolveCustomDomain(
	request: NextRequest,
): Promise<string | null> {
	const host = request.headers.get("host") || "";
	const hostname = host.split(":")[0];

	const protocol = request.url.startsWith("https") ? "https" : "http";
	const apiUrl = `${protocol}://${ROOT_DOMAIN}/api/domain?domain=${encodeURIComponent(hostname)}`;

	try {
		const res = await fetch(apiUrl);
		if (!res.ok) return null;
		const data = (await res.json()) as { slug: string | null };
		return data.slug;
	} catch {
		return null;
	}
}

function rewriteToStore(
	request: NextRequest,
	slug: string,
): NextResponse {
	const { pathname } = request.nextUrl;

	// Rotas da plataforma não devem ser acessadas via subdomain/custom domain
	if (
		pathname.startsWith("/sign-in") ||
		pathname.startsWith("/sign-up") ||
		pathname.startsWith("/onboarding") ||
		pathname.startsWith("/api")
	) {
		return NextResponse.redirect(new URL("/", request.url));
	}

	const target =
		pathname === "/" ? `/t/${slug}` : `/t/${slug}${pathname}`;

	return NextResponse.rewrite(new URL(target, request.url));
}

export async function proxy(request: NextRequest) {
	// 1. Tenta resolver por subdomain
	const subdomain = extractSubdomain(request);
	if (subdomain) {
		return rewriteToStore(request, subdomain);
	}

	// 2. Se é o domínio raiz, segue normalmente
	if (isRootDomain(request)) {
		return NextResponse.next();
	}

	// 3. Tenta resolver por custom domain
	const slug = await resolveCustomDomain(request);
	if (slug) {
		return rewriteToStore(request, slug);
	}

	return NextResponse.next();
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
