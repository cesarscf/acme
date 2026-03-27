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
	params: Promise<{ slug: string; path?: string[] }>;
}): Promise<Metadata> {
	const { slug, path } = await params;
	const pagePath = resolvePath(path);
	await connection();
	void trpc.pages.byOrgSlugAndPath.prefetch({ slug, path: pagePath });

	return {
		title: slug,
	};
}

export default async function StorefrontPage({
	params,
}: {
	params: Promise<{ slug: string; path?: string[] }>;
}) {
	const { slug, path } = await params;
	const pagePath = resolvePath(path);
	await connection();
	void trpc.pages.byOrgSlugAndPath.prefetch({ slug, path: pagePath });

	return (
		<HydrateClient>
			<StorefrontContent slug={slug} path={pagePath} />
		</HydrateClient>
	);
}
