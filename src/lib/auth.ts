import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { db } from "@/lib/db";
import { schema } from "@/lib/db/schema";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000";
const isLocalhost = ROOT_DOMAIN.startsWith("localhost");
const protocol = isLocalhost ? "http" : "https";

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
		schema,
		usePlural: true,
	}),
	trustedOrigins: [
		`${protocol}://${ROOT_DOMAIN}`,
		`${protocol}://*.${ROOT_DOMAIN}`,
	],
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
