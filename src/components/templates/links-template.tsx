import Image from "next/image";

type LinksContent = {
	links: { title: string; url: string }[];
};

type LinksTemplateProps = {
	title: string;
	content: LinksContent;
	orgName: string;
	orgLogo: string | null;
};

export function LinksTemplate({
	title,
	content,
	orgName,
	orgLogo,
}: LinksTemplateProps) {
	return (
		<div className="flex min-h-screen flex-col items-center bg-background px-4 py-12">
			<div className="flex w-full max-w-md flex-col items-center gap-6">
				{orgLogo ? (
					<Image
						src={orgLogo}
						alt={orgName}
						width={80}
						height={80}
						className="rounded-full object-cover"
					/>
				) : (
					<div className="flex size-20 items-center justify-center rounded-full bg-muted">
						<span className="text-2xl font-bold text-muted-foreground">
							{orgName.charAt(0).toUpperCase()}
						</span>
					</div>
				)}

				<div className="text-center">
					<h1 className="text-xl font-semibold">{title}</h1>
					<p className="text-sm text-muted-foreground">{orgName}</p>
				</div>

				{content.links.length > 0 ? (
					<div className="flex w-full flex-col gap-3">
						{content.links.map((link) => (
							<a
								key={`${link.title}-${link.url}`}
								href={link.url}
								target="_blank"
								rel="noopener noreferrer"
								className="flex w-full items-center justify-center rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium transition-colors hover:bg-muted"
							>
								{link.title}
							</a>
						))}
					</div>
				) : (
					<p className="text-sm text-muted-foreground">
						Nenhum link disponivel.
					</p>
				)}
			</div>
		</div>
	);
}
