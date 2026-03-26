import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { db } from "@/lib/db";
import { schema } from "@/lib/db/schema";

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
		schema,
		usePlural: true,
	}),
	emailAndPassword: {
		enabled: true,
	},
	plugins: [
		organization({
			schema: {
				organization: {
					additionalFields: {
						customDomain: {
							type: "string",
							required: false,
							input: true,
						},
					},
				},
			},
		}),
	],
});
