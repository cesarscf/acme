import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { db } from "@/lib/db";
import { schema } from "@/lib/db/schema";

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: {
			...schema,
			user: schema.users,
			session: schema.sessions,
			account: schema.accounts,
			verification: schema.verifications,
			organization: schema.organizations,
			member: schema.organizationMembers,
			invitation: schema.organizationInvitations,
		},
	}),
	emailAndPassword: {
		enabled: true,
	},
	user: {
		modelName: "users",
	},
	session: {
		modelName: "sessions",
	},
	plugins: [
		organization({
			schema: {
				organization: {
					modelName: "organizations",
					additionalFields: {
						customDomain: {
							type: "string",
							required: false,
							input: true,
						},
					},
				},
				member: {
					modelName: "organizationMembers",
				},
				invitation: {
					modelName: "organizationInvitations",
				},
			},
		}),
	],
	advanced: {
		database: {
			generateId: false,
		},
	},
});
