"use client";

import { ChevronDown, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CreateOrganizationForm } from "@/components/create-organization-form";
import { Button } from "@/components/ui/button";
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
	const [isOpen, setIsOpen] = useState(false);
	const [isCreating, setIsCreating] = useState(false);

	const activeOrg = organizations.find((o) => o.id === activeOrganizationId);

	async function handleSwitchOrg(orgId: string) {
		if (orgId === activeOrganizationId) {
			setIsOpen(false);
			return;
		}

		await authClient.organization.setActive({
			organizationId: orgId,
		});

		setIsOpen(false);
		void utils.invalidate();
		router.push("/");
		router.refresh();
	}

	return (
		<div className="relative">
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className="flex w-full items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
			>
				<span className="flex-1 truncate text-left">
					{activeOrg?.name ?? "Selecionar organizacao"}
				</span>
				<ChevronDown className="size-4 shrink-0 text-muted-foreground" />
			</button>

			{isOpen && (
				<div className="absolute top-full left-0 z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
					{organizations.map((org) => (
						<button
							key={org.id}
							type="button"
							onClick={() => handleSwitchOrg(org.id)}
							className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${
								org.id === activeOrganizationId
									? "font-medium text-primary"
									: "text-muted-foreground"
							}`}
						>
							{org.name}
						</button>
					))}

					<div className="mx-2 my-1 h-px bg-border" />

					<button
						type="button"
						onClick={() => {
							setIsOpen(false);
							setIsCreating(true);
						}}
						className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-primary transition-colors hover:bg-accent"
					>
						<Plus className="size-3.5" />
						Nova organizacao
					</button>
				</div>
			)}

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
		</div>
	);
}
