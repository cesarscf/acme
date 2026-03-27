import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
	return (
		<div className="p-8">
			<Skeleton className="h-8 w-36" />
			<Skeleton className="mt-2 h-5 w-64" />

			<div className="mt-8 max-w-2xl flex flex-col gap-4">
				<div className="flex flex-col gap-2">
					<Skeleton className="h-4 w-16" />
					<Skeleton className="h-10 w-full" />
				</div>
				<div className="flex flex-col gap-2">
					<Skeleton className="h-4 w-16" />
					<Skeleton className="h-10 w-full" />
				</div>
				<div className="flex flex-col gap-2">
					<Skeleton className="h-4 w-24" />
					<Skeleton className="h-10 w-full" />
				</div>
				<div className="flex justify-end">
					<Skeleton className="h-9 w-24" />
				</div>
			</div>
		</div>
	);
}
