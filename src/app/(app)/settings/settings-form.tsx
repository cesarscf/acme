"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
	AlertCircle,
	CheckCircle2,
	Clock,
	Copy,
	LoaderCircle,
	RefreshCw,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc/client";

const customDomainSchema = z.object({
	domain: z
		.string()
		.min(1, "Domínio é obrigatório")
		.max(253, "Domínio muito longo")
		.regex(
			/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/,
			"Domínio inválido (ex: loja.exemplo.com.br)",
		),
});

type CustomDomainForm = z.infer<typeof customDomainSchema>;

function DomainStatusBadge({ status }: { status: string }) {
	switch (status) {
		case "valid":
			return (
				<Badge variant="default" className="gap-1 bg-green-600">
					<CheckCircle2 className="size-3" />
					Configurado
				</Badge>
			);
		case "pending_verification":
			return (
				<Badge variant="secondary" className="gap-1">
					<Clock className="size-3" />
					Verificação pendente
				</Badge>
			);
		case "invalid":
			return (
				<Badge variant="destructive" className="gap-1">
					<AlertCircle className="size-3" />
					DNS inválido
				</Badge>
			);
		default:
			return null;
	}
}

function CopyButton({ value }: { value: string }) {
	const [hasCopied, setHasCopied] = useState(false);

	async function handleCopy() {
		await navigator.clipboard.writeText(value);
		setHasCopied(true);
		setTimeout(() => setHasCopied(false), 2000);
	}

	return (
		<button
			type="button"
			onClick={handleCopy}
			className="text-muted-foreground hover:text-foreground"
			title="Copiar"
		>
			{hasCopied ? (
				<CheckCircle2 className="size-3.5 text-green-600" />
			) : (
				<Copy className="size-3.5" />
			)}
		</button>
	);
}

function DnsRecordsTable({
	domain,
	isRefreshing,
	onRefresh,
}: {
	domain: string;
	isRefreshing: boolean;
	onRefresh: () => void;
}) {
	const { data: domainConfig, isLoading } =
		trpc.organizations.domainStatus.useQuery(
			{ domain },
			{ refetchInterval: 20_000 },
		);

	if (isLoading) {
		return (
			<p className="text-sm text-muted-foreground">
				Verificando configuração DNS...
			</p>
		);
	}

	if (!domainConfig) return null;

	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-center justify-between">
				<DomainStatusBadge status={domainConfig.status} />
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={onRefresh}
					disabled={isRefreshing}
					className="h-7 gap-1 text-xs"
				>
					<RefreshCw
						className={`size-3 ${isRefreshing ? "animate-spin" : ""}`}
					/>
					Verificar
				</Button>
			</div>

			{domainConfig.status === "valid" && (
				<p className="text-sm text-green-700 dark:text-green-400">
					O domínio está configurado corretamente e o certificado SSL será
					emitido automaticamente.
				</p>
			)}

			{domainConfig.status === "pending_verification" &&
				domainConfig.dnsRecords.length > 0 && (
					<div className="flex flex-col gap-2">
						<p className="text-sm text-muted-foreground">
							Para verificar a propriedade do domínio, adicione o seguinte
							registro DNS:
						</p>
						<DnsTable records={domainConfig.dnsRecords} />
					</div>
				)}

			{domainConfig.status === "invalid" &&
				domainConfig.dnsRecords.length > 0 && (
					<div className="flex flex-col gap-2">
						<p className="text-sm text-muted-foreground">
							Configure os seguintes registros DNS no seu provedor:
						</p>
						<DnsTable records={domainConfig.dnsRecords} />
					</div>
				)}
		</div>
	);
}

function DnsTable({
	records,
}: {
	records: { type: string; name: string; value: string }[];
}) {
	return (
		<div className="overflow-hidden rounded-md border">
			<table className="w-full text-sm">
				<thead>
					<tr className="border-b bg-muted/50">
						<th className="px-3 py-2 text-left font-medium">Tipo</th>
						<th className="px-3 py-2 text-left font-medium">Nome</th>
						<th className="px-3 py-2 text-left font-medium">Valor</th>
					</tr>
				</thead>
				<tbody>
					{records.map((record) => (
						<tr
							key={`${record.type}-${record.name}`}
							className="border-b last:border-0"
						>
							<td className="px-3 py-2">
								<Badge variant="outline" className="font-mono text-xs">
									{record.type}
								</Badge>
							</td>
							<td className="px-3 py-2">
								<div className="flex items-center gap-1.5">
									<code className="text-xs">{record.name}</code>
									<CopyButton value={record.name} />
								</div>
							</td>
							<td className="px-3 py-2">
								<div className="flex items-center gap-1.5">
									<code className="max-w-[200px] truncate text-xs">
										{record.value}
									</code>
									<CopyButton value={record.value} />
								</div>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

export function SettingsForm() {
	const utils = trpc.useUtils();
	const { data: org } = trpc.organizations.active.useQuery();

	const [isSettingDomain, setIsSettingDomain] = useState(false);
	const [isRemovingDomain, setIsRemovingDomain] = useState(false);
	const [isVerifying, setIsVerifying] = useState(false);

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
			await utils.organizations.domainStatus.invalidate();
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Falha ao salvar domínio";
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
				err instanceof Error ? err.message : "Falha ao remover domínio";
			setError("root", { message });
		} finally {
			setIsRemovingDomain(false);
		}
	}

	async function onVerifyDomain() {
		if (!org?.customDomain) return;

		setIsVerifying(true);

		try {
			await utils.client.organizations.verifyDomain.mutate({
				domain: org.customDomain,
			});
			await utils.organizations.domainStatus.invalidate();
		} finally {
			setIsVerifying(false);
		}
	}

	if (!org) return null;

	return (
		<div className="flex flex-col gap-6">
			{/* Subdomínio */}
			<Card>
				<CardHeader>
					<CardTitle>Subdomínio</CardTitle>
					<CardDescription>
						O subdomínio da sua loja é baseado no slug da organização.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex flex-col gap-2">
						<Label>Endereço da loja</Label>
						<div className="flex items-center gap-2">
							<Input value={org.slug} disabled />
							<span className="shrink-0 text-sm text-muted-foreground">
								.{process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000"}
							</span>
						</div>
						<p className="text-xs text-muted-foreground">
							O subdomínio é definido automaticamente pelo slug da organização e
							não pode ser alterado diretamente.
						</p>
					</div>
				</CardContent>
			</Card>

			{/* Domínio personalizado */}
			<Card>
				<CardHeader>
					<CardTitle>Domínio personalizado</CardTitle>
					<CardDescription>
						Configure um domínio próprio para a sua loja. Após salvar, configure
						os registros DNS no seu provedor.
					</CardDescription>
				</CardHeader>
				<form onSubmit={handleSubmit(onSubmitDomain)}>
					<CardContent>
						<div className="flex flex-col gap-4">
							{hasError && (
								<p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
									{firstError}
								</p>
							)}
							<div className="flex flex-col gap-2">
								<Label htmlFor="domain">Domínio</Label>
								<Input
									id="domain"
									type="text"
									placeholder="loja.exemplo.com.br"
									{...register("domain")}
								/>
							</div>

							{org.customDomain && (
								<DnsRecordsTable
									domain={org.customDomain}
									isRefreshing={isVerifying}
									onRefresh={onVerifyDomain}
								/>
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
								{isRemovingDomain ? (
									<LoaderCircle className="animate-spin" />
								) : (
									"Remover domínio"
								)}
							</Button>
						) : (
							<div />
						)}
						<Button type="submit" size="sm" disabled={isSettingDomain}>
							{isSettingDomain ? (
								<LoaderCircle className="animate-spin" />
							) : (
								"Salvar domínio"
							)}
						</Button>
					</CardFooter>
				</form>
			</Card>
		</div>
	);
}
