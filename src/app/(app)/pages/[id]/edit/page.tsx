import type { Metadata } from "next";
import { connection } from "next/server";
import { HydrateClient, trpc } from "@/lib/trpc/server";
import { EditPageForm } from "./edit-page-form";

export const metadata: Metadata = {
	title: "Editar página",
};

export default async function EditPagePage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	await connection();
	void trpc.pages.byId.prefetch({ id });

	return (
		<div className="p-8">
			<h1 className="text-2xl font-semibold">Editar página</h1>
			<p className="mt-2 text-muted-foreground">
				Edite o conteúdo da sua página.
			</p>

			<div className="mt-8 max-w-2xl">
				<HydrateClient>
					<EditPageForm id={id} />
				</HydrateClient>
			</div>
		</div>
	);
}
