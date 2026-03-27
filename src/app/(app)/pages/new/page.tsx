import type { Metadata } from "next";
import { HydrateClient } from "@/lib/trpc/server";
import { CreatePageForm } from "./create-page-form";

export const metadata: Metadata = {
	title: "Nova pagina",
};

export default function NewPagePage() {
	return (
		<div className="p-8">
			<h1 className="text-2xl font-semibold">Nova pagina</h1>
			<p className="mt-2 text-muted-foreground">
				Crie uma nova pagina para sua organizacao.
			</p>

			<div className="mt-8 max-w-2xl">
				<HydrateClient>
					<CreatePageForm />
				</HydrateClient>
			</div>
		</div>
	);
}
