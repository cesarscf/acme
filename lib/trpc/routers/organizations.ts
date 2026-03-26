import { TRPCError } from "@trpc/server";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { members, organizations } from "@/lib/db/schema";
import {
	baseProcedure,
	createTRPCRouter,
	protectedProcedure,
} from "@/lib/trpc/init";

export const organizationsRouter = createTRPCRouter({
	list: baseProcedure.query(async ({ ctx }) => {
		if (!ctx.session || !ctx.user) {
			throw new TRPCError({ code: "UNAUTHORIZED" });
		}

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

			await db
				.update(organizations)
				.set({ customDomain: domain })
				.where(eq(organizations.id, ctx.organizationId));

			return { domain };
		}),

	removeCustomDomain: protectedProcedure.mutation(async ({ ctx }) => {
		await db
			.update(organizations)
			.set({ customDomain: null })
			.where(eq(organizations.id, ctx.organizationId));

		return { success: true };
	}),
});
