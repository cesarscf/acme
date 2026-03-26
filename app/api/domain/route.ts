import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const domain = searchParams.get("domain");

	if (!domain) {
		return NextResponse.json({ slug: null }, { status: 400 });
	}

	// Busca por custom domain
	const org = await db
		.select({ slug: organizations.slug })
		.from(organizations)
		.where(eq(organizations.customDomain, domain.toLowerCase()))
		.limit(1);

	if (org.length === 0) {
		return NextResponse.json({ slug: null }, { status: 404 });
	}

	return NextResponse.json(
		{ slug: org[0].slug },
		{
			headers: {
				"Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
			},
		},
	);
}
