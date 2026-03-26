"use client";

import { trpc } from "@/lib/trpc/client";

export function StorefrontContent({ slug }: { slug: string }) {
	const { data: org } = trpc.organizations.bySlug.useQuery({ slug });

	if (!org) {
		return null;
	}

	return (
		<div className="flex min-h-screen flex-col items-center justify-center">
			<h1 className="text-4xl font-bold tracking-tight">{org.name}</h1>
			<p className="mt-2 text-lg text-muted-foreground">{slug}</p>
		</div>
	);
}
