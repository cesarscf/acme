import { User } from "lucide-react";
import { OrganizationSwitcher } from "@/components/organization-switcher";
import { SignOutButton } from "@/components/sign-out-button";
import { SidebarNav } from "@/components/sidebar-nav";

type Organization = {
	id: string;
	name: string;
	slug: string;
};

type SidebarUser = {
	name: string;
	email: string;
};

type SidebarProps = {
	user: SidebarUser;
	organizations: Organization[];
	activeOrganizationId: string | null;
};

export function Sidebar({
	user,
	organizations,
	activeOrganizationId,
}: SidebarProps) {
	return (
		<aside className="flex h-screen w-60 shrink-0 flex-col border-r border-border bg-card">
			{/* Logo */}
			<div className="px-4 py-5">
				<span className="text-base font-semibold">Acme</span>
			</div>

			{/* Org switcher */}
			<div className="flex flex-col gap-1 px-4 pb-4">
				<span className="text-xs font-medium text-muted-foreground">
					Organizacao
				</span>
				<OrganizationSwitcher
					organizations={organizations}
					activeOrganizationId={activeOrganizationId}
				/>
			</div>

			{/* Nav */}
			<SidebarNav />

			{/* Spacer */}
			<div className="flex-1" />

			{/* User */}
			<div className="flex items-center gap-2 border-t border-border px-4 py-4">
				<div className="flex size-8 items-center justify-center rounded-full bg-muted">
					<User className="size-4 text-muted-foreground" />
				</div>
				<div className="flex min-w-0 flex-1 flex-col">
					<span className="truncate text-sm font-medium">{user.name}</span>
					<span className="truncate text-xs text-muted-foreground">
						{user.email}
					</span>
				</div>
				<SignOutButton />
			</div>
		</aside>
	);
}
