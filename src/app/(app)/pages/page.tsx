import type { Metadata } from "next";
import { connection } from "next/server";
import { HydrateClient, trpc } from "@/lib/trpc/server";
import { PagesContent } from "./pages-content";

export const metadata: Metadata = {
	title: "Páginas",
};

export default async function PagesPage() {
	await connection();
	void trpc.pages.list.prefetch();

	return (
		<div className="p-8">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-semibold">Páginas</h1>
					<p className="mt-2 text-muted-foreground">
						Gerencie as páginas da sua organização.
					</p>
				</div>
			</div>

			<div className="mt-8">
				<HydrateClient>
					<PagesContent />
				</HydrateClient>
			</div>
		</div>
	);
}
