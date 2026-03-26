"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
	const router = useRouter();

	async function handleSignOut() {
		await authClient.signOut();
		router.push("/sign-in");
		router.refresh();
	}

	return (
		<Button variant="ghost" size="icon-sm" onClick={handleSignOut}>
			<LogOut className="size-4" />
		</Button>
	);
}
