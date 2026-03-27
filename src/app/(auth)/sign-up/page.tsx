import type { Metadata } from "next";
import Link from "next/link";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = {
	title: "Criar conta",
};

export default function SignUpPage() {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Criar conta</CardTitle>
				<CardDescription>
					Preencha os campos abaixo para criar sua conta.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<SignUpForm />
				<p className="mt-4 text-center text-sm text-muted-foreground">
					Já tem uma conta?{" "}
					<Link href="/sign-in" className="text-primary underline">
						Entrar
					</Link>
				</p>
			</CardContent>
		</Card>
	);
}
