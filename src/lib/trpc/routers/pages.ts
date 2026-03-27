import { TRPCError } from "@trpc/server";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { organizations, pages } from "@/lib/db/schema";
import {
	createPageSchema,
	defaultContent,
	updatePageSchema,
} from "@/lib/schemas/pages";
import {
	baseProcedure,
	createTRPCRouter,
	protectedProcedure,
} from "@/lib/trpc/init";

export const pagesRouter = createTRPCRouter({
	list: protectedProcedure.query(async ({ ctx }) => {
		return db
			.select({
				id: pages.id,
				title: pages.title,
				path: pages.path,
				template: pages.template,
				published: pages.published,
				updatedAt: pages.updatedAt,
			})
			.from(pages)
			.where(eq(pages.organizationId, ctx.organizationId));
	}),

	byId: protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.query(async ({ ctx, input }) => {
			const result = await db
				.select()
				.from(pages)
				.where(
					and(
						eq(pages.id, input.id),
						eq(pages.organizationId, ctx.organizationId),
					),
				)
				.limit(1);

			if (result.length === 0) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			return result[0];
		}),

	byDomainAndPath: baseProcedure
		.input(z.object({ domain: z.string().min(1), path: z.string() }))
		.query(async ({ input }) => {
			const isDomain = input.domain.includes(".");

			const result = await db
				.select({
					id: pages.id,
					title: pages.title,
					path: pages.path,
					template: pages.template,
					content: pages.content,
					published: pages.published,
					organizationId: pages.organizationId,
					orgName: organizations.name,
					orgSlug: organizations.slug,
					orgLogo: organizations.logo,
				})
				.from(pages)
				.innerJoin(organizations, eq(pages.organizationId, organizations.id))
				.where(
					and(
						isDomain
							? eq(organizations.customDomain, input.domain)
							: eq(organizations.slug, input.domain),
						eq(pages.path, input.path),
						eq(pages.published, true),
					),
				)
				.limit(1);

			if (result.length === 0) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			return result[0];
		}),

	create: protectedProcedure
		.input(createPageSchema)
		.mutation(async ({ ctx, input }) => {
			const path = input.path.toLowerCase().trim();

			const existing = await db
				.select({ id: pages.id })
				.from(pages)
				.where(
					and(
						eq(pages.organizationId, ctx.organizationId),
						eq(pages.path, path),
					),
				)
				.limit(1);

			if (existing.length > 0) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "Já existe uma página com este path nesta organização.",
				});
			}

			const id = crypto.randomUUID();
			const content =
				defaultContent[input.template as keyof typeof defaultContent];

			await db.insert(pages).values({
				id,
				organizationId: ctx.organizationId,
				title: input.title,
				path,
				template: input.template,
				content,
			});

			return { id };
		}),

	update: protectedProcedure
		.input(updatePageSchema)
		.mutation(async ({ ctx, input }) => {
			const existing = await db
				.select({ id: pages.id, template: pages.template })
				.from(pages)
				.where(
					and(
						eq(pages.id, input.id),
						eq(pages.organizationId, ctx.organizationId),
					),
				)
				.limit(1);

			if (existing.length === 0) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			if (input.path) {
				const pathConflict = await db
					.select({ id: pages.id })
					.from(pages)
					.where(
						and(
							eq(pages.organizationId, ctx.organizationId),
							eq(pages.path, input.path),
							ne(pages.id, input.id),
						),
					)
					.limit(1);

				if (pathConflict.length > 0) {
					throw new TRPCError({
						code: "CONFLICT",
						message: "Já existe uma página com este path nesta organização.",
					});
				}
			}

			const { id, ...data } = input;
			await db.update(pages).set(data).where(eq(pages.id, id));

			return { success: true };
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const existing = await db
				.select({ id: pages.id })
				.from(pages)
				.where(
					and(
						eq(pages.id, input.id),
						eq(pages.organizationId, ctx.organizationId),
					),
				)
				.limit(1);

			if (existing.length === 0) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			await db.delete(pages).where(eq(pages.id, input.id));

			return { success: true };
		}),
});
