import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
	return (
		<div className="p-8">
			<div className="flex items-center justify-between">
				<div>
					<Skeleton className="h-8 w-32" />
					<Skeleton className="mt-2 h-5 w-64" />
				</div>
			</div>

			<div className="mt-8">
				<div className="mb-4 flex justify-end">
					<Skeleton className="h-9 w-28" />
				</div>

				<div className="flex flex-col gap-2">
					<Skeleton className="h-10 w-full" />
					<Skeleton className="h-12 w-full" />
					<Skeleton className="h-12 w-full" />
					<Skeleton className="h-12 w-full" />
				</div>
			</div>
		</div>
	);
}
