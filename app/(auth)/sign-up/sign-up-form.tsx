"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

const signUpSchema = z.object({
	name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
	email: z.email("Email invalido"),
	password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres"),
});

type SignUpForm = z.infer<typeof signUpSchema>;

export function SignUpForm() {
	const router = useRouter();
	const [isLoading, setIsLoading] = useState(false);

	const {
		register,
		handleSubmit,
		setError,
		formState: { errors },
	} = useForm<SignUpForm>({
		// biome-ignore lint/suspicious/noExplicitAny: incompatibilidade de tipos entre zod@4.3 e @hookform/resolvers@5.2
		resolver: zodResolver(signUpSchema as any),
	});

	const firstError =
		errors.root?.message ??
		errors.name?.message ??
		errors.email?.message ??
		errors.password?.message;
	const hasError = !!firstError;

	async function onSubmitAction(data: SignUpForm) {
		setIsLoading(true);

		const result = await authClient.signUp.email({
			name: data.name,
			email: data.email,
			password: data.password,
		});

		if (result.error) {
			setError("root", {
				message: result.error.message ?? "Falha ao criar conta",
			});
			setIsLoading(false);
			return;
		}

		router.push("/");
		router.refresh();
	}

	return (
		<form
			onSubmit={handleSubmit(onSubmitAction)}
			className="flex flex-col gap-4"
		>
			{hasError && (
				<p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
					{firstError}
				</p>
			)}

			<div className="flex flex-col gap-2">
				<Label htmlFor="name">Nome</Label>
				<Input
					id="name"
					type="text"
					placeholder="Seu nome"
					autoComplete="name"
					{...register("name")}
				/>
			</div>

			<div className="flex flex-col gap-2">
				<Label htmlFor="email">Email</Label>
				<Input
					id="email"
					type="email"
					placeholder="seu@email.com"
					autoComplete="email"
					{...register("email")}
				/>
			</div>

			<div className="flex flex-col gap-2">
				<Label htmlFor="password">Senha</Label>
				<Input
					id="password"
					type="password"
					placeholder="********"
					autoComplete="new-password"
					{...register("password")}
				/>
			</div>

			<Button type="submit" disabled={isLoading} className="w-full">
				{isLoading ? "Criando conta..." : "Criar conta"}
			</Button>
		</form>
	);
}
