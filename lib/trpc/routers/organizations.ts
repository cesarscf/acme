import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { members, organizations } from "@/lib/db/schema";
import { baseProcedure, createTRPCRouter } from "@/lib/trpc/init";

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
});
