import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { BioTemplate } from "@/components/templates/bio-template";
import { LinksTemplate } from "@/components/templates/links-template";
import { trpc } from "@/lib/trpc/server";

function resolvePath(path?: string[]): string {
	if (!path || path.length === 0) return "/";
	return `/${path.join("/")}`;
}

async function getPage(domain: string, path: string) {
	try {
		return await trpc.pages.byDomainAndPath({ domain, path });
	} catch {
		return null;
	}
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ domain: string; path?: string[] }>;
}): Promise<Metadata> {
	const { domain, path } = await params;
	const pagePath = resolvePath(path);
	await connection();

	const page = await getPage(domain, pagePath);

	return {
		title: page?.title ?? domain,
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

	const page = await getPage(domain, pagePath);

	if (!page) {
		notFound();
	}

	const content = page.content ? JSON.parse(page.content) : null;

	if (!content) {
		return (
			<div className="flex min-h-screen flex-col items-center justify-center">
				<h1 className="text-2xl font-semibold">{page.title}</h1>
				<p className="mt-2 text-muted-foreground">
					Esta pagina ainda nao tem conteudo.
				</p>
			</div>
		);
	}

	if (page.template === "links") {
		return (
			<LinksTemplate
				title={page.title}
				content={content}
				orgName={page.orgName}
				orgLogo={page.orgLogo}
			/>
		);
	}

	if (page.template === "bio") {
		return (
			<BioTemplate
				title={page.title}
				content={content}
				orgName={page.orgName}
				orgLogo={page.orgLogo}
			/>
		);
	}

	notFound();
}
