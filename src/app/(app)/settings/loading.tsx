import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
	return (
		<div className="p-8">
			<Skeleton className="h-8 w-48" />
			<Skeleton className="mt-2 h-5 w-80" />

			<div className="mt-8 max-w-2xl flex flex-col gap-6">
				{/* Card subdominio */}
				<div className="rounded-lg border p-6">
					<Skeleton className="h-6 w-32" />
					<Skeleton className="mt-1 h-4 w-72" />
					<div className="mt-4 flex flex-col gap-2">
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-10 w-full" />
					</div>
				</div>

				{/* Card dominio personalizado */}
				<div className="rounded-lg border p-6">
					<Skeleton className="h-6 w-48" />
					<Skeleton className="mt-1 h-4 w-80" />
					<div className="mt-4 flex flex-col gap-2">
						<Skeleton className="h-4 w-20" />
						<Skeleton className="h-10 w-full" />
					</div>
					<div className="mt-4 flex justify-end">
						<Skeleton className="h-9 w-32" />
					</div>
				</div>
			</div>
		</div>
	);
}
