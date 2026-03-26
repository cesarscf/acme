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

export async function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl;
	const subdomain = extractSubdomain(request);

	if (subdomain) {
		// Rotas da plataforma (auth, api, app) não devem ser acessadas via subdomain
		if (
			pathname.startsWith("/sign-in") ||
			pathname.startsWith("/sign-up") ||
			pathname.startsWith("/onboarding") ||
			pathname.startsWith("/api")
		) {
			return NextResponse.redirect(new URL("/", request.url));
		}

		// Rewrite da raiz do subdomain para a rota interna da loja
		if (pathname === "/") {
			return NextResponse.rewrite(
				new URL(`/t/${subdomain}`, request.url),
			);
		}

		// Rewrite de sub-rotas do subdomain (ex: loja.localhost:3000/products -> /t/loja/products)
		return NextResponse.rewrite(
			new URL(`/t/${subdomain}${pathname}`, request.url),
		);
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
