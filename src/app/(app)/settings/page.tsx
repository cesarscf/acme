import type { Metadata } from "next";
import { connection } from "next/server";
import { HydrateClient, trpc } from "@/lib/trpc/server";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = {
	title: "Configurações",
};

export default async function SettingsPage() {
	await connection();
	void trpc.organizations.active.prefetch();

	return (
		<div className="p-8">
			<h1 className="text-2xl font-semibold">Configurações</h1>
			<p className="mt-2 text-muted-foreground">
				Gerencie as configurações da sua organização.
			</p>

			<div className="mt-8 max-w-2xl">
				<HydrateClient>
					<SettingsForm />
				</HydrateClient>
			</div>
		</div>
	);
}
