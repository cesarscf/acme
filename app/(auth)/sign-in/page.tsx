import type { Metadata } from "next";
import Link from "next/link";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
	title: "Entrar",
};

export default function SignInPage() {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Entrar</CardTitle>
				<CardDescription>
					Entre com seu email e senha para acessar a plataforma.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<SignInForm />
				<p className="mt-4 text-center text-sm text-muted-foreground">
					Ainda nao tem uma conta?{" "}
					<Link href="/sign-up" className="text-primary underline">
						Criar conta
					</Link>
				</p>
			</CardContent>
		</Card>
	);
}
