import { LoaderCircle } from "lucide-react";

export default function Loading() {
	return (
		<div className="flex h-full items-center justify-center">
			<LoaderCircle className="size-6 animate-spin text-muted-foreground" />
		</div>
	);
}
