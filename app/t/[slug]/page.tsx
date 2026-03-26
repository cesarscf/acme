import type { Metadata } from "next";
import { connection } from "next/server";
import { HydrateClient, trpc } from "@/lib/trpc/server";
import { StorefrontContent } from "./storefront-content";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>;
}): Promise<Metadata> {
	const { slug } = await params;
	await connection();
	void trpc.organizations.bySlug.prefetch({ slug });

	return {
		title: slug,
	};
}

export default async function StorePage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	await connection();
	void trpc.organizations.bySlug.prefetch({ slug });

	return (
		<HydrateClient>
			<StorefrontContent slug={slug} />
		</HydrateClient>
	);
}
