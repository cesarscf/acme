import type { Metadata } from "next";
import { connection } from "next/server";
import { HydrateClient, trpc } from "@/lib/trpc/server";
import { StorefrontContent } from "./storefront-content";

function resolvePath(path?: string[]): string {
	if (!path || path.length === 0) return "/";
	return `/${path.join("/")}`;
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ domain: string; path?: string[] }>;
}): Promise<Metadata> {
	const { domain, path } = await params;
	const pagePath = resolvePath(path);
	await connection();
	void trpc.pages.byDomainAndPath.prefetch({ domain, path: pagePath });

	return {
		title: domain,
	};
}

export default async function StorefrontPage({
	params,
}: {
	params: Promise<{ domain: string; path?: string[] }>;
}) {
	const { domain, path } = await params;
	const pagePath = resolvePath(path);

	await connection();
	void trpc.pages.byDomainAndPath.prefetch({ domain, path: pagePath });

	return (
		<HydrateClient>
			<StorefrontContent domain={domain} path={pagePath} />
		</HydrateClient>
	);
}
