import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { organizationMembers } from "@/lib/db/schema/organization-members";
import { organizations } from "@/lib/db/schema/organizations";
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
			.from(organizationMembers)
			.innerJoin(
				organizations,
				eq(organizationMembers.organizationId, organizations.id),
			)
			.where(eq(organizationMembers.userId, ctx.user.id));

		return memberships;
	}),
});
