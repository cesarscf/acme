import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = {
	title: "Onboarding",
};

export default async function OnboardingPage() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session) {
		redirect("/sign-in");
	}

	return (
		<Card className="w-full max-w-sm">
			<CardHeader>
				<CardTitle>Criar sua primeira organização</CardTitle>
				<CardDescription>
					Uma organização representa um cliente da sua agência. Crie a primeira
					para começar.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<OnboardingForm />
			</CardContent>
		</Card>
	);
}
