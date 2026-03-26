"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc/client";

const customDomainSchema = z.object({
	domain: z
		.string()
		.min(1, "Dominio e obrigatorio")
		.max(253, "Dominio muito longo")
		.regex(
			/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/,
			"Dominio invalido (ex: loja.exemplo.com.br)",
		),
});

type CustomDomainForm = z.infer<typeof customDomainSchema>;

export function SettingsForm() {
	const utils = trpc.useUtils();
	const { data: org } = trpc.organizations.active.useQuery();

	const [isSettingDomain, setIsSettingDomain] = useState(false);
	const [isRemovingDomain, setIsRemovingDomain] = useState(false);

	const {
		register,
		handleSubmit,
		setError,
		reset,
		formState: { errors },
	} = useForm<CustomDomainForm>({
		// biome-ignore lint/suspicious/noExplicitAny: incompatibilidade de tipos entre zod@4.3 e @hookform/resolvers@5.2
		resolver: zodResolver(customDomainSchema as any),
		values: {
			domain: org?.customDomain ?? "",
		},
	});

	const firstError = errors.root?.message ?? errors.domain?.message;
	const hasError = !!firstError;

	async function onSubmitDomain(data: CustomDomainForm) {
		setIsSettingDomain(true);

		try {
			await utils.client.organizations.setCustomDomain.mutate({
				domain: data.domain,
			});
			await utils.organizations.active.invalidate();
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Falha ao salvar dominio";
			setError("root", { message });
		} finally {
			setIsSettingDomain(false);
		}
	}

	async function onRemoveDomain() {
		setIsRemovingDomain(true);

		try {
			await utils.client.organizations.removeCustomDomain.mutate();
			reset({ domain: "" });
			await utils.organizations.active.invalidate();
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Falha ao remover dominio";
			setError("root", { message });
		} finally {
			setIsRemovingDomain(false);
		}
	}

	if (!org) return null;

	return (
		<div className="flex flex-col gap-6">
			{/* Subdominio */}
			<Card>
				<CardHeader>
					<CardTitle>Subdominio</CardTitle>
					<CardDescription>
						O subdominio da sua loja e baseado no slug da organizacao.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex flex-col gap-2">
						<Label>Endereco da loja</Label>
						<div className="flex items-center gap-2">
							<Input value={org.slug} disabled />
							<span className="shrink-0 text-sm text-muted-foreground">
								.{process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000"}
							</span>
						</div>
						<p className="text-xs text-muted-foreground">
							O subdominio e definido automaticamente pelo slug da organizacao e nao pode ser alterado diretamente.
						</p>
					</div>
				</CardContent>
			</Card>

			{/* Dominio personalizado */}
			<Card>
				<CardHeader>
					<CardTitle>Dominio personalizado</CardTitle>
					<CardDescription>
						Configure um dominio proprio para a sua loja.
					</CardDescription>
				</CardHeader>
				<form onSubmit={handleSubmit(onSubmitDomain)}>
					<CardContent>
						<div className="flex flex-col gap-2">
							{hasError && (
								<p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
									{firstError}
								</p>
							)}
							<Label htmlFor="domain">Dominio</Label>
							<Input
								id="domain"
								type="text"
								placeholder="loja.exemplo.com.br"
								{...register("domain")}
							/>
							{org.customDomain && (
								<p className="text-xs text-muted-foreground">
									Dominio atual: <span className="font-medium">{org.customDomain}</span>
								</p>
							)}
						</div>
					</CardContent>
					<CardFooter className="flex justify-between">
						{org.customDomain ? (
							<Button
								type="button"
								variant="destructive"
								size="sm"
								disabled={isRemovingDomain}
								onClick={onRemoveDomain}
							>
								{isRemovingDomain ? "Removendo..." : "Remover dominio"}
							</Button>
						) : (
							<div />
						)}
						<Button type="submit" size="sm" disabled={isSettingDomain}>
							{isSettingDomain ? "Salvando..." : "Salvar dominio"}
						</Button>
					</CardFooter>
				</form>
			</Card>
		</div>
	);
}
