import Image from "next/image";

type BioContent = {
	bio: string;
	avatar?: string;
	socialLinks: { platform: string; url: string }[];
};

type BioTemplateProps = {
	title: string;
	content: BioContent;
	orgName: string;
	orgLogo: string | null;
};

export function BioTemplate({
	title,
	content,
	orgName,
	orgLogo,
}: BioTemplateProps) {
	const avatarSrc = content.avatar || orgLogo;

	return (
		<div className="flex min-h-screen flex-col items-center bg-background px-4 py-12">
			<div className="flex w-full max-w-md flex-col items-center gap-6">
				{avatarSrc ? (
					<Image
						src={avatarSrc}
						alt={orgName}
						width={96}
						height={96}
						className="rounded-full object-cover"
					/>
				) : (
					<div className="flex size-24 items-center justify-center rounded-full bg-muted">
						<span className="text-3xl font-bold text-muted-foreground">
							{orgName.charAt(0).toUpperCase()}
						</span>
					</div>
				)}

				<div className="text-center">
					<h1 className="text-xl font-semibold">{title}</h1>
					<p className="text-sm text-muted-foreground">{orgName}</p>
				</div>

				{content.bio && (
					<p className="text-center text-sm leading-relaxed text-foreground">
						{content.bio}
					</p>
				)}

				{content.socialLinks.length > 0 && (
					<div className="flex flex-wrap justify-center gap-3">
						{content.socialLinks.map((social) => (
							<a
								key={`${social.platform}-${social.url}`}
								href={social.url}
								target="_blank"
								rel="noopener noreferrer"
								className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
							>
								{social.platform}
							</a>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
