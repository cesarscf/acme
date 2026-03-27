"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc/client";

export function PagesContent() {
	const router = useRouter();
	const utils = trpc.useUtils();
	const { data: pagesList } = trpc.pages.list.useQuery();
	const [deletingId, setDeletingId] = useState<string | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

	async function handleDelete() {
		if (!deletingId) return;
		setIsDeleting(true);

		try {
			await utils.client.pages.delete.mutate({ id: deletingId });
			await utils.pages.list.invalidate();
		} finally {
			setIsDeleting(false);
			setDeletingId(null);
		}
	}

	return (
		<>
			<div className="mb-4 flex justify-end">
				<Button size="sm" onClick={() => router.push("/pages/new")}>
					Nova pagina
				</Button>
			</div>

			{pagesList && pagesList.length > 0 ? (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Titulo</TableHead>
							<TableHead>Path</TableHead>
							<TableHead>Template</TableHead>
							<TableHead>Status</TableHead>
							<TableHead className="text-right">Acoes</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{pagesList.map((page) => (
							<TableRow key={page.id}>
								<TableCell className="font-medium">{page.title}</TableCell>
								<TableCell className="font-mono text-sm">{page.path}</TableCell>
								<TableCell>
									<Badge variant="secondary">{page.template}</Badge>
								</TableCell>
								<TableCell>
									<Badge variant={page.published ? "default" : "outline"}>
										{page.published ? "Publicada" : "Rascunho"}
									</Badge>
								</TableCell>
								<TableCell className="text-right">
									<div className="flex justify-end gap-2">
										<Button
											variant="ghost"
											size="sm"
											onClick={() => router.push(`/pages/${page.id}/edit`)}
										>
											Editar
										</Button>
										<Button
											variant="ghost"
											size="sm"
											className="text-destructive hover:text-destructive"
											onClick={() => setDeletingId(page.id)}
										>
											Excluir
										</Button>
									</div>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			) : (
				<div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
					<p className="text-sm text-muted-foreground">
						Nenhuma pagina criada ainda.
					</p>
					<Button
						variant="outline"
						size="sm"
						className="mt-4"
						onClick={() => router.push("/pages/new")}
					>
						Criar primeira pagina
					</Button>
				</div>
			)}

			<AlertDialog
				open={!!deletingId}
				onOpenChange={(isOpen) => !isOpen && setDeletingId(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Excluir pagina</AlertDialogTitle>
						<AlertDialogDescription>
							Tem certeza que deseja excluir esta pagina? Esta acao nao pode ser
							desfeita.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isDeleting}>
							Cancelar
						</AlertDialogCancel>
						<AlertDialogAction disabled={isDeleting} onClick={handleDelete}>
							{isDeleting ? "Excluindo..." : "Excluir"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
