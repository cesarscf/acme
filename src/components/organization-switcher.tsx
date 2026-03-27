"use client";

import { Building2, Check, ChevronsUpDown, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CreateOrganizationForm } from "@/components/create-organization-form";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc/client";

type Organization = {
	id: string;
	name: string;
	slug: string;
};

type OrganizationSwitcherProps = {
	organizations: Organization[];
	activeOrganizationId: string | null;
};

export function OrganizationSwitcher({
	organizations,
	activeOrganizationId,
}: OrganizationSwitcherProps) {
	const router = useRouter();
	const utils = trpc.useUtils();
	const [isCreating, setIsCreating] = useState(false);

	const activeOrg = organizations.find((o) => o.id === activeOrganizationId);

	async function handleSwitchOrg(orgId: string) {
		if (orgId === activeOrganizationId) return;

		await authClient.organization.setActive({
			organizationId: orgId,
		});

		void utils.invalidate();
		router.push("/");
		router.refresh();
	}

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-medium transition-colors hover:bg-accent data-[state=open]:bg-accent"
					>
						<div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
							<Building2 className="size-4" />
						</div>
						<div className="grid flex-1 text-left text-sm leading-tight">
							<span className="truncate font-medium">
								{activeOrg?.name ?? "Selecionar organizacao"}
							</span>
							<span className="truncate text-xs text-muted-foreground">
								{activeOrg?.slug ?? ""}
							</span>
						</div>
						<ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
					align="start"
					sideOffset={4}
				>
					<DropdownMenuLabel className="text-xs text-muted-foreground">
						Organizacoes
					</DropdownMenuLabel>
					{organizations.map((org) => (
						<DropdownMenuItem
							key={org.id}
							onClick={() => handleSwitchOrg(org.id)}
							className="gap-2 p-2"
						>
							<div className="flex size-6 items-center justify-center rounded-md border">
								<Building2 className="size-3.5 shrink-0" />
							</div>
							{org.name}
							{org.id === activeOrganizationId && (
								<Check className="ml-auto size-4" />
							)}
						</DropdownMenuItem>
					))}
					<DropdownMenuSeparator />
					<DropdownMenuItem
						onClick={() => setIsCreating(true)}
						className="gap-2 p-2"
					>
						<div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
							<Plus className="size-4" />
						</div>
						<span className="font-medium text-muted-foreground">
							Nova organizacao
						</span>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			{isCreating && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
					<div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-lg">
						<h2 className="mb-4 text-lg font-semibold">Nova organizacao</h2>
						<CreateOrganizationForm
							onSuccessAction={() => setIsCreating(false)}
						/>
						<Button
							variant="ghost"
							className="mt-2 w-full"
							onClick={() => setIsCreating(false)}
						>
							Cancelar
						</Button>
					</div>
				</div>
			)}
		</>
	);
}
