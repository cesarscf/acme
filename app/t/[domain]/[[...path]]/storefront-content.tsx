"use client";

import { BioTemplate } from "@/components/templates/bio-template";
import { LinksTemplate } from "@/components/templates/links-template";
import { trpc } from "@/lib/trpc/client";

export function StorefrontContent({
	domain,
	path,
}: {
	domain: string;
	path: string;
}) {
	const { data: page, isLoading } = trpc.pages.byDomainAndPath.useQuery({
		domain,
		path,
	});

	if (isLoading) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<p className="text-muted-foreground">Carregando...</p>
			</div>
		);
	}

	if (!page) {
		return (
			<div className="flex min-h-screen flex-col items-center justify-center">
				<h1 className="text-2xl font-semibold">Pagina nao encontrada</h1>
				<p className="mt-2 text-muted-foreground">
					Esta pagina nao existe ou nao esta publicada.
				</p>
			</div>
		);
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

	return null;
}
