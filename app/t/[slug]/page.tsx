import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function getOrganizationBySlug(slug: string) {
	const org = await db
		.select()
		.from(organizations)
		.where(eq(organizations.slug, slug))
		.limit(1);

	return org[0] ?? null;
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>;
}): Promise<Metadata> {
	const { slug } = await params;
	const org = await getOrganizationBySlug(slug);

	if (!org) {
		return { title: "Loja não encontrada" };
	}

	return {
		title: org.name,
		description: `Loja ${org.name}`,
	};
}

export default async function StorePage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const org = await getOrganizationBySlug(slug);

	if (!org) {
		notFound();
	}

	return (
		<div className="flex min-h-screen flex-col items-center justify-center">
			<h1 className="text-4xl font-bold tracking-tight">{org.name}</h1>
			<p className="mt-2 text-lg text-muted-foreground">
				{slug}
			</p>
		</div>
	);
}
