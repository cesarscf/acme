"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { type CreatePageInput, createPageSchema } from "@/lib/schemas/pages";
import { trpc } from "@/lib/trpc/client";

export function CreatePageForm() {
	const router = useRouter();
	const utils = trpc.useUtils();
	const [isSubmitting, setIsSubmitting] = useState(false);

	const {
		register,
		handleSubmit,
		setValue,
		setError,
		formState: { errors },
	} = useForm<CreatePageInput>({
		// biome-ignore lint/suspicious/noExplicitAny: incompatibilidade de tipos entre zod@4.3 e @hookform/resolvers@5.2
		resolver: zodResolver(createPageSchema as any),
		defaultValues: {
			title: "",
			path: "/",
			template: "links",
		},
	});

	const firstError =
		errors.root?.message ??
		errors.title?.message ??
		errors.path?.message ??
		errors.template?.message;
	const hasError = !!firstError;

	async function onSubmit(data: CreatePageInput) {
		setIsSubmitting(true);

		try {
			const result = await utils.client.pages.create.mutate(data);
			await utils.pages.list.invalidate();
			router.push(`/pages/${result.id}/edit`);
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Falha ao criar pagina";
			setError("root", { message });
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Detalhes da pagina</CardTitle>
			</CardHeader>
			<form onSubmit={handleSubmit(onSubmit)}>
				<CardContent>
					<div className="flex flex-col gap-4">
						{hasError && (
							<p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
								{firstError}
							</p>
						)}

						<div className="flex flex-col gap-2">
							<Label htmlFor="title">Titulo</Label>
							<Input
								id="title"
								placeholder="Minha pagina"
								{...register("title")}
							/>
						</div>

						<div className="flex flex-col gap-2">
							<Label htmlFor="path">Path</Label>
							<Input id="path" placeholder="/" {...register("path")} />
							<p className="text-xs text-muted-foreground">
								Use / para a pagina inicial ou /nome-da-pagina para subpaginas.
							</p>
						</div>

						<div className="flex flex-col gap-2">
							<Label>Template</Label>
							<Select
								defaultValue="links"
								onValueChange={(value) =>
									setValue("template", value as "links" | "bio")
								}
							>
								<SelectTrigger>
									<SelectValue placeholder="Selecione um template" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="links">Links</SelectItem>
									<SelectItem value="bio">Bio</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
				</CardContent>
				<CardFooter className="flex justify-between">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => router.push("/pages")}
					>
						Cancelar
					</Button>
					<Button type="submit" size="sm" disabled={isSubmitting}>
						{isSubmitting ? "Criando..." : "Criar pagina"}
					</Button>
				</CardFooter>
			</form>
		</Card>
	);
}
