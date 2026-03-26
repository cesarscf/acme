import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Dashboard",
};

export default function DashboardPage() {
	return (
		<div className="p-8">
			<h1 className="text-2xl font-semibold">Dashboard</h1>
			<p className="mt-2 text-muted-foreground">
				Selecione uma organizacao no menu lateral para comecar.
			</p>
		</div>
	);
}
