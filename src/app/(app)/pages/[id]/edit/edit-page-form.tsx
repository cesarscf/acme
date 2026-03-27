"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc/client";

const editLinksSchema = z.object({
	title: z.string().min(1, "Titulo obrigatorio").max(200),
	path: z
		.string()
		.min(1, "Path obrigatorio")
		.regex(
			/^\/[a-z0-9-]*$/,
			"Path deve comecar com / e conter apenas letras minusculas, numeros e hifens",
		)
		.or(z.literal("/")),
	published: z.boolean(),
	links: z.array(
		z.object({
			title: z.string().min(1, "Titulo obrigatorio"),
			url: z.string().min(1, "URL obrigatoria"),
		}),
	),
});

type EditLinksForm = z.infer<typeof editLinksSchema>;

const editBioSchema = z.object({
	title: z.string().min(1, "Titulo obrigatorio").max(200),
	path: z
		.string()
		.min(1, "Path obrigatorio")
		.regex(
			/^\/[a-z0-9-]*$/,
			"Path deve comecar com / e conter apenas letras minusculas, numeros e hifens",
		)
		.or(z.literal("/")),
	published: z.boolean(),
	bio: z.string(),
	avatar: z.string(),
	socialLinks: z.array(
		z.object({
			platform: z.string().min(1, "Plataforma obrigatoria"),
			url: z.string().min(1, "URL obrigatoria"),
		}),
	),
});

type EditBioForm = z.infer<typeof editBioSchema>;

function usePublicPageUrl(path: string) {
	const { data: org } = trpc.organizations.active.useQuery();
	if (!org) return null;
	const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000";
	const protocol = rootDomain.startsWith("localhost") ? "http" : "https";
	const pagePath = path === "/" ? "" : path;
	return `${protocol}://${org.slug}.${rootDomain}${pagePath}`;
}

export function EditPageForm({ id }: { id: string }) {
	const { data: page } = trpc.pages.byId.useQuery({ id });

	if (!page) return null;

	if (page.template === "links") {
		return <LinksEditor page={page} />;
	}

	return <BioEditor page={page} />;
}

type PageData = {
	id: string;
	title: string;
	path: string;
	template: string;
	content: string | null;
	published: boolean;
};

function LinksEditor({ page }: { page: PageData }) {
	const router = useRouter();
	const utils = trpc.useUtils();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const publicPageUrl = usePublicPageUrl(page.path);

	const content = page.content ? JSON.parse(page.content) : { links: [] };

	const {
		register,
		handleSubmit,
		control,
		setError,
		watch,
		setValue,
		formState: { errors },
	} = useForm<EditLinksForm>({
		// biome-ignore lint/suspicious/noExplicitAny: incompatibilidade de tipos entre zod@4.3 e @hookform/resolvers@5.2
		resolver: zodResolver(editLinksSchema as any),
		defaultValues: {
			title: page.title,
			path: page.path,
			published: page.published,
			links: content.links ?? [],
		},
	});

	const { fields, append, remove } = useFieldArray({
		control,
		name: "links",
	});

	const isPublished = watch("published");

	const firstError =
		errors.root?.message ?? errors.title?.message ?? errors.path?.message;
	const hasError = !!firstError;

	async function onSubmit(data: EditLinksForm) {
		setIsSubmitting(true);

		try {
			const { links, ...rest } = data;
			await utils.client.pages.update.mutate({
				id: page.id,
				...rest,
				content: JSON.stringify({ links }),
			});
			await utils.pages.byId.invalidate({ id: page.id });
			await utils.pages.list.invalidate();
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Falha ao salvar pagina";
			setError("root", { message });
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
			{publicPageUrl && (
				<a
					href={publicPageUrl}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
				>
					<ExternalLink className="size-3.5" />
					Ver pagina
				</a>
			)}

			<Card>
				<CardHeader>
					<CardTitle>Detalhes</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex flex-col gap-4">
						{hasError && (
							<p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
								{firstError}
							</p>
						)}

						<div className="flex flex-col gap-2">
							<Label htmlFor="title">Titulo</Label>
							<Input id="title" {...register("title")} />
						</div>

						<div className="flex flex-col gap-2">
							<Label htmlFor="path">Path</Label>
							<Input id="path" {...register("path")} />
						</div>

						<div className="flex items-center gap-2">
							<Switch
								id="published"
								checked={isPublished}
								onCheckedChange={(checked) => setValue("published", checked)}
							/>
							<Label htmlFor="published">Publicada</Label>
						</div>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle>Links</CardTitle>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => append({ title: "", url: "" })}
						>
							Adicionar link
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					{fields.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							Nenhum link adicionado.
						</p>
					) : (
						<div className="flex flex-col gap-4">
							{fields.map((field, index) => (
								<div
									key={field.id}
									className="flex items-start gap-2 rounded-md border p-3"
								>
									<div className="flex flex-1 flex-col gap-2">
										<Input
											placeholder="Titulo do link"
											{...register(`links.${index}.title`)}
										/>
										<Input
											placeholder="https://exemplo.com"
											{...register(`links.${index}.url`)}
										/>
									</div>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="text-destructive hover:text-destructive"
										onClick={() => remove(index)}
									>
										Remover
									</Button>
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			<div className="flex justify-between">
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => router.push("/pages")}
				>
					Voltar
				</Button>
				<Button type="submit" size="sm" disabled={isSubmitting}>
					{isSubmitting ? "Salvando..." : "Salvar"}
				</Button>
			</div>
		</form>
	);
}

function BioEditor({ page }: { page: PageData }) {
	const router = useRouter();
	const utils = trpc.useUtils();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const publicPageUrl = usePublicPageUrl(page.path);

	const content = page.content
		? JSON.parse(page.content)
		: { bio: "", socialLinks: [] };

	const {
		register,
		handleSubmit,
		control,
		setError,
		watch,
		setValue,
		formState: { errors },
	} = useForm<EditBioForm>({
		// biome-ignore lint/suspicious/noExplicitAny: incompatibilidade de tipos entre zod@4.3 e @hookform/resolvers@5.2
		resolver: zodResolver(editBioSchema as any),
		defaultValues: {
			title: page.title,
			path: page.path,
			published: page.published,
			bio: content.bio ?? "",
			avatar: content.avatar ?? "",
			socialLinks: content.socialLinks ?? [],
		},
	});

	const { fields, append, remove } = useFieldArray({
		control,
		name: "socialLinks",
	});

	const isPublished = watch("published");

	const firstError =
		errors.root?.message ?? errors.title?.message ?? errors.path?.message;
	const hasError = !!firstError;

	async function onSubmit(data: EditBioForm) {
		setIsSubmitting(true);

		try {
			const { bio, avatar, socialLinks, ...rest } = data;
			await utils.client.pages.update.mutate({
				id: page.id,
				...rest,
				content: JSON.stringify({ bio, avatar, socialLinks }),
			});
			await utils.pages.byId.invalidate({ id: page.id });
			await utils.pages.list.invalidate();
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Falha ao salvar pagina";
			setError("root", { message });
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
			{publicPageUrl && (
				<a
					href={publicPageUrl}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
				>
					<ExternalLink className="size-3.5" />
					Ver pagina
				</a>
			)}

			<Card>
				<CardHeader>
					<CardTitle>Detalhes</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex flex-col gap-4">
						{hasError && (
							<p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
								{firstError}
							</p>
						)}

						<div className="flex flex-col gap-2">
							<Label htmlFor="title">Titulo</Label>
							<Input id="title" {...register("title")} />
						</div>

						<div className="flex flex-col gap-2">
							<Label htmlFor="path">Path</Label>
							<Input id="path" {...register("path")} />
						</div>

						<div className="flex items-center gap-2">
							<Switch
								id="published"
								checked={isPublished}
								onCheckedChange={(checked) => setValue("published", checked)}
							/>
							<Label htmlFor="published">Publicada</Label>
						</div>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Bio</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex flex-col gap-4">
						<div className="flex flex-col gap-2">
							<Label htmlFor="avatar">URL do avatar</Label>
							<Input
								id="avatar"
								placeholder="https://exemplo.com/avatar.jpg"
								{...register("avatar")}
							/>
						</div>

						<div className="flex flex-col gap-2">
							<Label htmlFor="bio">Biografia</Label>
							<Textarea
								id="bio"
								placeholder="Escreva sua bio aqui..."
								rows={4}
								{...register("bio")}
							/>
						</div>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle>Redes sociais</CardTitle>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => append({ platform: "", url: "" })}
						>
							Adicionar rede
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					{fields.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							Nenhuma rede social adicionada.
						</p>
					) : (
						<div className="flex flex-col gap-4">
							{fields.map((field, index) => (
								<div
									key={field.id}
									className="flex items-start gap-2 rounded-md border p-3"
								>
									<div className="flex flex-1 flex-col gap-2">
										<Input
											placeholder="Plataforma (ex: Instagram)"
											{...register(`socialLinks.${index}.platform`)}
										/>
										<Input
											placeholder="https://instagram.com/usuario"
											{...register(`socialLinks.${index}.url`)}
										/>
									</div>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="text-destructive hover:text-destructive"
										onClick={() => remove(index)}
									>
										Remover
									</Button>
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			<div className="flex justify-between">
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => router.push("/pages")}
				>
					Voltar
				</Button>
				<Button type="submit" size="sm" disabled={isSubmitting}>
					{isSubmitting ? "Salvando..." : "Salvar"}
				</Button>
			</div>
		</form>
	);
}
