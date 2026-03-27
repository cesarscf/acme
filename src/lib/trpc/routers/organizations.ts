import { TRPCError } from "@trpc/server";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import {
	baseProcedure,
	createTRPCRouter,
	protectedProcedure,
} from "@/lib/trpc/init";
import {
	addDomain,
	getDomainConfig,
	removeDomain,
	verifyDomain,
} from "@/lib/vercel-domains";

export const organizationsRouter = createTRPCRouter({
	bySlug: baseProcedure
		.input(z.object({ slug: z.string().min(1) }))
		.query(async ({ input }) => {
			const org = await db
				.select({
					id: organizations.id,
					name: organizations.name,
					slug: organizations.slug,
					logo: organizations.logo,
				})
				.from(organizations)
				.where(eq(organizations.slug, input.slug))
				.limit(1);

			if (org.length === 0) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			return org[0];
		}),

	list: baseProcedure.query(async ({ ctx }) => {
		if (!ctx.session || !ctx.user) {
			throw new TRPCError({ code: "UNAUTHORIZED" });
		}

		const { members } = await import("@/lib/db/schema");

		const memberships = await db
			.select({
				id: organizations.id,
				name: organizations.name,
				slug: organizations.slug,
				logo: organizations.logo,
				customDomain: organizations.customDomain,
			})
			.from(members)
			.innerJoin(organizations, eq(members.organizationId, organizations.id))
			.where(eq(members.userId, ctx.user.id));

		return memberships;
	}),

	active: protectedProcedure.query(async ({ ctx }) => {
		const org = await db
			.select({
				id: organizations.id,
				name: organizations.name,
				slug: organizations.slug,
				logo: organizations.logo,
				customDomain: organizations.customDomain,
			})
			.from(organizations)
			.where(eq(organizations.id, ctx.organizationId))
			.limit(1);

		if (org.length === 0) {
			throw new TRPCError({ code: "NOT_FOUND" });
		}

		return org[0];
	}),

	setCustomDomain: protectedProcedure
		.input(
			z.object({
				domain: z.string().min(1).max(253),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const domain = input.domain.toLowerCase().trim();

			// Verifica se o domínio já está em uso por outra organization
			const existing = await db
				.select({ id: organizations.id })
				.from(organizations)
				.where(
					and(
						eq(organizations.customDomain, domain),
						ne(organizations.id, ctx.organizationId),
					),
				)
				.limit(1);

			if (existing.length > 0) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "Este domínio já está em uso por outra organização.",
				});
			}

			// Busca o domínio atual para remover da Vercel se estiver trocando
			const currentOrg = await db
				.select({ customDomain: organizations.customDomain })
				.from(organizations)
				.where(eq(organizations.id, ctx.organizationId))
				.limit(1);

			const oldDomain = currentOrg[0]?.customDomain;

			if (oldDomain && oldDomain !== domain) {
				await removeDomain(oldDomain).catch(() => {});
			}

			// Adiciona o novo domínio na Vercel
			try {
				await addDomain(domain);
			} catch (err) {
				const message =
					err instanceof Error ? err.message : "Falha ao adicionar domínio na Vercel";
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message,
				});
			}

			// Salva no banco
			await db
				.update(organizations)
				.set({ customDomain: domain })
				.where(eq(organizations.id, ctx.organizationId));

			return { domain };
		}),

	removeCustomDomain: protectedProcedure.mutation(async ({ ctx }) => {
		const currentOrg = await db
			.select({ customDomain: organizations.customDomain })
			.from(organizations)
			.where(eq(organizations.id, ctx.organizationId))
			.limit(1);

		const domain = currentOrg[0]?.customDomain;

		if (domain) {
			await removeDomain(domain).catch(() => {});
		}

		await db
			.update(organizations)
			.set({ customDomain: null })
			.where(eq(organizations.id, ctx.organizationId));

		return { success: true };
	}),

	domainStatus: protectedProcedure
		.input(z.object({ domain: z.string().min(1) }))
		.query(async ({ input }) => {
			return getDomainConfig(input.domain);
		}),

	verifyDomain: protectedProcedure
		.input(z.object({ domain: z.string().min(1) }))
		.mutation(async ({ input }) => {
			try {
				const result = await verifyDomain(input.domain);
				return { verified: result.verified ?? false };
			} catch {
				return { verified: false };
			}
		}),
});
