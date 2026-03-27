"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

const createOrganizationSchema = z.object({
	name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
	slug: z
		.string()
		.min(2, "Slug deve ter pelo menos 2 caracteres")
		.regex(
			/^[a-z0-9]+(?:-[a-z0-9]+)*$/,
			"Slug deve conter apenas letras minúsculas, números e hífens",
		),
});

type CreateOrganizationForm = z.infer<typeof createOrganizationSchema>;

type CreateOrganizationFormProps = {
	onSuccessAction?: () => void;
};

export function CreateOrganizationForm({
	onSuccessAction,
}: CreateOrganizationFormProps) {
	const router = useRouter();
	const [isLoading, setIsLoading] = useState(false);

	const {
		register,
		handleSubmit,
		setValue,
		setError,
		formState: { errors },
	} = useForm<CreateOrganizationForm>({
		// biome-ignore lint/suspicious/noExplicitAny: incompatibilidade de tipos entre zod@4.3 e @hookform/resolvers@5.2
		resolver: zodResolver(createOrganizationSchema as any),
	});

	const firstError =
		errors.root?.message ?? errors.name?.message ?? errors.slug?.message;
	const hasError = !!firstError;

	function generateSlug(name: string): string {
		return name
			.toLowerCase()
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "")
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "");
	}

	async function onSubmitAction(data: CreateOrganizationForm) {
		setIsLoading(true);

		const result = await authClient.organization.create({
			name: data.name,
			slug: data.slug,
		});

		if (result.error) {
			setError("root", {
				message: result.error.message ?? "Falha ao criar organização",
			});
			setIsLoading(false);
			return;
		}

		await authClient.organization.setActive({
			organizationId: result.data.id,
		});

		if (onSuccessAction) {
			onSuccessAction();
		}

		router.push("/");
		router.refresh();
	}

	return (
		<form
			onSubmit={handleSubmit(onSubmitAction)}
			className="flex flex-col gap-4"
		>
			{hasError && (
				<p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
					{firstError}
				</p>
			)}

			<div className="flex flex-col gap-2">
				<Label htmlFor="name">Nome da organização</Label>
				<Input
					id="name"
					type="text"
					placeholder="Minha Agência"
					{...register("name", {
						onChange: (e) => {
							const slug = generateSlug(e.target.value);
							setValue("slug", slug);
						},
					})}
				/>
			</div>

			<div className="flex flex-col gap-2">
				<Label htmlFor="slug">Slug (subdomínio)</Label>
				<Input
					id="slug"
					type="text"
					placeholder="minha-agencia"
					{...register("slug")}
				/>
				<p className="text-xs text-muted-foreground">
					Será acessível em <span className="font-medium">slug.acme.com</span>
				</p>
			</div>

			<Button type="submit" disabled={isLoading} className="w-full">
				{isLoading ? (
					<LoaderCircle className="animate-spin" />
				) : (
					"Criar organização"
				)}
			</Button>
		</form>
	);
}
