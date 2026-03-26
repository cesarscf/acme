import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { auth } from "@/lib/auth";

export default async function AppLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const requestHeaders = await headers();

	const session = await auth.api.getSession({
		headers: requestHeaders,
	});

	if (!session) {
		redirect("/sign-in");
	}

	const orgs = await auth.api.listOrganizations({
		headers: requestHeaders,
	});

	if (!orgs || orgs.length === 0) {
		redirect("/onboarding");
	}

	let activeOrganizationId = session.session.activeOrganizationId;

	if (!activeOrganizationId) {
		await auth.api.setActiveOrganization({
			headers: requestHeaders,
			body: { organizationId: orgs[0].id },
		});
		activeOrganizationId = orgs[0].id;
	}

	const organizations = orgs.map((org) => ({
		id: org.id,
		name: org.name,
		slug: org.slug,
	}));

	return (
		<div className="flex h-screen">
			<Sidebar
				user={{ name: session.user.name, email: session.user.email }}
				organizations={organizations}
				activeOrganizationId={activeOrganizationId}
			/>
			<main className="flex-1 overflow-y-auto">{children}</main>
		</div>
	);
}
